import type { MovieArtworkProvider, MovieMetadataProvider, MovieScoreProvider, MovieSearchProvider, ProviderMovie } from './types';
import type { SearchResult, TmdbPreview } from '../../../shared/types';
import { ApiError } from '../http';
import { record } from './ratings';
import { providerJson } from './http';
import { parseTmdbEnrichment } from './enrichment';
import { usableTitle } from '../../../shared/titles';

interface TmdbFilm {
  id: number; title: string; original_title: string; release_date?: string; runtime?: number;
  overview?: string; poster_path?: string; backdrop_path?: string; genres?: { name: string }[];
  vote_average: number; vote_count: number; external_ids?: { imdb_id?: string };
  credits?: {crew?: {job: string; name: string}[]};
}
export function directors(crew: {job: string; name: string}[] = []): string | null {
  const names = [...new Set((Array.isArray(crew) ? crew : []).filter(person => person?.job === 'Director' && typeof person.name==='string').map(person => person.name.trim()).filter(Boolean))];
  return names.length ? new Intl.ListFormat('en-AU',{style:'long',type:'conjunction'}).format(names) : null;
}
export class TmdbProvider implements MovieSearchProvider, MovieMetadataProvider, MovieArtworkProvider, MovieScoreProvider {
  constructor(private token: string,private onLimits?: (headers: Headers) => Promise<void>) {}
  private async request<T>(path: string): Promise<T> {
    return providerJson(`https://api.themoviedb.org/3/${path}`,'TMDB',{headers:{Authorization:`Bearer ${this.token}`}},this.onLimits) as Promise<T>;
  }
  async search(query: string): Promise<SearchResult[]> {
    const result = await this.request<{results: TmdbFilm[]}>(`search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
    return result.results.slice(0,20).map(m => ({ provider: 'tmdb', externalId: String(m.id), title: m.title,
      year: m.release_date ? Number(m.release_date.slice(0,4)) : null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null }));
  }
  async details(id: string): Promise<ProviderMovie> {
    const m = await this.movie(id);
    if (String(m.id)!==id || !usableTitle(m.title)) throw new ApiError(409,'IDENTITY_CONFLICT','TMDB returned an unusable film identity or title.');
    const fetched_at = new Date().toISOString();
    const score = record('tmdb','rating',m.vote_average,10,'tmdb',fetched_at,m.vote_count);
    return { title: m.title, original_title: m.original_title ?? null, year: m.release_date ? Number(m.release_date.slice(0,4)) : null,
      release_date: m.release_date || null, runtime: m.runtime || null, overview: m.overview || null,
      genres: m.genres?.map(g => g.name) ?? [], director: directors(m.credits?.crew),
      external_ids: [{ provider: 'tmdb', external_id: String(m.id) }, ...(m.external_ids?.imdb_id ? [{ provider: 'imdb', external_id: m.external_ids.imdb_id }] : [])],
      assets: [ ...(m.poster_path ? [{ provider: 'tmdb', asset_type: 'poster' as const, reference: `https://image.tmdb.org/t/p/w500${m.poster_path}`, width: null, height: null, preferred: 1 }] : []),
        ...(m.backdrop_path ? [{ provider: 'tmdb', asset_type: 'backdrop' as const, reference: `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`, width: null, height: null, preferred: 1 }] : []) ],
      scores: score ? [score] : [], fetched_at, enrichment:parseTmdbEnrichment(m,fetched_at) };
  }
  private movie(id: string) {
    return this.request<TmdbFilm>(`movie/${encodeURIComponent(id)}?append_to_response=external_ids,credits,keywords,release_dates`);
  }
  async enrichment(id: string) {
    return parseTmdbEnrichment(await this.movie(id),new Date().toISOString());
  }
  async preview(id: string): Promise<TmdbPreview> {
    const m = await this.request<TmdbFilm>(`movie/${encodeURIComponent(id)}?append_to_response=credits`);
    return {provider:'tmdb',externalId:String(m.id),title:m.title,original_title:m.original_title ?? null,
      year:m.release_date ? Number(m.release_date.slice(0,4)) : null,release_date:m.release_date || null,
      runtime:m.runtime || null,overview:m.overview || null,genres:m.genres?.map(genre => genre.name) ?? [],director:directors(m.credits?.crew),
      assets:[...(m.poster_path ? [{provider:'tmdb',asset_type:'poster' as const,reference:`https://image.tmdb.org/t/p/w500${m.poster_path}`,width:null,height:null,preferred:1}] : []),
        ...(m.backdrop_path ? [{provider:'tmdb',asset_type:'backdrop' as const,reference:`https://image.tmdb.org/t/p/w1280${m.backdrop_path}`,width:null,height:null,preferred:1}] : [])]};
  }
  async artwork(id: string) { return (await this.details(id)).assets; }
  async scores(id: string) { return (await this.details(id)).scores; }
}
