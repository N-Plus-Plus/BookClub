import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Square } from 'lucide-react';
import type { JobOperation, MaintenanceJob } from '../shared/maintenance-job';
import type { MaintenanceIntent } from '../shared/maintenance-plan';
import { maintenanceContract, maintenanceFieldSummary, aggregateFieldSummary, collectedDescription } from '../shared/maintenance-contract';
import { formatCount } from '../shared/format';
import { api } from './api';
import { Action } from './components';
import { NativeDialog } from './NativeDialog';
import type { LegacyMaintenanceImport } from '../shared/maintenance-legacy';
import { requiredScores } from '../shared/ranking';
import { providerKeys, type MaintenanceUnit } from '../shared/maintenance-plan';
import { MaintenanceProgress, useBulkJobController } from './bulk-maintenance';

let discovery:ReturnType<typeof api.maintenanceJobs>|null=null;
const discover=()=>discovery??=Promise.resolve().then(async()=>{const result=await api.maintenanceJobs(),seen=new Set<string>();let next=result.next;while(next){if(seen.has(next))throw new Error('Job history returned a repeated page.');seen.add(next);const page=await api.maintenanceJobs(next);result.jobs.push(...page.jobs);next=page.next;}return result;}).catch(error=>{discovery=null;throw error;});
export const invalidateMaintenanceDiscovery=()=>{discovery=null;};
const finished=(value:MaintenanceJob)=>['completed','completed_with_issues','cancelled'].includes(value.state);
const labels:Record<MaintenanceJob['state'],string>={planning:'Planning',planning_failed:'Planning interrupted',ready:'Ready',running:'Running',paused:'Paused',awaiting_cooldown:'Awaiting provider recovery',completed:'Completed',completed_with_issues:'Completed with issues',failed:'Paused by an application failure',cancelled:'Cancelled'};

export function DurableMaintenanceControl({intent,operation,writesEnabled,onUpdated,onEnrichmentChanged}:{intent:MaintenanceIntent;operation:JobOperation;writesEnabled:boolean;onUpdated?:()=>Promise<void>;onEnrichmentChanged?:()=>void}){
  const controller=useBulkJobController(),[saved,setSaved]=useState<MaintenanceJob|null>(null),[loading,setLoading]=useState(true),[confirm,setConfirm]=useState(false),[legacy,setLegacy]=useState(false);
  const [history,setHistory]=useState<Awaited<ReturnType<typeof api.maintenanceJobs>>['jobs']>([]);
  const creationId=useRef<string|null>(null);
  const allowed=useRef(writesEnabled);allowed.current=writesEnabled;
  const contract=operation==='all'?null:maintenanceContract[operation];
  const title=operation==='all'?(intent==='populate'?'Populate missing data':'Refresh all data'):`${intent==='populate'?'Populate missing':'Refresh'} ${contract!.name}`;
  const {setError}=controller;
  useEffect(()=>{
    let live=true;
    discover().then(async({jobs})=>{const own=jobs.filter(j=>j.intent===intent&&j.operation===operation).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));if(live)setHistory(own);const latest=own[0];return latest?api.maintenanceJob(latest.id):null;}).then(value=>{if(live)setSaved(value);}).catch(error=>{if(live)setError(error instanceof Error?error.message:'Job status unavailable.');}).finally(()=>{if(live)setLoading(false);});
    // Preserve old browser state verbatim. It is never authoritative for new jobs.
    try{const keys=operation==='collection-rosters'?[`bookclub.collection-rosters.${intent}.v1`]:[`bookclub.maintenance.${intent}.${operation}.v1`,...(operation==='all'?[`bookclub.maintenance.${intent}.all.v2`]:[])];setLegacy(keys.some(key=>localStorage.getItem(key)!==null));}catch{/* Optional old browser storage. */}
    return()=>{live=false;};
  },[intent,operation,setError]);
  const reload=async()=>{invalidateMaintenanceDiscovery();const {jobs}=await discover();const own=jobs.filter(j=>j.intent===intent&&j.operation===operation).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));setHistory(own);setSaved(saved?await api.maintenanceJob(saved.id):own[0]?await api.maintenanceJob(own[0].id):null);};
  const execute=(newRun=false,retry=false,key?:string)=>controller.execute(async()=>{
    if(!allowed.current)return;
    let current=saved;
    if(newRun||!current){creationId.current??=crypto.randomUUID();current=await api.createMaintenanceJob(creationId.current,intent,operation);setSaved(current);creationId.current=null;invalidateMaintenanceDiscovery();}
    if(retry){current=await api.retryMaintenanceJob(current.id,key?[key]:undefined);setSaved(current);}
    if(finished(current))return;
    const claimed=await api.claimMaintenanceJob(current.id);current=claimed.job;setSaved(current);
    try{
      while(!controller.stop.current&&allowed.current){
        current=await (current.planning&&current.planning.stage!=='complete'?api.planMaintenanceJob(current.id,claimed.token):api.stepMaintenanceJob(current.id,claimed.token));setSaved(current);
        onEnrichmentChanged?.();
        if(finished(current)||['paused','failed','awaiting_cooldown','planning_failed'].includes(current.state))break;
        const delay=current.planning&&current.planning.stage!=='complete'?100:2000;
        await new Promise(resolve=>setTimeout(resolve,delay));
      }
      if(controller.stop.current || !allowed.current){await api.stopMaintenanceJob(current.id);current=await (current.planning&&current.planning.stage!=='complete'?api.planMaintenanceJob(current.id,claimed.token):api.stepMaintenanceJob(current.id,claimed.token));setSaved(current);}
    }finally{
      try{setSaved(await api.releaseMaintenanceJob(current.id,claimed.token));}finally{invalidateMaintenanceDiscovery();onEnrichmentChanged?.();await onUpdated?.();}
    }
  });
  const stop=()=>{controller.requestStop();if(saved)void api.stopMaintenanceJob(saved.id).catch(error=>setError(error instanceof Error?error.message:'Stop request could not be persisted.'));};
  const recoverLegacy=()=>controller.execute(async()=>{
    const filmKey=`bookclub.maintenance.${intent}.${operation}.v1`,aggregateKey=`bookclub.maintenance.${intent}.all.v2`,rosterKey=`bookclub.collection-rosters.${intent}.v1`;
    const raw=JSON.parse(localStorage.getItem(operation==='collection-rosters'?rosterKey:operation==='all'&&localStorage.getItem(aggregateKey)?aggregateKey:filmKey)??'null');
    if(!raw || raw.intent!==intent)throw new Error('Legacy checkpoint needs owner review. Its original browser data remains unchanged.');
    const aggregate=raw.version===2,films=aggregate?raw.films:operation==='collection-rosters'?null:raw,rosters=aggregate?raw.rosters:operation==='collection-rosters'?raw:null;
    if(films && (films.version!==1||!Array.isArray(films.pending)||films.pending.length>3000)||rosters&&(!Array.isArray(rosters.pending)||rosters.pending.length>3000))throw new Error('Legacy checkpoint is invalid or exceeds the bounded import size. It is retained for owner review.');
    const value:LegacyMaintenanceImport={id:crypto.randomUUID(),intent,operation,startedAt:films?.startedAt??rosters?.startedAt,phase:aggregate?raw.phase:operation==='collection-rosters'?'collections':'films',filmOnly:!aggregate&&operation==='all',rosterStartedAt:rosters?.startedAt??null,
      units:(films?.pending??[]).map((u:MaintenanceUnit)=>[u.movieId,u.provider,u.identity.provider,u.identity.external_id,u.operations,u.scoreKeys??(u.operations.includes('scores')?requiredScores.filter(key=>providerKeys[u.provider].includes(key)):[])]),collections:rosters?.pending??[]};
    setSaved(await api.importMaintenanceJob(value));invalidateMaintenanceDiscovery();
  });
  const readIssues=async()=>{if(!saved)return;let current=saved;while(current.issuesNext){const page=await api.maintenanceJob(saved.id,current.issuesNext);current={...current,issues:[...current.issues,...page.issues],issuesNext:page.issuesNext};}setSaved(current);};
  const planning=saved?.planning&&saved.planning.stage!=='complete'?saved.planning:null;
  const c=saved?.counts,total=c?c.pending+c.running+c.successful+c.skipped+c.deferred+c.blocked:0;
  return <section className="card stack classics-maintenance" aria-label={title}><h3 id={`${intent}-${operation}-heading`}>{title}</h3>
    <p className="meta maintenance-field-summary">{operation==='all'?aggregateFieldSummary():maintenanceFieldSummary(operation)}</p>
    <p className="meta">{contract?.scope??'Film maintenance runs first, then collection rosters are planned from successfully committed collection evidence. Deferred films do not prevent known eligible collections from being checked.'}</p>
    {loading&&<p className="meta" role="status">Loading saved server progress…</p>}
    {controller.error&&<p className="error-message" role="alert">{controller.error}</p>}
    {saved&&c&&<MaintenanceProgress processed={planning?planning.processed:c.successful+c.skipped+c.deferred} total={planning?planning.total:total} label={`${title} progress`} state={['planning_failed','failed','awaiting_cooldown','paused'].includes(saved.state)?'interrupted':'normal'} summary={planning?`${labels[saved.state]} · ${planning.stage==='films'?'Films':'Collections'} reviewed: ${formatCount(planning.processed)} / ${formatCount(planning.total)} · Work scope is being prepared.`:`${labels[saved.state]} · ${saved.phase==='films'?'Film maintenance':'Collection rosters'}${saved.provider?' ('+saved.provider+')':''} · ${formatCount(c.successful)} successful · ${formatCount(c.no_change)} checked with no change · ${formatCount(c.skipped)} skipped · ${formatCount(c.deferred)} deferred · ${formatCount(c.pending+c.running)} unfinished · ${formatCount(c.blocked)} temporarily blocked · ${formatCount(saved.requests)} upstream attempts`}>
      {planning&&<p className="meta">No provider requests are made during planning. Resume planning continues the saved run.</p>}
      {planning?.diagnostic&&<p className="error-message">{planning.diagnostic}</p>}
      <p className="meta">Original run: {new Date(saved.started_at).toLocaleString()}.</p>{saved.diagnostic&&<p className="error-message">{saved.diagnostic}</p>}
      {saved.state==='completed_with_issues'&&<p className="meta">All executable work was processed. Deferred records were not successfully refreshed and remain available for Retry failed.</p>}
      {saved.lease.active&&!controller.busy&&<p className="meta">Maintenance is owned by {saved.lease.owner??'another browser'}. An interrupted lease is recoverable after {new Date(saved.lease.expiresAt).toLocaleTimeString()}.</p>}
    </MaintenanceProgress>}
    <div className="button-set action-group-wrap">
      {!saved&&<Action icon={RefreshCw} disabled={!writesEnabled||controller.locked||loading||legacy||!!controller.error} onClick={()=>operation==='all'?setConfirm(true):void execute(true)}>{title}</Action>}
      {saved&&!finished(saved)&&<Action icon={RefreshCw} disabled={!writesEnabled||controller.locked||saved.lease.active} onClick={()=>void execute()}>{planning?'Resume planning':'Resume remaining'}</Action>}
      {saved&&c&&c.deferred>0&&<Action icon={RefreshCw} disabled={!writesEnabled||controller.locked||saved.lease.active||saved.issues.every(i=>i.retryAt&&i.retryAt>new Date().toISOString())} onClick={()=>void execute(false,true)}>Retry failed</Action>}
      {saved&&finished(saved)&&<Action icon={RefreshCw} disabled={!writesEnabled||controller.locked||saved.lease.active} onClick={()=>setConfirm(true)}>Start new run</Action>}
      {controller.busy&&<Action icon={Square} disabled={controller.stopRequested} onClick={stop}>Stop after current batch</Action>}
      <Action variant="tertiary" disabled={controller.busy} onClick={()=>void controller.execute(reload)}>Reload job status</Action>
    </div>
    {saved&&saved.issues.length>0&&<details className="utility-disclosure"><summary>View issues ({formatCount(c!.deferred+c!.blocked)})</summary><div className="maintenance-details">{saved.issues.map(issue=><div className="stack" key={issue.key}><p className="meta">{issue.movieId?`Film ${issue.movieId}`:`Collection ${issue.collectionId}`} · {issue.provider} · {issue.operations.join(', ')} · {issue.category} · {issue.message} · {issue.attempts} execution attempts{issue.retryAt?` · Retry eligible after ${new Date(issue.retryAt).toLocaleString()}`:''}</p>{issue.category!=='provider'&&<Action variant="tertiary" disabled={!writesEnabled||controller.locked||saved.lease.active||!!issue.retryAt&&issue.retryAt>new Date().toISOString()} onClick={()=>void execute(false,true,issue.key)}>Retry this issue</Action>}</div>)}{saved.issuesNext&&<Action variant="tertiary" onClick={()=>void controller.execute(readIssues)}>Load remaining issues</Action>}</div></details>}
    {legacy&&!saved&&<><p className="meta">An older browser checkpoint is retained unchanged. Import its original scope into a server job before resuming. Identities and permissions are validated again; old film-only runs remain film-only. Server jobs take precedence.</p><Action disabled={!writesEnabled||controller.locked} onClick={()=>void recoverLegacy()}>Recover legacy progress</Action></>}
    {history.some(j=>j.id!==saved?.id)&&<details className="utility-disclosure"><summary>Earlier runs</summary><div className="maintenance-details">{history.filter(j=>j.id!==saved?.id).map(j=><Action key={j.id} variant="tertiary" disabled={controller.locked} onClick={()=>void controller.execute(async()=>setSaved(await api.maintenanceJob(j.id)))}>{labels[j.state]} · {new Date(j.updated_at).toLocaleString()}</Action>)}</div></details>}
    <details className="utility-disclosure"><summary>Data collected and safeguards</summary><div className="maintenance-details"><p className="meta">{operation==='all'?'The aggregate covers all seven film-level operations, followed by collection rosters as a second phase.':collectedDescription(operation)} {contract?.success}</p>{operation==='all'&&Object.entries(maintenanceContract).map(([key])=><p className="meta" key={key}>{collectedDescription(key as keyof typeof maintenanceContract)}</p>)}{operation==='collection-rosters'&&<p className="meta">Aggregate actions run this collection-level queue after their seven film operations.</p>}<p className="meta">Progress and unresolved issues are stored on the server and can be recovered from another device. Resume remaining preserves the original scope and skips committed successful evidence. Retry failed revisits deferred work only, with a one-minute minimum between explicit attempts. Closing this page stops dispatching batches; maintenance does not run in the background. Quotas and provider cooldowns still apply.</p></div></details>
    {confirm&&<NativeDialog heading={`Confirm ${title}`} id={`maintenance-${intent}-${operation}-confirmation`} onClose={()=>setConfirm(false)}><p>Start a new frozen maintenance run? Existing successful provider evidence and job history are retained.</p><div className="button-set"><Action onClick={()=>setConfirm(false)}>Cancel</Action><Action disabled={!writesEnabled||controller.locked} onClick={()=>{setConfirm(false);void execute(true);}}>Start new run</Action></div></NativeDialog>}
  </section>;
}
