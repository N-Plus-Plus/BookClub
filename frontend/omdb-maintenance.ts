import type { Catalog, RefreshResult, ScoreMaintenance } from '../shared/types';
import { maintenanceIdentity, maintenanceMovies } from '../shared/score-maintenance';
import { maintainScores, type MaintenanceRun } from './score-maintenance';

export const OMDB_CHECKPOINT_KEY = 'bookclub.omdb-metadata.v1';
export interface OmdbCheckpoint { version: 1; remainingIds: string[]; completed: number }
type StorageAccess = Pick<Storage,'getItem' | 'setItem' | 'removeItem'>;
const browserStorage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
export function saveOmdbCheckpoint(checkpoint: OmdbCheckpoint | null, storage: StorageAccess | undefined = browserStorage()) {
  try {
    if (checkpoint?.remainingIds.length) storage?.setItem(OMDB_CHECKPOINT_KEY,JSON.stringify(checkpoint));
    else storage?.removeItem(OMDB_CHECKPOINT_KEY);
  } catch { /* Storage denial must not interrupt maintenance. */ }
}
export function loadOmdbCheckpoint(storage: StorageAccess | undefined = browserStorage()): OmdbCheckpoint | null {
  try {
    const raw = storage?.getItem(OMDB_CHECKPOINT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.remainingIds) || !value.remainingIds.length
      || value.remainingIds.length > 100000 || !value.remainingIds.every((id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id))
      || new Set(value.remainingIds).size !== value.remainingIds.length || !Number.isSafeInteger(value.completed) || value.completed < 0
      || value.completed > 100000 || Object.keys(value).some(key => !['version','remainingIds','completed'].includes(key))) {
      saveOmdbCheckpoint(null,storage); return null;
    }
    return {version:1,remainingIds:value.remainingIds,completed:value.completed};
  } catch { saveOmdbCheckpoint(null,storage); return null; }
}
export function reconcileOmdbCheckpoint(checkpoint: OmdbCheckpoint, catalog: Catalog): OmdbCheckpoint {
  const eligible = new Set(maintenanceMovies(catalog).filter(m => maintenanceIdentity(m,'metadata')).map(m => m.id));
  return {...checkpoint,remainingIds:checkpoint.remainingIds.filter(id => eligible.has(id))};
}
export function freshOmdbCheckpoint(catalog: Catalog): OmdbCheckpoint {
  return {version:1,remainingIds:maintenanceMovies(catalog).filter(m => maintenanceIdentity(m,'metadata')).map(m => m.id),completed:0};
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
    return response;
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
