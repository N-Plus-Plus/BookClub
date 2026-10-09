import type { ExternalId, Score } from '../../../shared/types';
import { RatingError, ratingRequest, record } from './ratings';
import { ProviderError } from './http';
import { parseMdbEnrichment, parseMdbTitle } from './enrichment';
import { maintainedScoreKeys } from '../../../shared/maintenance-contract';
import type { EnrichmentCapture } from '../../../shared/enrichment';
// Official Media Info schema: https://api.mdblist.com/schema/ (GET and POST media routes).
const sources: Record<string,[string,string,number]> = {
  imdb: ['imdb','rating',10], tomatoes: ['rottentomatoes','critic',100],
  popcorn: ['rottentomatoes','audience',100], tomatoesaudience: ['rottentomatoes','audience',100],
  audience: ['rottentomatoes','audience',100], letterboxd: ['letterboxd','rating',5],
  metacritic: ['metacritic','critic',100], tmdb: ['tmdb','rating',100],
  metacriticuser: ['metacritic','user',10], trakt: ['trakt','rating',100],
  rogerebert: ['rogerebert','rating',4],
};
// Media Info GET returns Letterboxd /5; POST batches return /10. Never infer from value.
export function parseMdbList(data: unknown, at = new Date().toISOString(), endpoint: 'single' | 'batch' = 'single'): Score[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as {ratings?: unknown}).ratings)) throw new RatingError('MDBList returned an unrecognised ratings response.');
  const scores = new Map<string,Score>();
  for (const item of (data as {ratings: unknown[]}).ratings) {
    if (!item || typeof item !== 'object') continue;
    const r = item as {source?: string; value?: unknown; votes?: unknown};
    const mapping = r.source ? sources[r.source] : undefined; if (!mapping) continue;
    const scale = r.source === 'letterboxd' && endpoint === 'batch' ? 10 : mapping[2];
    const s = record(mapping[0],mapping[1],r.value,scale,'mdblist',at,r.votes);
    if (s) scores.set(`${s.provider}:${s.metric}`,s);
  }
  return [...scores.values()];
}
/** A valid empty ratings array checks every capability; malformed values check none for that dimension. */
export function mdbCheckedKeys(data:unknown,endpoint:'single'|'batch'='single'):string[]{
  const ratings=(data as {ratings?:unknown})?.ratings;if(!Array.isArray(ratings))return [];
  const checked=new Set<string>(maintainedScoreKeys);
  for(const item of ratings){
    if(!item || typeof item!=='object'){return [];}
    const r=item as {source?:string;value?:unknown},mapping=r.source?sources[r.source]:undefined;
    if(!mapping)continue;
    const empty=r.value===null || r.value==='N/A' || r.value==='';
    if(!empty && !record(mapping[0],mapping[1],r.value,r.source==='letterboxd'&&endpoint==='batch'?10:mapping[2],'mdblist',''))checked.delete(`${mapping[0]}:${mapping[1]}`);
  }
  return [...checked];
}
export function mdbId(ids: ExternalId[]): ExternalId | undefined {
  return ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id))
    ?? ids.find(e => e.provider === 'tmdb' && /^[1-9]\d*$/.test(e.external_id));
}
export class MdbListProvider {
  readonly batchFailures=new Map<string,string>();
  constructor(private key: string, private onLimits?: (headers: Headers) => Promise<void>, private onMedia?: (id: ExternalId,capture: EnrichmentCapture | undefined, title: string | null,checkedKeys?:string[]) => Promise<void>) {}
  async scores(id: ExternalId) {
    const data=await ratingRequest(`https://api.mdblist.com/${id.provider}/movie/${encodeURIComponent(id.external_id)}/?apikey=${encodeURIComponent(this.key)}&append_to_response=keyword`,'MDBList',undefined,this.onLimits);
    const scores=parseMdbList(data), capture=parseMdbEnrichment(data,id,new Date().toISOString());
    await this.onMedia?.(id,capture,parseMdbTitle(data,id),mdbCheckedKeys(data)); return scores;
  }
  async batch(provider: string, ids: string[]): Promise<Map<string,Score[]>> {
    this.batchFailures.clear();
    if (!ids.length || ids.length > 10) throw new RatingError('MDBList batches require 1–10 IDs.');
    let data: unknown;
    try {
      data = await ratingRequest(`https://api.mdblist.com/${provider}/movie/?apikey=${encodeURIComponent(this.key)}`,'MDBList',
        {method: 'POST',headers: {'Content-Type': 'application/json'},body: JSON.stringify({ids: provider === 'tmdb' ? ids.map(Number) : ids,append_to_response:['keyword']})},this.onLimits);
    } catch (error) {
      // A batch endpoint 404 cannot establish that any particular film is missing.
      if (error instanceof ProviderError && error.kind === 'not_found') throw new RatingError('MDBList batch lookup is unavailable. Try later.');
      throw error;
    }
    if (!Array.isArray(data)) throw new RatingError('MDBList returned an unrecognised batch response.');
    const result = new Map<string,Score[]>(), at = new Date().toISOString();
    let uncorrelated=false;
    for (const entry of data) {
      // Live Media Info uses provider-scoped IDs; top-level id is MDBList's own ID.
      // imdb_id is also documented by the official single-item Media Info schema.
      const id = provider === 'imdb' ? entry?.ids?.imdb ?? entry?.imdb_id : entry?.ids?.tmdb;
      if ((typeof id === 'string' || typeof id === 'number' && Number.isSafeInteger(id)) && ids.includes(String(id))) {
        const key=String(id);
        if(result.has(key) || this.batchFailures.has(key)){result.delete(key);this.batchFailures.set(key,'MDBList returned ambiguous or malformed evidence for this identity.');continue;}
        try{result.set(key,parseMdbList(entry,at,'batch'));}
        catch(error){if(!(error instanceof RatingError))throw error;this.batchFailures.set(key,'MDBList returned malformed ratings for this film.');}
      }else if(!(typeof id==='string'||typeof id==='number'&&Number.isSafeInteger(id)))uncorrelated=true;
    }
    if (result.size < new Set(ids).size) console.warn('MDBList batch correlation incomplete',{
      provider, requested: new Set(ids).size, returned: data.length, matched: result.size,
      nestedImdb: data.filter(entry => typeof entry?.ids?.imdb === 'string').length,
      nestedTmdb: data.filter(entry => typeof entry?.ids?.tmdb === 'number' || typeof entry?.ids?.tmdb === 'string').length,
      legacyImdb: data.filter(entry => typeof entry?.imdb_id === 'string').length,
    });
    // Independently correlated successes survive malformed peers. Ambiguous identities
    // never reach callbacks or targeted recovery; omitted requested identities remain bounded.
    if(uncorrelated)for(const id of ids)if(!result.has(id))this.batchFailures.set(id,'MDBList returned unrecognised batch identities; targeted recovery was deferred.');
    if(!result.size && uncorrelated)throw new RatingError('MDBList returned an unrecognised batch identity response.');
    if(!result.size && this.batchFailures.size)throw new RatingError('MDBList returned an unrecognised ratings response.');
    for (const entry of data) {
      const externalId=String(provider === 'imdb' ? entry?.ids?.imdb ?? entry?.imdb_id : entry?.ids?.tmdb);
      if (result.has(externalId)) { const identity={provider,external_id:externalId}; await this.onMedia?.(identity,parseMdbEnrichment(entry,identity,at),parseMdbTitle(entry,identity),mdbCheckedKeys(entry,'batch')); }
    }
    return result;
  }
}
