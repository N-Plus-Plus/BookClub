import type { Catalog, CompactCatalog } from './types';
/** Resolve ordered references once, keeping canonical object identity in History. */
export function hydrateCatalog(wire:CompactCatalog): Catalog {
  const movies = new Map(wire.movies.map(movie => [movie.id,movie]));
  return {...wire,sessions:wire.sessions.map(({movie_ids,...session}) => ({...session,movies:movie_ids.map(id => {
    const movie = movies.get(id);
    if (!movie) throw new Error('Catalogue contains an unknown film reference.');
    return movie;
  })}))};
}
