import type { Movie } from './types';

export const TMDB_METADATA_REFRESH_DAYS = 150;
export function tmdbMetadataIsStale(checkedAt: string | null | undefined, now = Date.now()) {
  return !checkedAt || Date.parse(checkedAt) <= now - TMDB_METADATA_REFRESH_DAYS * 24 * 60 * 60 * 1000;
}
export function tmdbIdentity(movie: Movie) {
  const id = movie.external_ids.find(e => e.provider === 'tmdb')?.external_id;
  return id && /^[1-9]\d{0,9}$/.test(id) ? id : undefined;
}
export function metadataCandidate(movie: Movie) {
  return Boolean(tmdbIdentity(movie)) && (tmdbMetadataIsStale(movie.tmdb_metadata_checked_at)
    || (!movie.tmdb_artwork_checked_at && ['poster','backdrop'].some(type =>
      !movie.assets.some(a => a.provider === 'tmdb' && a.asset_type === type))));
}
