import type { Catalog, Movie } from './types';
import { missingLiveScoreDimensions } from './ranking';
export type MaintenanceMode = 'missing' | 'refresh' | 'metadata';
export const MAINTENANCE_BATCH_SIZE = 10;
export const METADATA_MAINTENANCE_BATCH_SIZE = 2;
export const MAINTENANCE_IDLE_MS = 2000;
export function maintenanceMovies(catalog: Catalog): Movie[] {
  const history = new Set(catalog.sessions.filter(s => !s.deleted_at).flatMap(s => s.movies.map(m => m.id)));
  return catalog.movies.filter(m => m.classic || history.has(m.id));
}
export function missingScores(movie: Movie) {
  return missingLiveScoreDimensions(movie.scores).length > 0;
}
export function maintenanceIdentity(movie: Movie, mode: MaintenanceMode) {
  return movie.external_ids.some(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id)
    || mode !== 'metadata' && e.provider === 'tmdb' && /^[1-9]\d{0,9}$/.test(e.external_id));
}
