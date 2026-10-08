import type { Movie } from '../shared/types';
export function AustralianAvailability({movie,empty = false}: {movie: Movie;empty?: boolean}) {
  const offers=movie.au_watch_offers ?? [];
  if (!offers.length) return empty ? <p className="meta">Australian streaming availability not currently cached</p> : null;
  return <div className="au-availability" aria-label="Cached Australian watch availability">{(['subscription','free','ads','rent','buy'] as const).map(access=>{
    const names=[...new Set(offers.filter(offer=>offer.access_type===access).map(offer=>offer.name))];
    return names.length ? <p key={access} className={access==='rent' || access==='buy' ? 'meta' : undefined}>{({subscription:'Stream',free:'Free',ads:'With ads',rent:'Rent',buy:'Buy'})[access]}: {names.join(' · ')}</p> : null;
  })}</div>;
}
