import type { Movie, TmdbPreview } from '../shared/types';
import type { ReactNode } from 'react';
import { Poster } from './components';

export function runtimeLabel(minutes: number | null) {
  if (!minutes) return 'Unknown';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return [hours ? `${hours} ${hours === 1 ? 'hr' : 'hrs'}` : '', remainder ? `${remainder} ${remainder === 1 ? 'min' : 'mins'}` : ''].filter(Boolean).join(', ');
}

export function FilmIdentity({movie,children,variant,beforeOverview}: {movie: Pick<Movie,'title'|'original_title'|'year'|'runtime'|'release_date'|'genres'|'overview'|'assets'|'director'> | TmdbPreview; children?: ReactNode; beforeOverview?: ReactNode; variant?: 'detail'}) {
  const backdrop = movie.assets.find(asset => asset.asset_type === 'backdrop');
  return <>{backdrop && <img className="film-backdrop" src={backdrop.reference} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
    <section className={variant === 'detail' ? 'card detail-header detail-identity' : 'card detail-header'}><Poster movie={movie} large /><div className="film-identity-metadata"><h2>{movie.title}</h2>{movie.original_title && movie.original_title !== movie.title && <p>Original title: {movie.original_title}</p>}{variant === 'detail' ? <p className="meta">Runtime: {runtimeLabel(movie.runtime)}</p> : <p>{movie.year ?? 'Year unknown'} · {movie.runtime ? `${movie.runtime} min` : 'Runtime unknown'}</p>}<p className="meta">Release: {movie.release_date ?? 'Not recorded'}</p>{'director' in movie && <p className="meta">Director: {movie.director ?? 'Unknown'}</p>}<p>{movie.genres.join(' · ') || 'Genres not recorded'}</p>{variant !== 'detail' && <><p>{movie.overview || 'No overview available yet.'}</p>{children}</>}</div>{variant === 'detail' && <>{beforeOverview}<p className="detail-overview">{movie.overview || 'No overview available yet.'}</p>{children}</>}</section></>;
}
