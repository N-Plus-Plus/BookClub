import type { Catalog, RefreshResult, ScoreMaintenance } from '../shared/types';
import { maintenanceIdentity } from '../shared/score-maintenance';
import { maintainScores, type MaintenanceRun } from './score-maintenance';
import { loadMaintenanceCheckpoint, saveMaintenanceCheckpoint, type MaintenanceCheckpoint } from './maintenance-checkpoint';

export const OMDB_CHECKPOINT_KEY = 'bookclub.omdb-metadata.v1';
export type OmdbCheckpoint = MaintenanceCheckpoint;
type StorageAccess = Pick<Storage,'getItem' | 'setItem' | 'removeItem'>;
export function saveOmdbCheckpoint(checkpoint: OmdbCheckpoint | null, storage?: StorageAccess) {
  saveMaintenanceCheckpoint(OMDB_CHECKPOINT_KEY,checkpoint,storage);
}
export function loadOmdbCheckpoint(storage?: StorageAccess): OmdbCheckpoint | null {
  return loadMaintenanceCheckpoint(OMDB_CHECKPOINT_KEY,storage);
}
export function reconcileOmdbCheckpoint(checkpoint: OmdbCheckpoint, catalog: Catalog): OmdbCheckpoint {
  const eligible = new Set(catalog.movies.filter(m => maintenanceIdentity(m,'metadata')).map(m => m.id));
  return {...checkpoint,remainingIds:checkpoint.remainingIds.filter(id => eligible.has(id))};
}
export function freshOmdbCheckpoint(catalog: Catalog): OmdbCheckpoint {
  return {version:1,remainingIds:catalog.movies.filter(m => maintenanceIdentity(m,'metadata')).map(m => m.id),completed:0};
}
/** Accepted batches only: transport/application errors and blocking responses stay pending. */
export async function maintainOmdbMetadata(options: {
  checkpoint: OmdbCheckpoint; batch: (ids: string[]) => Promise<ScoreMaintenance>; stopped: () => boolean;
  progress: (run: MaintenanceRun, batch?: RefreshResult[]) => Promise<void>;
  checkpointChanged: (checkpoint: OmdbCheckpoint | null) => void;
}) {
  let checkpoint = {...options.checkpoint,remainingIds:[...options.checkpoint.remainingIds]};
  const originalCompleted = checkpoint.completed;
  const result = await maintainScores({ids:checkpoint.remainingIds,batch:async ids => {
    const response = await options.batch(ids);
    if (response.results.length !== ids.length || response.results.some((r,i) => r.movie?.id !== ids[i]))
      throw new Error('Metadata batch returned an incomplete or stale response. Refresh BookClub before resuming.');
    // Failed films stay in the checkpoint; a resume may replay successful peers in this bounded batch.
    return {...response,results:response.results.map(r=>({...r,providers:r.providers.map(p=>p.status==='failed' ? {...p,blocking:true} : p)}))};
  },stopped:options.stopped,
    progress:async (run,batch) => {
      const nextCompleted = originalCompleted+run.processed;
      // Apply returned films before acknowledging this batch in durable browser progress.
      await options.progress({...run,processed:checkpoint.completed,total:checkpoint.completed+checkpoint.remainingIds.length,remaining:checkpoint.remainingIds.length},batch);
      if (batch && !run.message) {
        const advanced = nextCompleted-checkpoint.completed;
        checkpoint = {...checkpoint,remainingIds:checkpoint.remainingIds.slice(advanced),completed:nextCompleted};
        options.checkpointChanged(checkpoint.remainingIds.length ? checkpoint : null);
      }
      await options.progress({...run,processed:checkpoint.completed,total:checkpoint.completed+checkpoint.remainingIds.length,remaining:checkpoint.remainingIds.length});
    }});
  return {...result,processed:checkpoint.completed,total:checkpoint.completed+checkpoint.remainingIds.length,remaining:checkpoint.remainingIds.length};
}
