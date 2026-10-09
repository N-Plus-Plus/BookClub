import { maintenanceOperations, matchingCheck, planMaintenance, type MaintenanceBatchResult, type MaintenanceCoverage, type MaintenanceIntent, type MaintenanceOperation, type MaintenancePlan, type MaintenanceUnit } from '../shared/maintenance-plan';
import { formatRetryDuration } from './retry-duration';
import type { Catalog } from '../shared/types';
import { MAINTENANCE_IDLE_MS } from '../shared/score-maintenance';
import { maintainedScoreKeys,scoreProviderKeys,maintenanceContract } from '../shared/maintenance-contract';
import { requiredScores } from '../shared/ranking';

export interface UnifiedCheckpoint {version:1;intent:MaintenanceIntent;operation:MaintenanceOperation | 'all';startedAt:string;pending:MaintenanceUnit[];completed:number}
const validId=(v:unknown):v is string=>typeof v==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
export const unitKey=(u:MaintenanceUnit)=>`${u.movieId}:${u.provider}`;
export function saveUnifiedCheckpoint(key:string,value:UnifiedCheckpoint | null,storage?:Pick<Storage,'setItem'|'removeItem'>) {
  try {storage ??= globalThis.localStorage;if(value?.pending.length) storage.setItem(key,JSON.stringify(value));else storage.removeItem(key);}catch{/* Optional browser durability. */}
}
export function loadUnifiedCheckpoint(key:string,storage?:Pick<Storage,'getItem'|'removeItem'>):UnifiedCheckpoint | null {
  try {
    storage ??= globalThis.localStorage;
    const value=JSON.parse(storage.getItem(key) ?? 'null');if(!value) return null;
    if(value.version!==1 || !['populate','refresh'].includes(value.intent) || !['all',...maintenanceOperations].includes(value.operation)
      || typeof value.startedAt!=='string' || !Number.isFinite(Date.parse(value.startedAt)) || !Number.isSafeInteger(value.completed) || value.completed<0 || value.completed>300000
      || !Array.isArray(value.pending) || value.pending.length>300000 || !value.pending.every((u:MaintenanceUnit)=>validId(u.movieId) && ['mdblist','omdb','tmdb'].includes(u.provider) && u.identity && ['imdb','tmdb'].includes(u.identity.provider) && typeof u.identity.external_id==='string' && /^(tt\d{7,10}|[1-9]\d{0,9})$/.test(u.identity.external_id)
        && Array.isArray(u.operations) && u.operations.length && u.operations.every(o=>o==='scores' || maintenanceOperations.includes(o) && o.startsWith(u.provider)))
      || value.pending?.some((u:MaintenanceUnit)=>u.scoreKeys&&(!Array.isArray(u.scoreKeys)||u.scoreKeys.some(key=>!maintainedScoreKeys.includes(key as typeof maintainedScoreKeys[number]))))
      || new Set(value.pending.map(unitKey)).size!==value.pending.length || Object.keys(value).some(k=>!['version','intent','operation','startedAt','pending','completed'].includes(k))) throw new Error('Invalid checkpoint');
    // Copy only authorised fields; no arbitrary stored payload is forwarded.
    return {version:1,intent:value.intent,operation:value.operation,startedAt:value.startedAt,completed:value.completed,pending:value.pending.map((u:MaintenanceUnit)=>({movieId:u.movieId,provider:u.provider,identity:{provider:u.identity.provider,external_id:u.identity.external_id},operations:[...u.operations],...(u.operations.includes('scores')?{scoreKeys:u.scoreKeys ?? requiredScores.filter(key=>(scoreProviderKeys[u.provider] as readonly string[]).includes(key))}:{})}))};
  } catch {try{storage?.removeItem(key);}catch{/* Storage denial. */}return null;}
}
export function reconcileUnifiedCheckpoint(saved:UnifiedCheckpoint,catalog:Catalog,coverage:MaintenanceCoverage) {
  // Refresh retains the frozen scope; Populate also reconciles successful checks.
  const operations=saved.operation==='all'?undefined:[saved.operation];
  const current=planMaintenance(catalog,{...coverage,unavailable:{omdb:null,tmdb:null,mdblist:null}},saved.intent,operations);
  const byKey=new Map(current.units.map(u=>[unitKey(u),u]));
  const pending=saved.pending.flatMap(old=>{
    const unit=byKey.get(unitKey(old));if(!unit || unit.identity.provider!==old.identity.provider || unit.identity.external_id!==old.identity.external_id) return [];
    const movie=catalog.movies.find(m=>m.id===unit.movieId)!;
    const operations=unit.operations.filter(o=>old.operations.includes(o)).filter(o=>{
      if(saved.intent!=='refresh') return true;
      if(coverage.fields){
        const fields=coverage.fields.find(c=>c.movie_id===unit.movieId&&c.provider===unit.provider&&c.operation===o&&c.identity_provider===unit.identity.provider&&c.external_id===unit.identity.external_id)?.fields;
        const keys=o==='scores'?(old.scoreKeys ?? requiredScores as readonly string[]):maintenanceContract[o].fields.map(f=>f.id);
        return !keys.every(key=>fields?.[key]&&Date.parse(fields[key].checked_at)>=Date.parse(saved.startedAt));
      }
      const at=o==='scores' ? matchingCheck(coverage,unit.movieId,unit.provider,'scores',unit.identity)?.checked_at
        : o==='omdb-metadata' ? matchingCheck(coverage,unit.movieId,'omdb','metadata',unit.identity)?.checked_at
        : o==='tmdb-metadata' ? movie.tmdb_metadata_checked_at && movie.tmdb_artwork_checked_at ? (movie.tmdb_metadata_checked_at<movie.tmdb_artwork_checked_at?movie.tmdb_metadata_checked_at:movie.tmdb_artwork_checked_at) : undefined
        : o==='tmdb-collections' || o==='omdb-awards' ? coverage.evidence?.find(c=>c.movie_id===unit.movieId && c.domain===(o==='tmdb-collections'?'collections':'awards') && c.identity_provider===unit.identity.provider && c.external_id===unit.identity.external_id)?.checked_at
        : coverage.enrichment.find(c=>c.movie_id===unit.movieId && c.provider===unit.provider && c.identity_provider===unit.identity.provider && c.external_id===unit.identity.external_id)?.checked_at;
      return !at || Date.parse(at)<Date.parse(saved.startedAt);
    });
    const scoreKeys=unit.scoreKeys?.filter(key=>(old.scoreKeys ?? requiredScores as readonly string[]).includes(key));
    return [{...unit,operations:scoreKeys?.length===0?operations.filter(o=>o!=='scores'):operations,...(scoreKeys?{scoreKeys}:{})}].filter(u=>u.operations.length);
  });
  return {...saved,pending,completed:saved.completed+saved.pending.length-pending.length};
}
export function checkpointPlan(saved:UnifiedCheckpoint):MaintenancePlan {
  const batches:MaintenanceUnit[][]=[];
  for(const provider of ['mdblist','omdb','tmdb'] as const) for(const family of provider==='mdblist'?['imdb','tmdb']:['all']) {
    const units=saved.pending.filter(u=>u.provider===provider && (family==='all' || u.identity.provider===family));
    const size=provider==='tmdb'?2:10;
    for(let offset=0;offset<units.length;offset+=size)batches.push(units.slice(offset,offset+size));
  }
  return {units:saved.pending,batches,films:new Set(saved.pending.map(u=>u.movieId)).size,blocked:0,checkedUnavailable:0,calls:[]};
}
export interface UnifiedRun {conflicts:number;requests:number;processed:number;total:number;remaining:number;updated:number;noChange:number;failed:number;phase:string;message:string;interrupted:boolean;quota?:Record<string,string>}
export async function runUnifiedMaintenance(options:{checkpoint:UnifiedCheckpoint;batch:(units:MaintenanceUnit[],startedAt:string)=>Promise<MaintenanceBatchResult>;stopped:()=>boolean;checkpointChanged:(value:UnifiedCheckpoint | null)=>void;progress:(run:UnifiedRun)=>void;committed:(response:MaintenanceBatchResult)=>void}) {
  let saved={...options.checkpoint,pending:[...options.checkpoint.pending]};
  let run:UnifiedRun={conflicts:0,requests:0,processed:saved.completed,total:saved.completed+saved.pending.length,remaining:saved.pending.length,updated:0,noChange:0,failed:0,phase:'Ready',message:'',interrupted:false};
  options.progress(run);
  for(const batch of checkpointPlan(saved).batches) {
    if(options.stopped()) break;
    run={...run,phase:batch[0].provider};options.progress(run);
    try {
      const response=await options.batch(batch,saved.startedAt);
      if(!response || typeof response.canonicalChanged!=='boolean' || typeof response.cacheChanged!=='boolean' || !Array.isArray(response.results)
        || response.results.some(r=>r.provider!==batch[0].provider || !batch.some(u=>u.movieId===r.movieId) || !['updated','no_change','failed','skipped'].includes(r.status) || typeof r.message!=='string')
        || new Set(response.results.map(r=>r.movieId)).size!==response.results.length || !response.stopped && response.results.length!==batch.length) throw new Error('Incomplete maintenance response. Saved results are retained; resume later.');
      options.committed(response);
      const accepted=new Set(response.results.filter(r=>r.status!=='failed').map(r=>`${r.movieId}:${r.provider}`));
      saved={...saved,completed:saved.completed+accepted.size,pending:saved.pending.filter(u=>!accepted.has(unitKey(u)))};
      options.checkpointChanged(saved.pending.length?saved:null);
      const failed=response.results.filter(r=>r.status==='failed');
      run={...run,conflicts:run.conflicts+response.results.reduce((n,r)=>n+(r.conflicts ?? 0),0),requests:run.requests+(response.requests ?? 0),processed:saved.completed,remaining:saved.pending.length,updated:run.updated+response.results.filter(r=>r.status==='updated').length,noChange:run.noChange+response.results.filter(r=>['no_change','skipped'].includes(r.status)).length,failed:run.failed+failed.length,quota:response.quota ?? run.quota};
      if(response.stopped && saved.pending.length || failed.some(r=>r.blocking!==false || r.retryAfter!==undefined)) {run={...run,interrupted:true,message:failed[0] ? `${failed[0].message}${failed[0].retryAfter===undefined?'':` Retry after at least ${formatRetryDuration(failed[0].retryAfter)}.`}` : 'Provider quota reserve reached. Completed work is saved; resume after cooldown.'};options.progress(run);return run;}
      options.progress(run);
    } catch(error) {run={...run,interrupted:true,message:error instanceof Error?error.message:'Maintenance failed. Completed results are saved.'};options.progress(run);return run;}
    if(!options.stopped() && saved.pending.length) await new Promise(resolve=>setTimeout(resolve,MAINTENANCE_IDLE_MS));
  }
  run={...run,message:options.stopped() && saved.pending.length?'Stopped. Completed work is saved; resume to continue.':run.failed?'Finished with unresolved films. Completed work is saved; resume to retry them.':'Finished. Available information is saved.'};options.progress(run);return run;
}
