import { executeProvider, quotaCooldown } from './providers/execution';
import { enrichmentIdentity, type EnrichmentBatch, type EnrichmentCapture, type EnrichmentProvider } from '../../shared/enrichment';
import { ApiError, type Env } from './http';
import { Repository } from './repository';
import { TmdbProvider } from './providers/tmdb';
import { MdbListProvider } from './providers/mdblist';
import { ProviderError, rateLimitHeaders } from './providers/http';

export const MDBLIST_QUOTA_RESERVE=25;
export class EnrichmentService {
  constructor(private repo: Repository,private env: Env) {}
  async maintain(provider: EnrichmentProvider, ids: string[]): Promise<EnrichmentBatch> {
    if (!ids.length || ids.length>(provider==='tmdb'?2:10)) throw new ApiError(422,'INVALID_LIMIT','Selected enrichment batch is too large.');
    const movies=await this.repo.selectedMetadataMovies([...new Set(ids)]);
    if (!(provider==='tmdb' ? this.env.TMDB_READ_TOKEN : this.env.MDBLIST_API_KEY)) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','Provider enrichment is not configured.');
    if (!await this.repo.enrichmentSupported()) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Provider enrichment requires migration 0016.');
    const response: EnrichmentBatch={results:[],canonicalChanged:false};
    const limits=async (headers: Headers) => {
      response.quota=rateLimitHeaders(headers);
      const value=headers.get('X-RateLimit-Remaining');
      if (provider!=='mdblist' || value===null || !/^\d+$/.test(value) || Number(value)>MDBLIST_QUOTA_RESERVE) return;
      await this.repo.setProviderCooldown(provider,quotaCooldown(headers)); response.stopped=true;
    };
    const call=<T,>(operation: () => Promise<T>) => executeProvider(this.repo,provider,operation,{cooldownMessage:'Provider is cooling down. Try later.',onFailure:error=>{if (error.rateLimit) response.quota=error.rateLimit;}});
    const failed=(movieId: string,error: unknown) => {
      const blocking=!(error instanceof ProviderError && error.kind==='not_found');
      response.results.push({movieId,status:'failed',blocking,message:error instanceof ApiError ? error.message : 'Enrichment could not be saved. Completed updates are retained.',...(error instanceof ProviderError && error.retryAfter!==undefined ? {retryAfter:error.retryAfter} : {})});
      if (blocking) response.stopped=true;
    };
    const save=async (movieId: string,capture?: EnrichmentCapture) => {
      if (!capture) throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','Provider returned incomplete enrichment. Existing cache is preserved.');
      const saved=await this.repo.cacheEnrichment(movieId,capture);
      if ('unsupported' in saved) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Provider enrichment requires migration 0016.');
      response.canonicalChanged ||= saved.canonicalChanged;
      response.results.push({movieId,status:saved.changed?'updated':'no_change',conflicts:saved.conflicts,
        message:saved.conflicts ? `${saved.conflicts} identity conflicts retained for review; ownership preserved.` : saved.changed ? 'Provider cache updated.' : 'Provider cache unchanged.'});
    };
    for (const movie of movies.filter(m=>!enrichmentIdentity(m.external_ids,provider))) response.results.push({movieId:movie.id,status:'skipped',message:'A valid provider identity is required.'});
    if (provider==='tmdb') {
      const tmdb=new TmdbProvider(this.env.TMDB_READ_TOKEN!,limits);
      for (const movie of movies) {
        const identity=enrichmentIdentity(movie.external_ids,provider); if (!identity) continue;
        try {
          const detail=await call(()=>tmdb.enrichmentDetails(identity.external_id));
          await this.repo.cacheCollection(movie.id,detail.collection);
          const capture=detail.enrichment;
          if (capture && capture.identity.external_id!==identity.external_id) throw new ApiError(409,'IDENTITY_CONFLICT','TMDB returned a different identity.');
          await save(movie.id,capture);
        } catch (error) { failed(movie.id,error); }
        if (response.stopped) break;
      }
    } else for (const identityProvider of ['imdb','tmdb']) {
      const group=movies.filter(m=>enrichmentIdentity(m.external_ids,provider)?.provider===identityProvider);
      if (!group.length || response.stopped) continue;
      const captures=new Map<string,EnrichmentCapture | undefined>();
      const mdb=new MdbListProvider(this.env.MDBLIST_API_KEY!,limits,async (id,capture)=>{captures.set(id.external_id,capture);});
      try {
        await call(()=>mdb.batch(identityProvider,group.map(m=>enrichmentIdentity(m.external_ids,provider)!.external_id)));
      } catch (error) { for (const movie of group) failed(movie.id,error); continue; }
      for (const movie of group) {
        const identity=enrichmentIdentity(movie.external_ids,provider)!;
        try { await save(movie.id,captures.get(identity.external_id)); }
        catch (error) { failed(movie.id,error); }
      }
    }
    return response;
  }
}
