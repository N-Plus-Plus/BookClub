import type { Movie } from '../shared/types';
import { availabilityProviderName } from './availability-provider-name';
export function AustralianAvailability({movie,empty = false,showAds = true}: {movie: Movie;empty?: boolean;showAds?: boolean}) {
  const offers=movie.au_watch_offers ?? [];
  if (!offers.length) return empty ? <p className="meta">Australian streaming availability not currently cached</p> : null;
  const displayed=offers.filter(offer=>offer.access_type!=='buy' && (showAds || offer.access_type!=='ads'));
  if (!displayed.length) return empty ? <p className="meta">No cached Australian streaming or rental options to display</p> : null;
  return <div className="au-availability" aria-label="Cached Australian watch availability">{(['subscription','free','ads','rent'] as const).map(access=>{
    const names=[...new Set(displayed.filter(offer=>offer.access_type===access).map(offer=>availabilityProviderName(offer.name)))];
    return names.length ? <p key={access} className={access==='subscription' || access==='rent' ? 'meta' : undefined}>{({subscription:'Stream',free:'Free',ads:'With ads',rent:'Rent'})[access]}: {names.join(' · ')}</p> : null;
  })}</div>;
}
