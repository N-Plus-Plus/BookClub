import type { Movie, TmdbPreview } from '../shared/types';
import type { ReactNode } from 'react';
import { Poster } from './components';

export function FilmIdentity({movie,children}: {movie: Pick<Movie,'title'|'original_title'|'year'|'runtime'|'release_date'|'genres'|'overview'|'assets'> | TmdbPreview; children?: ReactNode}) {
  const backdrop = movie.assets.find(asset => asset.asset_type === 'backdrop');
  return <>{backdrop && <img className="film-backdrop" src={backdrop.reference} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
    <section className="card detail-header"><Poster movie={movie} large /><div><h2>{movie.title}</h2>{movie.original_title && movie.original_title !== movie.title && <p>Original title: {movie.original_title}</p>}<p>{movie.year ?? 'Year unknown'} · {movie.runtime ? `${movie.runtime} min` : 'Runtime unknown'}</p><p className="meta">Release: {movie.release_date ?? 'Not recorded'}</p>{'director' in movie && <p className="meta">Director: {movie.director ?? 'Unknown'}</p>}<p>{movie.genres.join(' · ') || 'Genres not recorded'}</p><p>{movie.overview || 'No overview available yet.'}</p>{children}</div></section></>;
}
