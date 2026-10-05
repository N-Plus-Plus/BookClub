import type { Movie } from './types';
import { normalizedGenres } from './genres';

export const TMDB_METADATA_REFRESH_DAYS = 150;
export function tmdbMetadataIsStale(checkedAt: string | null | undefined, now = Date.now()) {
  return !checkedAt || Date.parse(checkedAt) <= now - TMDB_METADATA_REFRESH_DAYS * 24 * 60 * 60 * 1000;
}
export type MetadataIdentity = Pick<Movie, 'external_ids'>;
export type MetadataEligibility = Pick<Movie, 'director' | 'external_ids' | 'assets' | 'tmdb_metadata_checked_at' | 'tmdb_artwork_checked_at'>;
export type MetadataMovie = MetadataEligibility & Pick<Movie, 'id' | 'title' | 'original_title' | 'release_date' | 'runtime' | 'overview' | 'genres'>;
export function tmdbIdentity(movie: MetadataIdentity) {
  const id = movie.external_ids.find(e => e.provider === 'tmdb')?.external_id;
  return id && /^[1-9]\d{0,9}$/.test(id) ? id : undefined;
}
export function metadataCandidate(movie: MetadataEligibility) {
  return Boolean(tmdbIdentity(movie)) && (!movie.director?.trim() || tmdbMetadataIsStale(movie.tmdb_metadata_checked_at)
    || (!movie.tmdb_artwork_checked_at && ['poster','backdrop'].some(type =>
      !movie.assets.some(a => a.provider === 'tmdb' && a.asset_type === type))));
}

export function metadataGaps(movie: MetadataMovie): number {
  return (normalizedGenres(movie.genres).length ? 0 : 10) + [movie.director,movie.original_title,movie.release_date,movie.runtime,movie.overview,
    movie.assets.find(a => a.provider === 'tmdb' && a.asset_type === 'poster'),movie.assets.find(a => a.provider === 'tmdb' && a.asset_type === 'backdrop')].filter(v => !v).length;
}

/** Freeze catalogue eligibility and existing gap/ID priority once per run. */
export function metadataQueue(movies: MetadataMovie[]) {
  return movies.filter(metadataCandidate).sort((a,b) => metadataGaps(b)-metadataGaps(a) || a.id.localeCompare(b.id)).map(m => m.id);
}
