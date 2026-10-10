import type { Catalog, Movie } from './types';
export type MaintenanceMode = 'missing' | 'refresh' | 'metadata';
export const METADATA_MAINTENANCE_BATCH_SIZE = 2;
export function maintenanceMovies(catalog: Catalog, scoreEligibleIds: readonly string[] = []): Movie[] {
  const history = new Set(catalog.sessions.filter(s => !s.deleted_at).flatMap(s => s.movies.map(m => m.id)));
  const eligible = new Set(scoreEligibleIds);
  return [...new Map(catalog.movies.filter(m => m.classic || history.has(m.id) || eligible.has(m.id)).map(m => [m.id,m])).values()];
}
