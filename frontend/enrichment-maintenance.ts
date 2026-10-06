import type { EnrichmentBatch, EnrichmentProvider } from '../shared/enrichment';
import { MAINTENANCE_IDLE_MS } from '../shared/score-maintenance';
import type { MaintenanceCheckpoint } from './maintenance-checkpoint';
export interface EnrichmentRun {
  processed: number; total: number; remaining: number; updated: number; noChange: number; failed: number;
  conflicts: number; failure: string; message: string; canonicalChanged: boolean; quota?: Record<string,string>;
}
export async function maintainEnrichment(options: {
  provider: EnrichmentProvider; checkpoint: MaintenanceCheckpoint; batch: (ids: string[])=>Promise<EnrichmentBatch>;
  stopped: ()=>boolean; progress: (run: EnrichmentRun)=>void; checkpointChanged: (value: MaintenanceCheckpoint | null)=>void;
}) {
  const ids=[...options.checkpoint.remainingIds], initial=options.checkpoint.completed;
  let checkpoint={...options.checkpoint,remainingIds:[...ids]};
  let run: EnrichmentRun={processed:initial,total:initial+ids.length,remaining:ids.length,updated:0,noChange:0,failed:0,conflicts:0,failure:'',message:'',canonicalChanged:false};
  options.progress(run);
  const size=options.provider==='tmdb'?2:10;
  for (let offset=0;offset<ids.length && !options.stopped();offset+=size) {
    const selected=ids.slice(offset,offset+size);
    try {
      const batch=await options.batch(selected);
      if (typeof batch.canonicalChanged!=='boolean' || !Array.isArray(batch.results) || batch.results.some(r=>!selected.includes(r.movieId) || typeof r.message!=='string' || !['updated','no_change','failed','skipped'].includes(r.status))
        || new Set(batch.results.map(r=>r.movieId)).size!==batch.results.length || (!batch.stopped && batch.results.length!==selected.length)) throw new Error('Incomplete enrichment batch. Saved work is retained; resume later.');
      const accepted=new Set(batch.results.filter(r=>r.status!=='failed').map(r=>r.movieId));
      checkpoint={...checkpoint,completed:checkpoint.completed+accepted.size,remainingIds:checkpoint.remainingIds.filter(id=>!accepted.has(id))};
      options.checkpointChanged(checkpoint.remainingIds.length?checkpoint:null);
      const failed=batch.results.filter(r=>r.status==='failed'), conflicts=batch.results.reduce((n,r)=>n+(r.conflicts ?? 0),0);
      run={...run,processed:run.processed+batch.results.length,remaining:checkpoint.remainingIds.length,
        updated:run.updated+batch.results.filter(r=>r.status==='updated').length,noChange:run.noChange+batch.results.filter(r=>r.status==='no_change').length,
        failed:run.failed+failed.length,conflicts:run.conflicts+conflicts,canonicalChanged:run.canonicalChanged || batch.canonicalChanged,quota:batch.quota ?? run.quota,
        failure:failed.length ? `${failed[0].message}${failed[0].retryAfter===undefined ? '' : ` Retry after at least ${failed[0].retryAfter} seconds.`}` : run.failure};
      if (batch.stopped || failed.some(r=>r.blocking!==false || r.retryAfter!==undefined)) run.message='Stopped. Completed updates are saved; review the provider status before resuming.';
      options.progress(run);
      if (run.message || options.stopped()) break;
      if (offset+size<ids.length) await new Promise(resolve=>setTimeout(resolve,MAINTENANCE_IDLE_MS));
    } catch (error) {
      run={...run,message:error instanceof Error ? error.message : 'Enrichment failed. Saved work is retained; resume later.'};options.progress(run);return run;
    }
  }
  run={...run,message:run.message || (options.stopped() ? 'Stopped. Completed updates are saved; resume to continue.' : run.failed ? 'Finished with failures. Saved work is retained; resume to retry failed films.' : 'All queued enrichment is cached.')};
  options.progress(run); return run;
}
