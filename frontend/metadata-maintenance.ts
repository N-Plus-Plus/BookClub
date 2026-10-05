import { MAINTENANCE_IDLE_MS, METADATA_MAINTENANCE_BATCH_SIZE } from '../shared/score-maintenance';
import type { SelectedMetadataEnrichment } from '../shared/types';

export interface MetadataRun { remaining: number; unidentified: number; processed: number; updated: number; failed: number; failure: string; total: number; message: string }
/** Queue eligibility is frozen before the first request. Retain only aggregate progress. */
export async function maintainMetadata(options: {
  ids: string[]; unidentified: number; batch: (ids: string[]) => Promise<SelectedMetadataEnrichment>; stopped: () => boolean;
  progress: (run: MetadataRun) => Promise<void>;
}): Promise<MetadataRun> {
  const ids = [...options.ids];
  let run: MetadataRun = {remaining:ids.length,unidentified:options.unidentified,processed:0,updated:0,failed:0,failure:'',total:ids.length,message:''};
  for (let offset = 0; offset < ids.length && !options.stopped(); offset += METADATA_MAINTENANCE_BATCH_SIZE) {
    const selected = ids.slice(offset,offset+METADATA_MAINTENANCE_BATCH_SIZE);
    let batch: SelectedMetadataEnrichment;
    try { batch = await options.batch(selected); }
    catch (error) {
      run = {...run,message:`${error instanceof Error ? error.message : 'Metadata request failed.'} Partial updates may have been saved. Resume later to check remaining work.`};
      await options.progress(run); return run;
    }
    const failures = batch.results.filter(r => r.status === 'failed' || r.status === 'conflict');
    const processed = run.processed + Math.min(selected.length,batch.results.length);
    run = {...run,remaining:ids.length-processed,processed,
      updated:run.updated+batch.results.filter(r => r.status === 'success').length,failed:run.failed+failures.length,
      failure:failures.slice(0,1).map(r => `${r.provider} · ${r.status}: ${r.message}${r.retryAfter !== undefined ? ` Retry after at least ${r.retryAfter} seconds.` : ''}`).join(''),message:''};
    if (failures.length) run.message = 'Stopped after a failed update. Completed updates are saved; review the failure and resume later.';
    else if (batch.results.length < selected.length) run.message = 'Stopped because this batch made no progress. Review remaining films before resuming.';
    else if (!run.remaining) run.message = 'All queued metadata is checked. Films without a valid TMDB identity need identification first.';
    await options.progress(run);
    if (run.message || options.stopped()) break;
    await new Promise(resolve => setTimeout(resolve,MAINTENANCE_IDLE_MS));
  }
  if (options.stopped() && run.remaining) {
    run = {...run,message:'Stopped. Completed updates are saved; resume later to continue remaining films.'};
    await options.progress(run);
  }
  return run;
}
