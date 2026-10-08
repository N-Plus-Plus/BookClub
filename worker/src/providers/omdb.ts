import { parseAwards } from '../../../shared/provider-evidence';
import { ProviderError } from './http';
import { usableTitle } from '../../../shared/titles';
import type { Score } from '../../../shared/types';
import { RatingError, ratingRequest, record } from './ratings';
function omdbFailure(data: unknown): ProviderError | undefined {
  if (!data || typeof data !== 'object') return;
  const d = data as {Response?: unknown; Error?: unknown};
  if (d.Response !== 'False' || typeof d.Error !== 'string') return;
  if (/limit|quota/i.test(d.Error)) return new ProviderError('OMDb','rate_limited','OMDb quota/rate limit reached. Try later.',86400);
  if (/api key/i.test(d.Error)) return new ProviderError('OMDb','credentials','OMDb credentials are unavailable. Contact the administrator.');
}
export function parseOmdb(data: unknown, at = new Date().toISOString()): Score[] {
  if (!data || typeof data !== 'object') throw new RatingError('OMDb returned an unrecognised response.');
  const d = data as {Response?: string; imdbRating?: unknown; imdbVotes?: unknown; Metascore?: unknown; Ratings?: {Source: string; Value: string}[]};
  const failure = omdbFailure(data);
  if (failure) throw failure;
  if (d.Response === 'False') throw new RatingError('OMDb could not supply this film. Check configuration, quota or IMDb ID.');
  if (d.Response !== 'True') throw new RatingError('OMDb returned an unrecognised response.');
  const scores = [record('imdb','rating',d.imdbRating,10,'omdb',at,d.imdbVotes),record('metacritic','critic',d.Metascore,100,'omdb',at)];
  if (Array.isArray(d.Ratings)) {
    const critic = d.Ratings.find(r => r?.Source === 'Rotten Tomatoes');
    if (critic && /^\d+(\.\d+)?%$/.test(critic.Value)) scores.push(record('rottentomatoes','critic',critic.Value.slice(0,-1),100,'omdb',at));
  }
  return scores.filter((s): s is Score => s !== null);
}
export interface OmdbMetadata { title: string | null; year: number | null; runtime: number | null; director: string | null; genres: string[] }
export function parseOmdbMetadata(data: unknown): OmdbMetadata {
  parseOmdb(data); // Validate provider success without inventing missing values.
  const d = data as Record<string,unknown>;
  const year = typeof d.Year === 'string' && /^\d{4}$/.test(d.Year) ? Number(d.Year) : null;
  const runtime = typeof d.Runtime === 'string' && /^\d+ min$/.test(d.Runtime) ? Number(d.Runtime.split(' ')[0]) : null;
  const text = (value: unknown) => typeof value === 'string' && value.trim() && value.trim() !== 'N/A' ? value.trim() : null;
  return {title:usableTitle(d.Title),year:year && year >= 1870 && year <= 2200 ? year : null,runtime:runtime && runtime <= 10000 ? runtime : null,
    director:text(d.Director),genres:text(d.Genre)?.split(',').map(g => g.trim()).filter(Boolean) ?? []};
}
export class OmdbProvider {
  constructor(private key: string, private onLimits?: (headers: Headers) => Promise<void>) {}
  async details(id: string) {
    const data = await ratingRequest(`https://www.omdbapi.com/?apikey=${encodeURIComponent(this.key)}&i=${encodeURIComponent(id)}&type=movie`,'OMDb',undefined,this.onLimits,omdbFailure);
    if (data && typeof data === 'object' && 'imdbID' in data && data.imdbID !== id) throw new ProviderError('OMDb','not_found','OMDb returned a different IMDb identity. Owner review is required.');
    const metadata=parseOmdbMetadata(data);
    if (!(data && typeof data === 'object' && 'imdbID' in data && data.imdbID === id)) metadata.title=null;
    return {scores:parseOmdb(data),metadata,awards:data && typeof data==='object' && 'imdbID' in data && data.imdbID===id ? parseAwards('Awards' in data ? data.Awards : undefined,id,new Date().toISOString()) : undefined};
  }
  async scores(id: string) { return (await this.details(id)).scores; }
}
