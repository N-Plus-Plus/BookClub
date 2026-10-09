import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Square } from 'lucide-react';
import type { CollectionRosterStatus } from '../shared/collection-roster';
import { formatCount } from '../shared/format';
import { maintenanceContract,collectedDescription,maintenanceFieldSummary } from '../shared/maintenance-contract';
import { api } from './api';
import { Action } from './components';
import { MaintenanceProgress, useBulkJobController } from './bulk-maintenance';
import { loadRosterCheckpoint, saveRosterCheckpoint, rosterPlan, reconcileRosterCheckpoint, runRosterMaintenance, type RosterCheckpoint } from './collection-roster-maintenance';

export function CollectionRosterMaintenance({writesEnabled,onEnrichmentChanged}:{writesEnabled:boolean;onEnrichmentChanged?:()=>void}){
  const job=useBulkJobController(),[status,setStatus]=useState<CollectionRosterStatus | null>(null),[readError,setReadError]=useState('');
  const [saved,setSaved]=useState(()=>({populate:loadRosterCheckpoint('populate'),refresh:loadRosterCheckpoint('refresh')}));
  const [active,setActive]=useState<RosterCheckpoint['intent'] | null>(null),[run,setRun]=useState<RosterCheckpoint | null>(null),[failed,setFailed]=useState(0);
  const allowed=useRef(writesEnabled);allowed.current=writesEnabled;
  const reload=async()=>{try{setStatus(await api.collectionRosterStatus());setReadError('');}catch{setReadError('Collection roster controls require the matching schema and API.');}};
  useEffect(()=>{let live=true;Promise.resolve().then(()=>api.collectionRosterStatus()).then(value=>{if(live)setStatus(value);}).catch(()=>{if(live)setReadError('Collection roster controls require the matching schema and API.');});return()=>{live=false;};},[]);
  useEffect(()=>{
    if(!status)return;
    setSaved(previous=>{
      let next=previous;
      for(const intent of ['populate','refresh'] as const){
        const old=previous[intent];if(!old)continue;
        const value=reconcileRosterCheckpoint(old,status);
        if(value.pending.length===old.pending.length)continue;
        saveRosterCheckpoint(value,intent);next={...next,[intent]:value.pending.length?value:null};
      }
      return next;
    });
  },[status]);
  const start=(intent:RosterCheckpoint['intent'])=>job.execute(async()=>{
    if(!allowed.current)return;
    const current=await api.collectionRosterStatus();setStatus(current);
    if(current.unavailable)throw new Error(current.unavailable);
    const checkpoint=saved[intent]?reconcileRosterCheckpoint(saved[intent]!,current):{version:1 as const,intent,startedAt:new Date().toISOString(),pending:rosterPlan(current,intent).ids,completed:0,requests:0};
    setActive(intent);setRun(checkpoint);setFailed(0);let changed=false;
    try{await runRosterMaintenance({checkpoint,batch:(id,startedAt)=>{changed=true;return api.maintainCollectionRosters(intent,[id],startedAt);},stopped:()=>job.stop.current || !allowed.current,changed:()=>{changed=true;},checkpointChanged:value=>{saveRosterCheckpoint(value,intent);setSaved(old=>({...old,[intent]:value.pending.length?value:null}));setRun(value);},progress:(value,failures)=>{setRun(value);setFailed(failures);}});}
    finally{if(changed)onEnrichmentChanged?.();await reload();setActive(null);}
  });
  return <section className="stack maintenance-section" aria-label="Collection roster maintenance"><h2>Collection membership</h2><p className="meta">TMDB rosters for collections with at least two distinct films in active History. One collection per request; no films are imported.</p>
    {status&&<p className="meta">Collection-check evidence: {formatCount(status.collections.filter(c=>!c.checked_at).length)} unchecked/inconclusive · {formatCount(status.collections.filter(c=>c.checked_at).length)} validated rosters · {formatCount(status.unavailable?status.collections.filter(c=>!c.checked_at).length:0)} temporarily blocked.</p>}
    {readError&&<p className="meta" role="status">{readError}</p>}{job.error&&<p className="error-message" role="alert">{job.error}</p>}
    {(['populate','refresh'] as const).map(intent=>{
      const checkpoint=status&&saved[intent]?reconcileRosterCheckpoint(saved[intent]!,status):null,plan=status?rosterPlan(status,intent):null;
      const count=checkpoint?checkpoint.pending.length:plan?.collections ?? 0;
      return <section className="card stack classics-maintenance" key={intent}><h3>{intent==='populate'?'Populate missing collection rosters':'Refresh collection rosters'}</h3>
        <p className="meta maintenance-field-summary">{maintenanceFieldSummary('collection-rosters')}</p>
        <p className="meta">{maintenanceContract['collection-rosters'].scope}</p>
        <p className="meta">{formatCount(count)} eligible collections · {formatCount(count)} BookClub batches · {formatCount(count)} estimated TMDB requests.</p>
        {status?.unavailable&&<p className="meta">{status.unavailable}</p>}
        <div className="action-group action-group-wrap"><Action className="action-wrap" icon={RefreshCw} disabled={!writesEnabled || job.locked || !status || !!status.unavailable || !count} onClick={()=>void start(intent)}>{saved[intent]?'Resume collection checks':intent==='populate'?'Populate missing collection rosters':'Refresh collection rosters'}</Action>
        {active===intent&&<Action icon={Square} disabled={job.stopRequested} onClick={job.requestStop}>Stop after this batch</Action>}</div>
        <details className="utility-disclosure"><summary>Data collected and safeguards</summary><div className="maintenance-details"><p className="meta">{collectedDescription('collection-rosters')}</p><p className="meta">{maintenanceContract['collection-rosters'].scope} {maintenanceContract['collection-rosters'].success} Populate checks only eligible collections without a validated successful roster. Failed or inconclusive checks remain eligible; Refresh revisits every eligible collection. Aggregate actions run this collection-level queue after their seven film operations. These dedicated controls remain independently usable.</p></div></details>
        {run?.intent===intent&&<MaintenanceProgress processed={run.completed} total={run.completed+run.pending.length} label="Collection roster progress" state={job.error?'interrupted':'normal'} summary={`${formatCount(run.completed)} completed · ${formatCount(run.pending.length)} remaining · ${formatCount(run.requests)} measured requests · ${formatCount(failed)} failed checks`}/>}
      </section>;
    })}<Action icon={RefreshCw} disabled={job.locked} onClick={()=>void reload()}>Retry collection coverage</Action>
  </section>;
}
