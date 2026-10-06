import type { ExternalId, Score } from '../../../shared/types';
import { RatingError, ratingRequest, record } from './ratings';
import { ProviderError } from './http';
// Official Media Info schema: https://api.mdblist.com/schema/ (GET and POST media routes).
const sources: Record<string,[string,string,number]> = {
  imdb: ['imdb','rating',10], tomatoes: ['rottentomatoes','critic',100],
  popcorn: ['rottentomatoes','audience',100], tomatoesaudience: ['rottentomatoes','audience',100],
  audience: ['rottentomatoes','audience',100], letterboxd: ['letterboxd','rating',5],
  metacritic: ['metacritic','critic',100], tmdb: ['tmdb','rating',100],
};
export function parseMdbList(data: unknown, at = new Date().toISOString()): Score[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as {ratings?: unknown}).ratings)) throw new RatingError('MDBList returned an unrecognised ratings response.');
  const scores = new Map<string,Score>();
  for (const item of (data as {ratings: unknown[]}).ratings) {
    if (!item || typeof item !== 'object') continue;
    const r = item as {source?: string; value?: unknown; votes?: unknown};
    const mapping = r.source ? sources[r.source] : undefined; if (!mapping) continue;
    const s = record(mapping[0],mapping[1],r.value,mapping[2],'mdblist',at,r.votes);
    if (s) scores.set(`${s.provider}:${s.metric}`,s);
  }
  return [...scores.values()];
}
export function mdbId(ids: ExternalId[]): ExternalId | undefined {
  return ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id))
    ?? ids.find(e => e.provider === 'tmdb' && /^[1-9]\d*$/.test(e.external_id));
}
export class MdbListProvider {
  constructor(private key: string, private onLimits?: (headers: Headers) => Promise<void>) {}
  async scores(id: ExternalId) {
    return parseMdbList(await ratingRequest(`https://api.mdblist.com/${id.provider}/movie/${encodeURIComponent(id.external_id)}/?apikey=${encodeURIComponent(this.key)}`,'MDBList',undefined,this.onLimits));
  }
  async batch(provider: string, ids: string[]): Promise<Map<string,Score[]>> {
    if (!ids.length || ids.length > 10) throw new RatingError('MDBList batches require 1–10 IDs.');
    let data: unknown;
    try {
      data = await ratingRequest(`https://api.mdblist.com/${provider}/movie/?apikey=${encodeURIComponent(this.key)}`,'MDBList',
        {method: 'POST',headers: {'Content-Type': 'application/json'},body: JSON.stringify({ids: provider === 'tmdb' ? ids.map(Number) : ids})},this.onLimits);
    } catch (error) {
      // A batch endpoint 404 cannot establish that any particular film is missing.
      if (error instanceof ProviderError && error.kind === 'not_found') throw new RatingError('MDBList batch lookup is unavailable. Try later.');
      throw error;
    }
    if (!Array.isArray(data)) throw new RatingError('MDBList returned an unrecognised batch response.');
    const result = new Map<string,Score[]>(), at = new Date().toISOString();
    for (const entry of data) {
      // Live Media Info uses provider-scoped IDs; top-level id is MDBList's own ID.
      // imdb_id is also documented by the official single-item Media Info schema.
      const id = provider === 'imdb' ? entry?.ids?.imdb ?? entry?.imdb_id : entry?.ids?.tmdb;
      if ((typeof id === 'string' || typeof id === 'number' && Number.isSafeInteger(id)) && ids.includes(String(id))) result.set(String(id),parseMdbList(entry,at));
    }
    if (result.size < new Set(ids).size) console.warn('MDBList batch correlation incomplete',{
      provider, requested: new Set(ids).size, returned: data.length, matched: result.size,
      nestedImdb: data.filter(entry => typeof entry?.ids?.imdb === 'string').length,
      nestedTmdb: data.filter(entry => typeof entry?.ids?.tmdb === 'number' || typeof entry?.ids?.tmdb === 'string').length,
      legacyImdb: data.filter(entry => typeof entry?.imdb_id === 'string').length,
    });
    if (result.size < new Set(ids).size) for (const entry of data) {
      const id = provider === 'imdb' ? entry?.ids?.imdb ?? entry?.imdb_id : entry?.ids?.tmdb;
      if (!(typeof id === 'string' || typeof id === 'number' && Number.isSafeInteger(id)))
        throw new RatingError('MDBList returned an unrecognised batch identity response.');
      parseMdbList(entry,at);
    }
    return result;
  }
}
