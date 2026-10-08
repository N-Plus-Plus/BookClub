import type { Catalog, Movie, Session, Score } from './types';
import { latestScores, scoreValue } from './ranking';
import { catalogIndex } from './catalog-index';

// Only immutable analytical snapshots opt into score caching; ordinary mutable fixtures remain uncached.
const resolvedScores = new WeakMap<Movie,Score[]>();
const snapshots = new WeakMap<Catalog,Catalog>();
export function metricsCatalog(source: Catalog): Catalog {
  const existing = snapshots.get(source); if (existing) return existing;
  const movies = source.movies.map(movie => {
    const snapshot = {...movie}; resolvedScores.set(snapshot,latestScores(movie.scores)); return snapshot;
  });
  const byId = new Map(movies.map(movie => [movie.id,movie]));
  const catalog = {...source,movies,sessions:source.sessions.map(session => ({...session,movies:session.movies.map(movie => byId.get(movie.id) ?? movie)}))};
  snapshots.set(source,catalog); return catalog;
}
export const scoresFor = (movie: Movie) => resolvedScores.get(movie) ?? latestScores(movie.scores);
export type MetricsFilter = {kind: 'all'} | {kind: 'member'; memberId: string} | {kind: 'classics'};
export function matchesMetricsFilter(session: Session,filter: MetricsFilter): boolean {
  return !session.deleted_at && (filter.kind === 'all' || (filter.kind === 'classics' ? session.kind === 'classics' : session.kind === 'hosted' && session.host_member_id === filter.memberId));
}
export interface Appearance { movie: Movie; session: Session; position: number; imdb: number | null }
/** Home needs counts and the genuine IMDb mean, without rankings or genre reports. */
export function metricsSummary(catalog: Catalog) {
  const rows=selectedAppearances(catalog);
  return {events:catalog.sessions.filter(session=>matchesMetricsFilter(session,{kind:'all'})).length,appearances:rows.length,imdbAverage:average(rows)};
}
export const average = (rows: Appearance[]) => {
  const scores = rows.flatMap(a => a.imdb === null ? [] : [a.imdb]);
  return scores.length ? scores.reduce((sum,n) => sum+n,0)/scores.length : null;
};
export function selectedAppearances(catalog: Catalog, filter: MetricsFilter = {kind: 'all'}): Appearance[] {
  const sessions = catalog.sessions.filter(s => matchesMetricsFilter(s,filter));
  const canonical = catalogIndex(catalog).movieById;
  const imdbByMovie = new Map<string,number | null>();
  return sessions.flatMap(session => session.movies.map((film,i): Appearance => {
    const movie = canonical.get(film.id) ?? film;
    if (!imdbByMovie.has(movie.id)) {
      const score = scoresFor(movie).find(s => s.provider === 'imdb' && s.metric === 'rating');
      imdbByMovie.set(movie.id,score ? scoreValue(score)!/10 : null);
    }
    return {session,movie,position: i+1,imdb: imdbByMovie.get(movie.id)!};
  }));
}
