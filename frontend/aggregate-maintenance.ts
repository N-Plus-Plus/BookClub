import type { Catalog } from '../shared/types';
import type { CollectionRosterBatch, CollectionRosterStatus } from '../shared/collection-roster';
import type { MaintenanceBatchResult, MaintenanceCoverage, MaintenanceIntent, MaintenanceUnit } from '../shared/maintenance-plan';
import { loadUnifiedCheckpoint, reconcileUnifiedCheckpoint, runUnifiedMaintenance, type UnifiedCheckpoint, type UnifiedRun } from './unified-maintenance';
import { reconcileRosterCheckpoint, rosterPlan, runRosterMaintenance, type RosterCheckpoint } from './collection-roster-maintenance';

/** The queues retain their own units and freeze at their respective planning boundaries. */
export interface AggregateCheckpoint {
  version: 2;
  intent: MaintenanceIntent;
  phase: 'films' | 'collections';
  films: UnifiedCheckpoint;
  rosters: RosterCheckpoint | null;
  filmRequests: number;
}
export const aggregateKey=(intent:MaintenanceIntent)=>`bookclub.maintenance.${intent}.all.v2`;
export function saveAggregateCheckpoint(value:AggregateCheckpoint | null,intent:MaintenanceIntent){
  try{if(value)localStorage.setItem(aggregateKey(intent),JSON.stringify(value));else localStorage.removeItem(aggregateKey(intent));}catch{/* Optional durability. */}
}
export function loadAggregateCheckpoint(intent:MaintenanceIntent):AggregateCheckpoint | null {
  try{
    const value=JSON.parse(localStorage.getItem(aggregateKey(intent)) ?? 'null');if(!value)return null;
    if(value.version!==2 || value.intent!==intent || !['films','collections'].includes(value.phase) || !Number.isSafeInteger(value.filmRequests) || value.filmRequests<0 || Object.keys(value).some(k=>!['version','intent','phase','films','rosters','filmRequests'].includes(k)))throw new Error('Invalid aggregate checkpoint');
    const films=loadUnifiedCheckpoint('films',{getItem:()=>JSON.stringify(value.films),removeItem:()=>{}});
    if(!films || films.intent!==intent || films.operation!=='all')throw new Error('Invalid film queue');
    const r=value.rosters as RosterCheckpoint | null;
    if(value.phase==='films' && r!==null || value.phase==='collections' && (!r || films.pending.length))throw new Error('Invalid phase');
    if(r && (r.version!==1 || r.intent!==intent || typeof r.startedAt!=='string' || !Number.isFinite(Date.parse(r.startedAt)) || !Array.isArray(r.pending) || r.pending.length>100000 || r.pending.some(id=>!Number.isSafeInteger(id)||id<=0||id>2147483647) || new Set(r.pending).size!==r.pending.length || ![r.completed,r.requests].every(n=>Number.isSafeInteger(n)&&n>=0) || Object.keys(r).some(k=>!['version','intent','startedAt','pending','completed','requests'].includes(k))))throw new Error('Invalid collection queue');
    return {...value,films};
  }catch{saveAggregateCheckpoint(null,intent);return null;}
}
export interface AggregateProgress {checkpoint:AggregateCheckpoint;filmRun:UnifiedRun | null;failures:number;interrupted:boolean;message:string}
export async function runAggregateMaintenance(options:{
  checkpoint:AggregateCheckpoint;
  filmEvidence:()=>Promise<{catalog:Catalog;coverage:MaintenanceCoverage}>;
  collectionEvidence:()=>Promise<CollectionRosterStatus>;
  filmBatch:(units:MaintenanceUnit[],startedAt:string)=>Promise<MaintenanceBatchResult>;
  collectionBatch:(id:number,startedAt:string)=>Promise<CollectionRosterBatch>;
  stopped:()=>boolean;
  checkpointChanged:(value:AggregateCheckpoint | null)=>void;
  progress:(value:AggregateProgress)=>void;
  committed:(value:MaintenanceBatchResult)=>void;
  collectionsChanged:()=>void;
}){
  let current=structuredClone(options.checkpoint),filmRun:UnifiedRun | null=null,failures=0;
  const emit=(message:string,interrupted=false)=>options.progress({checkpoint:structuredClone(current),filmRun,failures,interrupted,message});
  const save=()=>options.checkpointChanged(structuredClone(current));
  save();
  try{
    if(current.phase==='films'){
      const evidence=await options.filmEvidence();
      current.films=reconcileUnifiedCheckpoint(current.films,evidence.catalog,evidence.coverage);save();
      const priorRequests=current.filmRequests;
      filmRun=await runUnifiedMaintenance({checkpoint:current.films,batch:options.filmBatch,stopped:options.stopped,committed:options.committed,
        checkpointChanged:value=>{current.films=value ?? {...current.films,completed:current.films.completed+current.films.pending.length,pending:[]};save();},
        progress:run=>{filmRun=run;current.filmRequests=priorRequests+run.requests;save();emit(run.message,run.interrupted);}});
      if(current.films.pending.length){emit(filmRun.message || 'Film work remains. Resume before collection planning.',filmRun.interrupted || filmRun.failed>0);return current;}
      // Stopping at the boundary leaves an explicit, unplanned second phase to resume.
      if(options.stopped()){emit('Stopped after film maintenance. Resume to plan collection rosters.');return current;}
      const status=await options.collectionEvidence();
      current={...current,phase:'collections',rosters:{version:1,intent:current.intent,startedAt:new Date().toISOString(),pending:rosterPlan(status,current.intent).ids,completed:0,requests:0}};save();
      if(status.unavailable && current.rosters!.pending.length)throw new Error(status.unavailable);
    }
    const status=await options.collectionEvidence();
    current.rosters=reconcileRosterCheckpoint(current.rosters!,status);save();
    if(current.rosters.pending.length && status.unavailable)throw new Error(status.unavailable);
    emit('Collection rosters planned from committed film evidence.');
    await runRosterMaintenance({checkpoint:current.rosters,batch:options.collectionBatch,stopped:options.stopped,changed:options.collectionsChanged,
      checkpointChanged:value=>{current.rosters=value;save();},progress:(_,count)=>{failures=count;emit('Checking collection rosters.');}});
    if(current.rosters!.pending.length){emit('Stopped. Collection checks are saved; resume to continue.');return current;}
    options.checkpointChanged(null);emit('Finished both phases. Available information and conclusive unavailable checks are saved.');return null;
  }catch(error){emit(error instanceof Error?error.message:'Maintenance interrupted. Resume saved work.',true);return current;}
}
