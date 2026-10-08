import type { Catalog, Cycle, Member, Movie, Session } from './types';

export interface CatalogIndex {
  movieById: ReadonlyMap<string,Movie>;
  memberById: ReadonlyMap<string,Member>;
  cycleById: ReadonlyMap<string,Cycle>;
  sessionById: ReadonlyMap<string,Session>;
  historyMovieIds: ReadonlySet<string>;
}
const indexes = new WeakMap<Catalog,CatalogIndex>();

/** Catalog snapshots are replaced, never mutated: identity is the invalidation boundary. */
export function catalogIndex(catalog:Catalog): CatalogIndex {
  const cached = indexes.get(catalog);
  if (cached) return cached;
  const sessions = catalog.sessions.filter(session => !session.deleted_at);
  const index: CatalogIndex = {
    movieById:new Map(catalog.movies.map(movie => [movie.id,movie])),
    memberById:new Map(catalog.members.map(member => [member.id,member])),
    cycleById:new Map(catalog.cycles.map(cycle => [cycle.id,cycle])),
    sessionById:new Map(sessions.map(session => [session.id,session])),
    historyMovieIds:new Set(sessions.flatMap(session => session.movies.map(movie => movie.id))),
  };
  indexes.set(catalog,index);
  return index;
}
