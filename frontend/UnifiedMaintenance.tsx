import { useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Square } from 'lucide-react';
import type { Catalog } from '../shared/types';
import { formatCount } from '../shared/format';
import { maintenanceOperations, planMaintenance, type MaintenanceCoverage, type MaintenanceIntent, type MaintenanceOperation, type MaintenancePlan } from '../shared/maintenance-plan';
import { operationCounts } from '../shared/maintenance-plan';
import { maintenanceContract,collectedDescription,maintenanceFieldSummary,aggregateFieldSummary } from '../shared/maintenance-contract';
import { api } from './api';
import { loadMaintenanceCheckpoint, saveMaintenanceCheckpoint } from './maintenance-checkpoint';
import { Action } from './components';
import { NativeDialog } from './NativeDialog';
import { MaintenanceProgress, useBulkJobController } from './bulk-maintenance';
import { loadUnifiedCheckpoint, reconcileUnifiedCheckpoint, runUnifiedMaintenance, saveUnifiedCheckpoint, type UnifiedCheckpoint, type UnifiedRun } from './unified-maintenance';

import type { CollectionRosterStatus } from '../shared/collection-roster';
import { rosterPlan } from './collection-roster-maintenance';
import { loadAggregateCheckpoint,saveAggregateCheckpoint,runAggregateMaintenance,type AggregateCheckpoint,type AggregateProgress } from './aggregate-maintenance';

const names=Object.fromEntries(maintenanceOperations.map(operation=>[operation,maintenanceContract[operation].name])) as Record<MaintenanceOperation,string>;
const descriptions=Object.fromEntries(maintenanceOperations.map(operation=>[operation,collectedDescription(operation)+' '+maintenanceContract[operation].scope])) as Record<MaintenanceOperation,string>;
const keyFor=(intent:MaintenanceIntent,operation:MaintenanceOperation | 'all')=>`bookclub.maintenance.${intent}.${operation}.v1`;
export async function readMaintenanceCoverage():Promise<MaintenanceCoverage> {
  let after:string | null=null;
  const coverage:MaintenanceCoverage={checks:[],negativeScores:[],enrichment:[],evidence:[],unavailable:{tmdb:null,omdb:null,mdblist:null}},seen=new Set<string>();
  do {
    const page=await api.maintenanceCoverage(after);
    if(!page || !Array.isArray(page.checks) || !Array.isArray(page.enrichment) || !Array.isArray(page.negativeScores) || !page.unavailable || !Array.isArray(page.evidence) || page.evidenceSupported!==true || page.fieldsSupported!==true || !Array.isArray(page.fields)) throw new Error('Maintenance coverage is unavailable. Install migration 0023 and update the API Worker before using these controls.');
    coverage.evidenceSupported=page.evidenceSupported;coverage.evidence!.push(...(page.evidence ?? []));
    if(page.fields){coverage.fields ??= [];coverage.fields.push(...page.fields);}coverage.fieldsSupported=page.fieldsSupported;
    coverage.failures=[...(coverage.failures ?? []),...(page.failures ?? [])];coverage.checks.push(...page.checks);coverage.enrichment.push(...page.enrichment);coverage.negativeScores.push(...page.negativeScores);coverage.unavailable=page.unavailable;
    after=page.next;
    if(after && seen.has(after)) throw new Error('Maintenance coverage returned a repeated page. Reload before starting.');
    if(after) seen.add(after);
  } while(after);
  return coverage;
}
function PlanSummary({plan}:{plan:MaintenancePlan}) {
  return <div className="maintenance-details"><p className="meta">{formatCount(plan.films)} eligible films · {formatCount(plan.units.length)} film/provider work units · {formatCount(plan.batches.length)} BookClub batches.</p>
    <p className="meta">Estimated API requests: {plan.calls.map(c=>`${c.provider==='mdblist'?'MDBList':c.provider==='omdb'?'OMDb':'TMDB'} ${c.min===c.max?formatCount(c.min):`${formatCount(c.min)}–${formatCount(c.max)}`}`).join(' · ')}.</p>
    <p className="meta">{formatCount(plan.blocked)} films blocked by identities or provider availability · {formatCount(plan.checkedUnavailable)} films with checked unavailable data skipped. Ranges allow conditional fallbacks, omitted-entry recovery and credential failover.</p></div>;
}
export function UnifiedMaintenance({catalog,writesEnabled,onUpdated,onEnrichmentChanged}:{catalog:Catalog;writesEnabled:boolean;onUpdated:()=>Promise<void>;onEnrichmentChanged?:()=>void}) {
  const job=useBulkJobController(),[coverage,setCoverage]=useState<MaintenanceCoverage | null>(null),[loading,setLoading]=useState(true);
  const [rosterStatus,setRosterStatus]=useState<CollectionRosterStatus | null>(null),[rosterError,setRosterError]=useState('');
  const [aggregate,setAggregate]=useState(()=>({populate:loadAggregateCheckpoint('populate'),refresh:loadAggregateCheckpoint('refresh')}));
  const [aggregateRuns,setAggregateRuns]=useState<Partial<Record<MaintenanceIntent,AggregateProgress>>>({});
  const [active,setActive]=useState<string | null>(null),[runs,setRuns]=useState<Record<string,UnifiedRun>>({});
  const [checkpoints,setCheckpoints]=useState<Record<string,UnifiedCheckpoint | null>>(()=>Object.fromEntries((['populate','refresh'] as const).flatMap(intent=>['all',...maintenanceOperations].map(operation=>{const key=keyFor(intent,operation as MaintenanceOperation | 'all');return [key,loadUnifiedCheckpoint(key)];}))));
  const [confirmation,setConfirmation]=useState<{intent:MaintenanceIntent;plan:MaintenancePlan} | null>(null);
  const {setError}=job;
  const allowed=useRef(writesEnabled);allowed.current=writesEnabled;
  const reloadRosters=async()=>{try{setRosterStatus(await api.collectionRosterStatus());setRosterError('');}catch{setRosterError('Collection coverage is unavailable; aggregate maintenance requires the matching API and schema.');}};
  useEffect(()=>{let live=true;Promise.resolve().then(()=>api.collectionRosterStatus()).then(status=>{if(live)setRosterStatus(status);}).catch(()=>{if(live)setRosterError('Collection coverage is unavailable; aggregate maintenance requires the matching API and schema.');});return()=>{live=false;};},[]);
  const reload=async()=>{setLoading(true);try{setCoverage(await readMaintenanceCoverage());}catch(e){job.setError(e instanceof Error?e.message:'Could not read maintenance coverage.');}finally{setLoading(false);}};
  useEffect(()=>{let live=true;readMaintenanceCoverage().then(value=>{if(live)setCoverage(value);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not read maintenance coverage.');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[setError]);

  useEffect(()=>{
    if(!coverage) return;
    const legacyKeys={'omdb-metadata':'bookclub.omdb-metadata.v1','tmdb-enrichment':'bookclub.tmdb-enrichment.v1','mdblist-enrichment':'bookclub.mdblist-enrichment.v1'} as const;
    for(const [operation,legacyKey] of Object.entries(legacyKeys)) {
      const key=keyFor('refresh',operation as MaintenanceOperation),legacy=loadMaintenanceCheckpoint(legacyKey);
      if(!legacy || loadUnifiedCheckpoint(key)) continue;
      const plan=planMaintenance(catalog,{...coverage,unavailable:{omdb:null,tmdb:null,mdblist:null}},'refresh',[operation as MaintenanceOperation]);
      const saved:UnifiedCheckpoint={version:1,intent:'refresh',operation:operation as MaintenanceOperation,startedAt:new Date().toISOString(),completed:legacy.completed,pending:plan.units.filter(u=>legacy.remainingIds.includes(u.movieId))};
      saveUnifiedCheckpoint(key,saved);
      if(!saved.pending.length || loadUnifiedCheckpoint(key)) {saveMaintenanceCheckpoint(legacyKey,null);setCheckpoints(old=>({...old,[key]:saved.pending.length?saved:null}));}
    }
  },[catalog,coverage]);
  const checkpointChanged=(key:string,value:UnifiedCheckpoint | null)=>{saveUnifiedCheckpoint(key,value);setCheckpoints(old=>({...old,[key]:value}));};
  const aggregateChanged=(intent:MaintenanceIntent,value:AggregateCheckpoint | null)=>{saveAggregateCheckpoint(value,intent);setAggregate(old=>({...old,[intent]:value}));};
  const startAggregate=(intent:MaintenanceIntent,plan:MaintenancePlan)=>job.execute(async()=>{
    if(!allowed.current || !coverage || !rosterStatus)return;
    const saved=aggregate[intent] ?? {version:2 as const,intent,phase:'films' as const,films:{version:1 as const,intent,operation:'all' as const,startedAt:new Date().toISOString(),pending:plan.units,completed:0},rosters:null,filmRequests:0};
    setActive(keyFor(intent,'all'));let changed=false,cacheChanged=false;
    try{await runAggregateMaintenance({checkpoint:saved,
      filmEvidence:async()=>({catalog:await api.catalog(),coverage:await readMaintenanceCoverage()}),
      collectionEvidence:async()=>{const status=await api.collectionRosterStatus();setRosterStatus(status);return status;},
      filmBatch:(units,startedAt)=>{changed=true;cacheChanged=true;return api.maintenanceProvider(intent,units,startedAt);},
      collectionBatch:(id,startedAt)=>{cacheChanged=true;return api.maintainCollectionRosters(intent,[id],startedAt);},
      stopped:()=>job.stop.current || !allowed.current,checkpointChanged:value=>aggregateChanged(intent,value),progress:value=>setAggregateRuns(old=>({...old,[intent]:value})),
      committed:response=>{changed ||= response.canonicalChanged || response.cacheChanged && response.results.some(r=>r.provider==='tmdb');cacheChanged ||= response.cacheChanged;},collectionsChanged:()=>{cacheChanged=true;}});}
    finally{if(cacheChanged)onEnrichmentChanged?.();try{if(changed)await onUpdated();await reload();await reloadRosters();}finally{setActive(null);}}
  });
  const start=(intent:MaintenanceIntent,operation:MaintenanceOperation | 'all',plan:MaintenancePlan)=>job.execute(async()=>{
    if(!allowed.current || !coverage) return;
    const key=keyFor(intent,operation),old=checkpoints[key];
    const saved=old?reconcileUnifiedCheckpoint(old,catalog,coverage):{version:1 as const,intent,operation,startedAt:new Date().toISOString(),pending:plan.units,completed:0};
    checkpointChanged(key,saved);setActive(key);setRuns(oldRuns=>{const next={...oldRuns};delete next[key];return next;});
    let canonicalChanged=false,cacheChanged=false;
    try {await runUnifiedMaintenance({checkpoint:saved,batch:(units,startedAt)=>api.maintenanceProvider(intent,units,startedAt),stopped:()=>job.stop.current || !allowed.current,
      checkpointChanged:value=>checkpointChanged(key,value),progress:run=>setRuns(previous=>({...previous,[key]:run})),committed:response=>{canonicalChanged ||= response.canonicalChanged || response.cacheChanged && response.results.some(r=>r.provider==='tmdb');cacheChanged ||= response.cacheChanged;}});}
    finally {
      if(cacheChanged)onEnrichmentChanged?.();
      try{if(canonicalChanged)await onUpdated();await reload();}catch(e){job.setError(e instanceof Error?e.message:'Completed results are saved; reload BookClub.');}
      setActive(null);
    }
  });
  return <>{job.error && <div className="stack"><p role="alert" className="error-message">{job.error}</p><Action icon={RefreshCw} disabled={job.busy} onClick={()=>void reload()}>Retry coverage</Action></div>}
    {(['populate','refresh'] as const).map(intent=><section className="stack maintenance-section" key={intent} aria-labelledby={`${intent}-data-heading`}>
      <div className="section-title"><h2 id={`${intent}-data-heading`}>{intent==='populate'?'Populate missing data':'Refresh all data'}</h2></div>
      {(['all',...maintenanceOperations] as const).map(operation=>{
        const key=keyFor(intent,operation), title=operation==='all'?(intent==='populate'?'Populate missing data':'Refresh all data'):`${intent==='populate'?'Populate missing':'Refresh'} ${names[operation]}`;
        const basePlan=coverage?planMaintenance(catalog,coverage!,intent,operation==='all'?undefined:[operation]):null;
        const aggregateSaved=operation==='all'?aggregate[intent]:null;
        const saved=aggregateSaved?.films ?? (coverage && checkpoints[key]?reconcileUnifiedCheckpoint(checkpoints[key]!,catalog,coverage):null);
        const pendingKeys=saved?new Set(saved.pending.map(u=>`${u.movieId}:${u.provider}`)):null;
        const plan=basePlan && pendingKeys ? planMaintenance(catalog,coverage!,intent,operation==='all'?undefined:[operation]) : basePlan;
        // Replan estimates over the frozen remaining catalogue and operations, never add new work on resume.
        if(plan && pendingKeys) {
          plan.units=plan.units.filter(u=>pendingKeys.has(`${u.movieId}:${u.provider}`)).map(u=>saved!.pending.find(old=>old.movieId===u.movieId && old.provider===u.provider)!);plan.batches=plan.batches.map(batch=>batch.filter(u=>pendingKeys.has(`${u.movieId}:${u.provider}`)).map(u=>plan.units.find(old=>old.movieId===u.movieId && old.provider===u.provider)!)).filter(batch=>batch.length);plan.films=new Set(plan.units.map(u=>u.movieId)).size;
          plan.calls=plan.calls.map(c=>{const units=plan.units.filter(u=>u.provider===c.provider),batches=plan.batches.filter(b=>b[0].provider===c.provider);return {...c,min:c.provider==='mdblist'?batches.length:units.filter(u=>u.operations.some(o=>o!=='scores')).length,max:c.provider==='mdblist'?batches.length+units.length:units.length*(c.provider==='omdb'?2:1)};});
        }
        const rosterCount=operation==='all'?(aggregateSaved?.rosters?.pending.length ?? (rosterStatus?rosterPlan(rosterStatus,intent).collections:0)):0;
        const aggregateRun=operation==='all'?aggregateRuns[intent]:null;
        const run=runs[key],busy=active===key,counts=coverage&&operation!=='all'?operationCounts(catalog,operation,coverage):null;
        return <section className="card stack classics-maintenance" key={operation} aria-labelledby={`${intent}-${operation}-heading`}><h3 id={`${intent}-${operation}-heading`}>{title}</h3>
          <p className="meta maintenance-field-summary">{operation==='all'?aggregateFieldSummary():maintenanceFieldSummary(operation)}</p>
          <p className="meta">{operation==='all'?(intent==='populate'?'Find gaps in stored film information and check the relevant providers. Already-checked unavailable information is skipped.':'Recheck eligible films against the configured providers and reconcile newer information with the stored catalogue.'):descriptions[operation]}</p>
          {counts&&<p className="meta">Provider-check evidence: {formatCount(counts.actionable)} unchecked/inconclusive films · {formatCount(counts.present)} checked present · {formatCount(counts.unavailable)} checked unavailable · {formatCount(counts.blocked)} blocked.</p>}{loading && <p className="meta" role="status">Loading read-only coverage…</p>}{plan && <PlanSummary plan={plan}/>}
          {operation==='all'&&<><p className="meta">{formatCount(rosterCount)} {aggregateSaved?.rosters?'remaining collection rosters in the frozen plan':'provisional collection rosters'} · {formatCount(rosterCount)} estimated TMDB collection requests. Collection requests may increase after film data is updated.</p>{rosterError&&<p className="error-message">{rosterError}</p>}</>}
          {saved && <p className="meta">{formatCount(saved.completed)} completed checkpoint work units · {formatCount(saved.pending.length)} remaining.</p>}
          <div className="button-set action-group-wrap"><Action icon={RefreshCw} disabled={!writesEnabled || job.locked || loading || (!plan || !(plan.units.length || operation==='all' && (aggregateSaved || rosterCount))) || operation==='all' && !checkpoints[key] && (!rosterStatus || !!rosterError)} onClick={()=>{if(!plan)return;if(operation==='all')setConfirmation({intent,plan});else void start(intent,operation,plan);}}>{!busy && (saved?.pending.length || aggregateSaved)?`Resume ${title}`:title}</Action>
            {busy && <Action icon={Square} onClick={job.requestStop}>Stop after this batch</Action>}
            {(checkpoints[key] || aggregateSaved) && !busy && <Action icon={RotateCcw} variant="tertiary" disabled={job.locked} onClick={()=>{checkpointChanged(key,null);if(operation==='all')aggregateChanged(intent,null);}}>Discard progress</Action>}</div>
          {plan && !plan.units.length && !(operation==='all'&&(rosterCount || aggregateSaved)) && <p className="meta">No actionable work for this operation.</p>}
          <details className="utility-disclosure"><summary>Data collected and safeguards</summary><div className="maintenance-details"><p className="meta">{operation==='all'?'The aggregate covers all seven film-level operations, followed by collection rosters as a second phase. Collection eligibility is recalculated after committed film updates. Dedicated collection controls remain available. Outstanding failed film work must be resumed before the collection phase. One response supplies compatible film/provider work without double-counting requests.':descriptions[operation]+' '+maintenanceContract[operation].success}</p><p className="meta">Populate activates for unchecked or inconclusive provider fields, not merely gaps in the displayed film. Successfully checked unavailable fields and empty optional results do not activate Populate. Successful empty checks are retained. Populate skips prior successful checks and does not refresh solely because they are old. Refresh revisits eligible records. Canonical title authority, score history and provider identity ownership are preserved. Measured request totals come from received batch responses; a lost response can hide attempted calls, while saved evidence still prevents replay. MDBList batches group up to ten identities; TMDB batches contain at most two films. Requests run serially with two-second pauses, persisted cooldowns, the MDBList 25-request reserve and bounded OMDb credential failover.</p>{coverage && Object.entries(coverage.unavailable).filter(([,reason])=>reason).map(([provider,reason])=><p className="meta" key={provider}>{provider}: {reason}</p>)}</div></details>
          {aggregateRun&&<div role="status" className="stack"><p className="meta">Phase: {aggregateRun.checkpoint.phase==='films'?`Film maintenance${aggregateRun.filmRun?.phase && aggregateRun.filmRun.phase!=='Ready'?` (${aggregateRun.filmRun.phase})`:''}`:'Collection rosters'} · {formatCount(aggregateRun.checkpoint.films.completed)} film/provider units completed · {formatCount(aggregateRun.checkpoint.films.pending.length)} remaining · {formatCount(aggregateRun.checkpoint.filmRequests)} measured film requests.</p><MaintenanceProgress processed={aggregateRun.checkpoint.phase==='films'?aggregateRun.checkpoint.films.completed:aggregateRun.checkpoint.rosters!.completed} total={aggregateRun.checkpoint.phase==='films'?aggregateRun.checkpoint.films.completed+aggregateRun.checkpoint.films.pending.length:aggregateRun.checkpoint.rosters!.completed+aggregateRun.checkpoint.rosters!.pending.length} label={`${title} progress`} state={aggregateRun.interrupted?'interrupted':'normal'} summary={aggregateRun.checkpoint.rosters?`${formatCount(aggregateRun.checkpoint.rosters.completed)} collection rosters completed · ${formatCount(aggregateRun.checkpoint.rosters.pending.length)} remaining · ${formatCount(aggregateRun.checkpoint.rosters.requests)} measured collection requests`:'Collection rosters will be planned after film maintenance.'}><p className={aggregateRun.interrupted?'error-message':'meta'}>{aggregateRun.message}</p><p className="meta">{formatCount((aggregateRun.filmRun?.failed ?? 0)+aggregateRun.failures)} failed checks · {formatCount(aggregateRun.filmRun?.updated ?? 0)} film updates · {formatCount(aggregateRun.filmRun?.noChange ?? 0)} unchanged film checks.</p>{aggregateRun.filmRun?.quota&&<p className="meta">Provider quota: {Object.entries(aggregateRun.filmRun.quota).map(([name,value])=>`${name}: ${value}`).join(' · ')}</p>}</MaintenanceProgress></div>}
          {run && <MaintenanceProgress processed={run.processed} total={run.total} label={`${title} progress`} state={run.interrupted?'interrupted':'normal'} summary={<>{run.phase} · {formatCount(run.processed)} / {formatCount(run.total)} film/provider work units completed · {formatCount(run.remaining)} remaining · {formatCount(run.updated)} updated · {formatCount(run.noChange)} no change · {formatCount(run.failed)} failed.</>}><p className={run.interrupted?'error-message':'meta'}>{run.message}</p>{run.conflicts>0 && <p className="error-message">{formatCount(run.conflicts)} identity conflicts cached for review; existing ownership is preserved.</p>}{run.quota && <p className="meta">Provider quota: {Object.entries(run.quota).map(([name,value])=>`${name}: ${value}`).join(' · ')}</p>}</MaintenanceProgress>}
        </section>;
      })}
    </section>)}
    {confirmation && <NativeDialog heading={`Confirm ${confirmation.intent==='populate'?'Populate missing data':'Refresh all data'}`} id="maintenance-confirmation-heading" onClose={()=>setConfirmation(null)}>
      <p>{confirmation.intent==='refresh'?'Existing populated records will be revisited.':'Only actionable unchecked provider work will be requested.'} Completed results are saved even if the run stops.</p><PlanSummary plan={confirmation.plan}/><p className="meta">Film maintenance runs first, then collection rosters. Collection requests may increase after film data is updated. Existing older checkpoints finish their frozen film scope; start a new aggregate run afterward to include rosters.</p>
      <div className="button-set"><Action onClick={()=>setConfirmation(null)}>Cancel</Action><Action icon={RefreshCw} disabled={!writesEnabled || job.locked} onClick={()=>{const selected=confirmation;setConfirmation(null);if(checkpoints[keyFor(selected.intent,'all')])void start(selected.intent,'all',selected.plan);else void startAggregate(selected.intent,selected.plan);}}>Start maintenance</Action></div>
    </NativeDialog>}
  </>;
}
