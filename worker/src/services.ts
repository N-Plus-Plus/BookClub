import { Repository } from './repository';
import { ApiError, type Env } from './http';
import { TmdbProvider } from './providers/tmdb';
import type { MovieDetail, SearchResponse, MetadataEnrichment, SelectedMetadataEnrichment, SearchResult, TmdbPreview } from '../../shared/types';
import { matchTitles } from '../../shared/search';
import { ProviderError } from './providers/http';

import { METADATA_MAINTENANCE_BATCH_SIZE } from '../../shared/score-maintenance';
import { metadataCandidate, type MetadataMovie, tmdbIdentity } from '../../shared/metadata';
export { TMDB_METADATA_REFRESH_DAYS, tmdbMetadataIsStale } from '../../shared/metadata';

export { metadataGaps } from '../../shared/metadata';

export class MovieService {
  constructor(private repo: Repository, private env: Env) {}
  private async tmdb<T>(call: () => Promise<T>, readOnly = false): Promise<T> {
    const cooldown = this.repo as Repository & { providerCooldown?: (provider:string) => Promise<number|null>; setProviderCooldown?: (provider:string,seconds:number) => Promise<void> };
    const wait = cooldown.providerCooldown ? await cooldown.providerCooldown('tmdb',readOnly) : null;
    if (wait !== null) throw new ProviderError('TMDB','rate_limited','TMDB is cooling down after a rate limit. Try later.',wait);
    try { return await call(); }
    catch (error) { if (!readOnly && error instanceof ProviderError && error.kind === 'rate_limited' && cooldown.setProviderCooldown) await cooldown.setProviderCooldown('tmdb',error.retryAfter ?? 60); throw error; }
  }
  async enrichMetadata(limit: number): Promise<MetadataEnrichment> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ApiError(422,'INVALID_LIMIT','Choose a limit from 1 to 10.');
    if (!this.env.TMDB_READ_TOKEN) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB metadata enrichment is not configured.');
    const candidates = await this.repo.metadataCandidates(limit);
    return {results:(await this.enrichMetadataMovies(candidates)).results as MetadataEnrichment['results'],...await this.repo.metadataCounts()};
  }
  async enrichMetadataSelected(ids: string[]): Promise<SelectedMetadataEnrichment> {
    if (!ids.length || ids.length > METADATA_MAINTENANCE_BATCH_SIZE) throw new ApiError(422,'INVALID_LIMIT','Choose one or two films.');
    if (!this.env.TMDB_READ_TOKEN) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB metadata enrichment is not configured.');
    return this.enrichMetadataMovies(await this.repo.selectedMetadataMovies([...new Set(ids)]),true);
  }
  private async enrichMetadataMovies(candidates: MetadataMovie[], selected = false): Promise<SelectedMetadataEnrichment> {
    const results: SelectedMetadataEnrichment['results'] = [];
    const provider = new TmdbProvider(this.env.TMDB_READ_TOKEN!);
    for (const movie of candidates) {
      try {
        const tmdb = tmdbIdentity(movie);
        if (!tmdb) throw new ApiError(422,'INVALID_IDENTITY','Stored TMDB identity needs owner review.');
        if (selected && !metadataCandidate(movie)) {
          results.push({movieId:movie.id,title:movie.title,provider:'tmdb',status:'skipped',message:'Metadata is already checked.'});
          continue;
        }
        await this.repo.enrichMetadata(movie.id,tmdb,await this.tmdb(() => provider.details(tmdb)));
        results.push({movieId: movie.id,title: movie.title,provider: 'tmdb',status: 'success',message: 'Stored metadata updated.'});
      } catch (error) {
        results.push({movieId: movie.id,title: movie.title,provider: 'tmdb',status: error instanceof ApiError && error.status === 409 ? 'conflict' : 'failed',
          message: error instanceof ApiError ? error.message : 'Metadata could not be updated. Retry or ask the administrator to review this film.',
          ...(error instanceof ProviderError && error.retryAfter !== undefined ? {retryAfter: error.retryAfter} : {})});
        if (error instanceof ProviderError && ['rate_limited','credentials','outage','network'].includes(error.kind)) break;
      }
    }
    return {results};
  }
  async detail(id: string): Promise<MovieDetail> {
    return (await this.repo.movieDetails([id]))[0];
  }
  async search(query: string): Promise<SearchResponse> {
    let external: SearchResult[] = [];
    let lookup: SearchResponse['lookup'] = {available:false,message:'TMDB lookup is not configured. Search saved films or add one manually.'};
    if (this.env.TMDB_READ_TOKEN) {
      try { external = await this.tmdb(() => new TmdbProvider(this.env.TMDB_READ_TOKEN!).search(query)); lookup = {available:true,message:null}; }
      catch (error) { if (!(error instanceof ApiError)) throw error; lookup = {available:false,message:error.message}; }
    }
    const local = await this.repo.searchMovies(query,external.map(movie => movie.externalId));
    const pool = [...local.map(movie => ({title:movie.title,local:movie})),...external.map(movie => ({title:movie.title,external:movie}))];
    const matched = matchTitles(pool,query);
    const saved = new Map(matched.flatMap(candidate => 'local' in candidate ? [[candidate.local.id,candidate.local] as const] : []));
    const remaining = matched.flatMap(candidate => {
      if (!('external' in candidate)) return [];
      const owner = local.find(movie => movie.tmdbId === candidate.external.externalId);
      if (owner) { saved.set(owner.id,owner); return []; }
      return [candidate.external];
    });
    return {local:[...saved.values()],external:remaining,lookup};
  }
  async preview(externalId: string): Promise<TmdbPreview> {
    if (!this.env.TMDB_READ_TOKEN) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB lookup is not configured.');
    return this.tmdb(() => new TmdbProvider(this.env.TMDB_READ_TOKEN!).preview(externalId),true);
  }
  async import(provider: string, externalId: string) {
    const existing = await this.repo.findExternal(provider,externalId);
    if (existing) return this.detail(existing);
    if (!this.env.TMDB_READ_TOKEN) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB lookup is not configured. Add a film manually.');
    const snapshot = await this.tmdb(() => new TmdbProvider(this.env.TMDB_READ_TOKEN!).details(externalId));
    // Reuse any known provider ID, including IMDb cross-provider matches.
    for (const external of snapshot.external_ids) {
      const known = await this.repo.findExternal(external.provider,external.external_id);
      if (known) return this.detail(known);
    }
    let id: string;
    try { id = await this.repo.importMovie(snapshot); }
    catch (error) {
      const raced = await this.repo.findExternal(provider,externalId);
      if (!raced) throw error;
      id = raced;
    }
    return this.detail(id);
  }
}
