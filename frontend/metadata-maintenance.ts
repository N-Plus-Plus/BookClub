import { MAINTENANCE_IDLE_MS } from '../shared/score-maintenance';
import type { MetadataEnrichment } from '../shared/types';

export interface MetadataRun extends Omit<MetadataEnrichment,'results'> { processed: number; updated: number; failed: number; failure: string; total: number; message: string }
/** Await every bounded request and local progress update before considering another. */
export async function maintainMetadata(options: {
  batch: () => Promise<MetadataEnrichment>; stopped: () => boolean;
  progress: (run: MetadataRun) => Promise<void>; initial: Pick<MetadataEnrichment,'remaining'|'unidentified'>;
}): Promise<MetadataRun> {
  let run: MetadataRun = {...options.initial,processed:0,updated:0,failed:0,failure:'',total:options.initial.remaining,message:''};
  // The initial catalogue can be stale; only compare authoritative batch responses.
  let previousRemaining: number | undefined;
  while (!options.stopped()) {
    let batch: MetadataEnrichment;
    try { batch = await options.batch(); }
    catch (error) {
      run = {...run,message:`${error instanceof Error ? error.message : 'Metadata request failed.'} Partial updates may have been saved. Resume later to check remaining work.`};
      await options.progress(run); return run;
    }
    run = {remaining:batch.remaining,unidentified:batch.unidentified,processed:run.processed+batch.results.length,
      updated:run.updated+batch.results.filter(r => r.status === 'success').length,failed:run.failed+batch.results.filter(r => r.status !== 'success').length,
      total:Math.max(run.total,run.processed+batch.results.length+batch.remaining),failure:batch.results.filter(r => r.status !== 'success').map(r => `${r.provider} · ${r.status}: ${r.message}${r.retryAfter !== undefined ? ` Retry after at least ${r.retryAfter} seconds.` : ''}`).filter((v,i,a) => a.indexOf(v) === i).slice(0,1).join(''),message:''};
    if (batch.results.some(r => r.status !== 'success')) run.message = 'Stopped after a failed update. Completed updates are saved; review the failure and resume later.';
    else if (!batch.remaining) run.message = 'All available metadata is checked. Films without a valid TMDB identity need identification first.';
    else if (!batch.results.length || (previousRemaining !== undefined && batch.remaining >= previousRemaining)) run.message = 'Stopped because this batch made no progress. Review remaining films before resuming.';
    previousRemaining = batch.remaining;
    await options.progress(run);
    if (run.message || options.stopped()) break;
    // Yield between requests so Stop and navigation can take effect.
    await new Promise(resolve => setTimeout(resolve,MAINTENANCE_IDLE_MS));
  }
  if (options.stopped() && run.remaining) {
    run = {...run,message:'Stopped. Completed updates are saved; resume later to continue remaining films.'};
    await options.progress(run);
  }
  return run;
}
