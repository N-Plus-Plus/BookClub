import { useState } from 'react';
import { RefreshCw, RotateCcw, Square } from 'lucide-react';
import type { Catalog } from '../shared/types';
import { enrichmentIdentity, type EnrichmentProvider } from '../shared/enrichment';
import { api } from './api';
import { Action } from './components';
import { useBulkJobController, MaintenanceProgress } from './bulk-maintenance';
import { loadMaintenanceCheckpoint, saveMaintenanceCheckpoint, type MaintenanceCheckpoint } from './maintenance-checkpoint';
import { maintainEnrichment, type EnrichmentRun } from './enrichment-maintenance';

export function EnrichmentMaintenance({provider,catalog,writesEnabled,onUpdated,onCacheChanged}: {onCacheChanged?:()=>void;provider: EnrichmentProvider;catalog:Catalog;writesEnabled:boolean;onUpdated:()=>Promise<void>}) {
  const label=provider==='tmdb'?'TMDB':'MDBList', key=`bookclub.${provider}-enrichment.v1`, job=useBulkJobController();
  const {busy,error,setError,stop}=job;
  const [run,setRun]=useState<EnrichmentRun | null>(null);
  const [checkpoint,setCheckpoint]=useState(()=>loadMaintenanceCheckpoint(key));
  const eligible=catalog.movies.filter(m=>enrichmentIdentity(m.external_ids,provider)), eligibleIds=new Set(eligible.map(m=>m.id));
  const remaining=checkpoint?.remainingIds.filter(id=>eligibleIds.has(id)) ?? [];
  const checkpointChanged=(value: MaintenanceCheckpoint | null)=>{saveMaintenanceCheckpoint(key,value);setCheckpoint(value);};
  const start=()=>job.execute(async()=>{
    const saved: MaintenanceCheckpoint=checkpoint && remaining.length ? {...checkpoint,remainingIds:remaining} : {version:1,remainingIds:eligible.map(m=>m.id),completed:0};
    checkpointChanged(saved);
    let canonicalChanged=false;
    try {
      const result=await maintainEnrichment({provider,checkpoint:saved,batch:async ids=>{const batch=await api.enrichProvider(provider,ids);if(batch.results.some(result=>result.status === 'updated'))onCacheChanged?.();return batch;},stopped:()=>stop.current,
        checkpointChanged,progress:value=>{canonicalChanged ||= value.canonicalChanged;setRun(value);}});
      canonicalChanged ||= result.canonicalChanged;
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not refresh enrichment. Saved work is retained.');}
    finally {
      try {if (canonicalChanged) await onUpdated();}
      catch (e) {setError(e instanceof Error ? e.message : 'Saved identities could not be refreshed. Reload BookClub.');}

    }
  });
  return <section className="card stack classics-maintenance enrichment-maintenance" aria-labelledby={`${provider}-enrichment-heading`}>
    <h2 id={`${provider}-enrichment-heading`}>{label} enrichment cache</h2>
    <p className="meta">Cache provider data for all identified films. Completed updates are saved.</p>
    <p className="meta">{eligible.length} eligible films · {catalog.movies.length-eligible.length} without a valid {label} identity.</p>
    <div className="button-set"><Action icon={RefreshCw} disabled={busy || job.locked || !writesEnabled || !eligible.length} onClick={()=>void start()}>
      {remaining.length ? `Resume ${label} enrichment · ${remaining.length} remaining` : `Refresh ${label} enrichment`}</Action>
      {busy && <Action icon={Square} onClick={job.requestStop}>Stop after this batch</Action>}
      {checkpoint && !busy && <Action icon={RotateCcw} variant="tertiary" disabled={job.locked} onClick={()=>{checkpointChanged(null);setRun(null);}}>Discard {label} progress</Action>}
    </div>
    {run && <MaintenanceProgress processed={run.processed} total={run.total} label={`${label} enrichment progress`} className="score-maintenance-progress" summary={<>{run.processed} / {run.total} processed · {run.remaining} remaining · {run.updated} updated · {run.noChange} no change · {run.failed} failures.</>}>

      {run.message && <p className="meta">{run.message}</p>}
      {run.conflicts>0 && <p className="error-message">{run.conflicts} external identity conflicts cached for review. Existing ownership is preserved.</p>}
      {run.quota?.['X-RateLimit-Remaining'] && <p className="meta">Provider requests remaining: {run.quota['X-RateLimit-Remaining']}{run.quota['X-RateLimit-Limit'] ? ` / ${run.quota['X-RateLimit-Limit']}` : ''}.</p>}
      {run.failure && <p className="error-message">{run.failure}</p>}
    </MaintenanceProgress>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
