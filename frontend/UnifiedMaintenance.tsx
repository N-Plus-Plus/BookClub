import { useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Square } from 'lucide-react';
import type { Catalog } from '../shared/types';
import { formatCount } from '../shared/format';
import { maintenanceOperations, planMaintenance, type MaintenanceCoverage, type MaintenanceIntent, type MaintenanceOperation, type MaintenancePlan } from '../shared/maintenance-plan';
import { api } from './api';
import { loadMaintenanceCheckpoint, saveMaintenanceCheckpoint } from './maintenance-checkpoint';
import { Action } from './components';
import { NativeDialog } from './NativeDialog';
import { MaintenanceProgress, useBulkJobController } from './bulk-maintenance';
import { loadUnifiedCheckpoint, reconcileUnifiedCheckpoint, runUnifiedMaintenance, saveUnifiedCheckpoint, type UnifiedCheckpoint, type UnifiedRun } from './unified-maintenance';

const names:Record<MaintenanceOperation,string>={scores:'scores','omdb-metadata':'OMDb metadata','tmdb-metadata':'TMDB metadata and artwork','tmdb-enrichment':'TMDB enrichment','mdblist-enrichment':'MDBList enrichment'};
const descriptions:Record<MaintenanceOperation,string>={scores:'Required ranking scores for distinct Classics and active History films. MDBList first, with conditional OMDb and TMDB fallbacks. Score history is retained.','omdb-metadata':'Year, runtime, director, genres and provider title evidence for catalogue films with valid IMDb identities.','tmdb-metadata':'Title evidence, original title, release date, runtime, overview, director, genres, poster and backdrop for valid TMDB identities.','tmdb-enrichment':'Countries, languages, companies, cast and crew, US/AU certifications, keywords, Australian watch availability and provider scalars for all identified catalogue films.','mdblist-enrichment':'Provider title/runtime, keywords and safe external-ID claims for all supported identities. IMDb is preferred; regionless watch data is excluded.'};
const keyFor=(intent:MaintenanceIntent,operation:MaintenanceOperation | 'all')=>`bookclub.maintenance.${intent}.${operation}.v1`;
export async function readMaintenanceCoverage():Promise<MaintenanceCoverage> {
  let after:string | null=null;
  const coverage:MaintenanceCoverage={checks:[],negativeScores:[],enrichment:[],unavailable:{tmdb:null,omdb:null,mdblist:null}},seen=new Set<string>();
  do {
    const page=await api.maintenanceCoverage(after);
    if(!page || !Array.isArray(page.checks) || !Array.isArray(page.enrichment) || !Array.isArray(page.negativeScores) || !page.unavailable) throw new Error('Maintenance coverage is unavailable. Update the API Worker before using these controls.');
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
  const [active,setActive]=useState<string | null>(null),[runs,setRuns]=useState<Record<string,UnifiedRun>>({});
  const [checkpoints,setCheckpoints]=useState<Record<string,UnifiedCheckpoint | null>>(()=>Object.fromEntries((['populate','refresh'] as const).flatMap(intent=>['all',...maintenanceOperations].map(operation=>{const key=keyFor(intent,operation as MaintenanceOperation | 'all');return [key,loadUnifiedCheckpoint(key)];}))));
  const [confirmation,setConfirmation]=useState<{intent:MaintenanceIntent;plan:MaintenancePlan} | null>(null);
  const {setError}=job;
  const allowed=useRef(writesEnabled);allowed.current=writesEnabled;
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
        const saved=coverage && checkpoints[key]?reconcileUnifiedCheckpoint(checkpoints[key]!,catalog,coverage):null;
        const pendingKeys=saved?new Set(saved.pending.map(u=>`${u.movieId}:${u.provider}`)):null;
        const plan=basePlan && pendingKeys ? planMaintenance(catalog,coverage!,intent,operation==='all'?undefined:[operation]) : basePlan;
        // Replan estimates over the frozen remaining catalogue and operations, never add new work on resume.
        if(plan && pendingKeys) {
          plan.units=plan.units.filter(u=>pendingKeys.has(`${u.movieId}:${u.provider}`));plan.batches=plan.batches.map(batch=>batch.filter(u=>pendingKeys.has(`${u.movieId}:${u.provider}`))).filter(batch=>batch.length);plan.films=new Set(plan.units.map(u=>u.movieId)).size;
          plan.calls=plan.calls.map(c=>{const units=plan.units.filter(u=>u.provider===c.provider),batches=plan.batches.filter(b=>b[0].provider===c.provider);return {...c,min:c.provider==='mdblist'?batches.length:units.filter(u=>u.operations.some(o=>o!=='scores')).length,max:c.provider==='mdblist'?batches.length+units.length:units.length*(c.provider==='omdb'?2:1)};});
        }
        const run=runs[key],busy=active===key;
        return <section className="card stack classics-maintenance" key={operation} aria-labelledby={`${intent}-${operation}-heading`}><h3 id={`${intent}-${operation}-heading`}>{title}</h3>
          <p className="meta">{operation==='all'?(intent==='populate'?'Find gaps in stored film information and check the relevant providers. Already-checked unavailable information is skipped.':'Recheck eligible films against the configured providers and reconcile newer information with the stored catalogue.'):descriptions[operation]}</p>
          {loading && <p className="meta" role="status">Loading read-only coverage…</p>}{plan && <PlanSummary plan={plan}/>}
          {saved && <p className="meta">{formatCount(saved.completed)} completed checkpoint work units · {formatCount(saved.pending.length)} remaining.</p>}
          <div className="button-set action-group-wrap"><Action icon={RefreshCw} disabled={!writesEnabled || job.locked || loading || !plan?.units.length} onClick={()=>{if(!plan)return;if(operation==='all')setConfirmation({intent,plan});else void start(intent,operation,plan);}}>{!busy && saved?.pending.length?`Resume ${title}`:title}</Action>
            {busy && <Action icon={Square} onClick={job.requestStop}>Stop after this batch</Action>}
            {checkpoints[key] && !busy && <Action icon={RotateCcw} variant="tertiary" disabled={job.locked} onClick={()=>checkpointChanged(key,null)}>Discard progress</Action>}</div>
          {plan && !plan.units.length && <p className="meta">No actionable work for this operation.</p>}
          <details className="utility-disclosure"><summary>Data collected and safeguards</summary><div className="maintenance-details"><p className="meta">{operation==='all'?'One response per required film/provider supplies compatible canonical metadata, score observations and enrichment. Score scope remains Classics and active History.':descriptions[operation]}</p><p className="meta">Successful empty checks are retained. Populate skips prior successful checks and does not refresh solely because they are old. Refresh revisits eligible records. Canonical title authority, score history and provider identity ownership are preserved. MDBList batches group up to ten identities; TMDB batches contain at most two films. Requests run serially with two-second pauses, persisted cooldowns, the MDBList 25-request reserve and bounded OMDb credential failover.</p>{coverage && Object.entries(coverage.unavailable).filter(([,reason])=>reason).map(([provider,reason])=><p className="meta" key={provider}>{provider}: {reason}</p>)}</div></details>
          {run && <MaintenanceProgress processed={run.processed} total={run.total} label={`${title} progress`} state={run.interrupted?'interrupted':'normal'} summary={<>{run.phase} · {formatCount(run.processed)} / {formatCount(run.total)} film/provider work units completed · {formatCount(run.remaining)} remaining · {formatCount(run.updated)} updated · {formatCount(run.noChange)} no change · {formatCount(run.failed)} failed.</>}><p className={run.interrupted?'error-message':'meta'}>{run.message}</p>{run.conflicts>0 && <p className="error-message">{formatCount(run.conflicts)} identity conflicts cached for review; existing ownership is preserved.</p>}{run.quota && <p className="meta">Provider quota: {Object.entries(run.quota).map(([name,value])=>`${name}: ${value}`).join(' · ')}</p>}</MaintenanceProgress>}
        </section>;
      })}
    </section>)}
    {confirmation && <NativeDialog heading={`Confirm ${confirmation.intent==='populate'?'Populate missing data':'Refresh all data'}`} id="maintenance-confirmation-heading" onClose={()=>setConfirmation(null)}>
      <p>{confirmation.intent==='refresh'?'Existing populated records will be revisited.':'Only actionable unchecked provider work will be requested.'} Completed results are saved even if the run stops.</p><PlanSummary plan={confirmation.plan}/>
      <div className="button-set"><Action onClick={()=>setConfirmation(null)}>Cancel</Action><Action icon={RefreshCw} disabled={!writesEnabled || job.locked} onClick={()=>{const selected=confirmation;setConfirmation(null);void start(selected.intent,'all',selected.plan);}}>Start maintenance</Action></div>
    </NativeDialog>}
  </>;
}
