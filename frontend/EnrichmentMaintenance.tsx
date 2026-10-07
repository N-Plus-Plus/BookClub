import { useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Square } from 'lucide-react';
import type { Catalog } from '../shared/types';
import { enrichmentIdentity, type EnrichmentProvider } from '../shared/enrichment';
import { api } from './api';
import { Action } from './components';
import { useBulkMaintenanceLock } from './bulk-maintenance';
import { loadMaintenanceCheckpoint, saveMaintenanceCheckpoint, type MaintenanceCheckpoint } from './maintenance-checkpoint';
import { maintainEnrichment, type EnrichmentRun } from './enrichment-maintenance';

export function EnrichmentMaintenance({provider,catalog,writesEnabled,onUpdated,onCacheChanged}: {onCacheChanged?:()=>void;provider: EnrichmentProvider;catalog:Catalog;writesEnabled:boolean;onUpdated:()=>Promise<void>}) {
  const label=provider==='tmdb'?'TMDB':'MDBList', key=`bookclub.${provider}-enrichment.v1`, lock=useBulkMaintenanceLock();
  const [busy,setBusy]=useState(false), [run,setRun]=useState<EnrichmentRun | null>(null), [error,setError]=useState('');
  const [checkpoint,setCheckpoint]=useState(()=>loadMaintenanceCheckpoint(key));
  const stop=useRef(false), active=useRef(false);
  useEffect(()=>()=>{stop.current=true;},[]);
  const eligible=catalog.movies.filter(m=>enrichmentIdentity(m.external_ids,provider)), eligibleIds=new Set(eligible.map(m=>m.id));
  const remaining=checkpoint?.remainingIds.filter(id=>eligibleIds.has(id)) ?? [];
  const checkpointChanged=(value: MaintenanceCheckpoint | null)=>{saveMaintenanceCheckpoint(key,value);setCheckpoint(value);};
  const start=async()=>{
    if (active.current || !lock.acquire()) return;
    active.current=true;stop.current=false;setBusy(true);setError('');
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
      finally {active.current=false;setBusy(false);lock.release();}
    }
  };
  return <section className="card stack classics-maintenance enrichment-maintenance" aria-labelledby={`${provider}-enrichment-heading`}>
    <h2 id={`${provider}-enrichment-heading`}>{label} enrichment cache</h2>
    <p className="meta">Cache provider data for all identified films. Completed updates are saved.</p>
    <p className="meta">{eligible.length} eligible films · {catalog.movies.length-eligible.length} without a valid {label} identity.</p>
    <div className="button-set"><Action icon={RefreshCw} disabled={busy || lock.busy || !writesEnabled || !eligible.length} onClick={()=>void start()}>
      {remaining.length ? `Resume ${label} enrichment · ${remaining.length} remaining` : `Refresh ${label} enrichment`}</Action>
      {busy && <Action icon={Square} onClick={()=>{stop.current=true;}}>Stop after this batch</Action>}
      {checkpoint && !busy && <Action icon={RotateCcw} variant="tertiary" disabled={lock.busy} onClick={()=>{checkpointChanged(null);setRun(null);}}>Discard {label} progress</Action>}
    </div>
    {run && <div className="stack" role="status"><p className="meta">{run.processed} / {run.total} processed · {run.remaining} remaining · {run.updated} updated · {run.noChange} no change · {run.failed} failures.</p>
      <progress className="score-maintenance-progress" max={Math.max(1,run.total)} value={run.processed} aria-label={`${label} enrichment progress`} />
      {run.message && <p className="meta">{run.message}</p>}
      {run.conflicts>0 && <p className="error-message">{run.conflicts} external identity conflicts cached for review. Existing ownership is preserved.</p>}
      {run.quota?.['X-RateLimit-Remaining'] && <p className="meta">Provider requests remaining: {run.quota['X-RateLimit-Remaining']}{run.quota['X-RateLimit-Limit'] ? ` / ${run.quota['X-RateLimit-Limit']}` : ''}.</p>}
      {run.failure && <p className="error-message">{run.failure}</p>}
    </div>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
