import type { RefreshResult, ScoreMaintenance } from '../shared/types';
import { MAINTENANCE_BATCH_SIZE } from '../shared/score-maintenance';
export interface MaintenanceRun { results: RefreshResult[]; processed: number; total: number; remaining: number; message: string }
/** A fixed ID queue visits unresolved or unrankable films once, never repeatedly. */
export async function maintainScores(options: {
  ids: string[]; batch: (ids: string[]) => Promise<ScoreMaintenance>; stopped: () => boolean;
  progress: (run: MaintenanceRun) => Promise<void>;
}): Promise<MaintenanceRun> {
  const ids = [...new Set(options.ids)];
  let run: MaintenanceRun = {results:[],processed:0,total:ids.length,remaining:ids.length,message:''};
  for (let offset = 0; offset < ids.length && !options.stopped(); offset += MAINTENANCE_BATCH_SIZE) {
    const selected = ids.slice(offset,offset+MAINTENANCE_BATCH_SIZE);
    try {
      const batch = await options.batch(selected);
      run = {...run,results:[...run.results,...batch.results],processed:offset+selected.length,remaining:ids.length-offset-selected.length};
      if (batch.results.some(r => r.providers.some(p => p.status === 'failed' || p.retryAfter !== undefined)))
        run.message = 'Stopped after a provider failure or cooldown. Completed updates are saved. Review the results and try later.';
      else if (batch.results.some(r => !r.providers.some(p => p.status === 'success')))
        run.message = 'Stopped because no configured provider could update a film. Review provider configuration and identities before resuming.';
      await options.progress(run);
      if (run.message) return run;
    } catch (error) {
      run = {...run,message:`${error instanceof Error ? error.message : 'Maintenance request failed.'} Partial updates may be saved; refresh BookClub before trying again.`};
      await options.progress(run); return run;
    }
    if (offset+selected.length < ids.length) await new Promise(resolve => setTimeout(resolve,1000));
  }
  run = {...run,message:options.stopped() && run.remaining ? 'Stopped. Completed updates are saved.' : 'Finished. Available information is saved; unavailable provider data remains missing.'};
  await options.progress(run); return run;
}
