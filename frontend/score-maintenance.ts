import { formatCount } from '../shared/format';
import type { RefreshResult, ScoreMaintenance, ProviderResult } from '../shared/types';
import { MAINTENANCE_BATCH_SIZE, MAINTENANCE_IDLE_MS } from '../shared/score-maintenance';
export type MaintenanceProviderResult = ProviderResult & {filmTitle?: string};
export interface MaintenanceRun { updated: number; noChange: number; failed: number; providers: MaintenanceProviderResult[]; processed: number; total: number; remaining: number; message: string }
/** A fixed ID queue visits unresolved or unrankable films once, never repeatedly. */
export async function maintainScores(options: {
  ids: string[]; batch: (ids: string[]) => Promise<ScoreMaintenance>; stopped: () => boolean;
  progress: (run: MaintenanceRun, batch?: RefreshResult[]) => Promise<void>;
}): Promise<MaintenanceRun> {
  const ids = [...new Set(options.ids)];
  let run: MaintenanceRun = {updated:0,noChange:0,failed:0,providers:[],processed:0,total:ids.length,remaining:ids.length,message:''};
  for (let offset = 0; offset < ids.length && !options.stopped(); offset += MAINTENANCE_BATCH_SIZE) {
    const selected = ids.slice(offset,offset+MAINTENANCE_BATCH_SIZE);
    try {
      const batch = await options.batch(selected);
      run = {...run,updated:run.updated+batch.results.filter(r => r.providers.some(p => p.status === 'success' && p.count > 0)).length,
        noChange:run.noChange+batch.results.filter(r => !r.providers.some(p => p.count > 0)).length,
        failed:run.failed+batch.results.filter(r => r.providers.some(p => p.status === 'failed')).length,
        providers:[...new Map([...run.providers,...batch.results.flatMap(r => r.providers.filter(p => p.status !== 'success' || p.count === 0).map(p => p.status === 'failed' ? {...p,filmTitle:r.movie.title} : p))].map(p => [`${p.provider}:${p.status}:${'filmTitle' in p ? p.filmTitle : ''}`,p])).values()],processed:offset+selected.length,remaining:ids.length-offset-selected.length};
      if (batch.results.some(r => r.providers.some(p => p.blocking === true || p.status === 'failed' && p.blocking !== false || p.retryAfter !== undefined)))
        run.message = 'Stopped after a provider failure or cooldown. Completed updates are saved. Review the provider summary and try later.';
      else if (batch.results.some(r => !r.providers.some(p => p.status === 'success' || p.status === 'failed' && p.blocking === false)))
        run.message = 'Stopped because no configured provider could update a film. Review provider configuration and identities before resuming.';
      await options.progress(run,batch.results);
      if (run.message) return run;
    } catch (error) {
      run = {...run,message:`${error instanceof Error ? error.message : 'Maintenance request failed.'} Partial updates may be saved; refresh BookClub before trying again.`};
      await options.progress(run); return run;
    }
    if (!options.stopped() && offset+selected.length < ids.length) await new Promise(resolve => setTimeout(resolve,MAINTENANCE_IDLE_MS));
  }
  run = {...run,message:options.stopped() && run.remaining ? 'Stopped. Completed updates are saved.' : run.failed ? `Finished with ${formatCount(run.failed)} unresolved film${run.failed === 1 ? '' : 's'}. Completed updates are saved.` : 'Finished. Available information is saved; unavailable provider data remains missing.'};
  await options.progress(run); return run;
}
