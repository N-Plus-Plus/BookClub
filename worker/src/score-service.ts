import type { Movie, ProviderResult, RefreshResult, Score } from '../../shared/types';
import { ApiError, type Env } from './http';
import { Repository } from './repository';
import { MovieService } from './services';
import { MdbListProvider, mdbId } from './providers/mdblist';
import { TmdbProvider } from './providers/tmdb';
import { OmdbProvider } from './providers/omdb';
import { ProviderError } from './providers/http';
import { type MaintenanceMode } from '../../shared/score-maintenance';
import { missingLiveScoreDimensions, requiredScores } from '../../shared/ranking';
const failure = (provider: string, error: unknown): ProviderResult => ({provider,status: 'failed',count: 0,
  blocking: !(error instanceof ProviderError && error.kind === 'not_found'),
  message: error instanceof ApiError ? error.message : `${provider} refresh failed. Try later.`,
  ...(error instanceof ProviderError && error.retryAfter !== undefined ? {retryAfter: error.retryAfter} : {})});
export class ScoreService {
  constructor(private repo: Repository, private env: Env) {}
  private providerWide(error: unknown): error is ProviderError {
    return error instanceof ProviderError && ['credentials','rate_limited','outage','network'].includes(error.kind);
  }
  private suppressed(provider: string, error: ProviderError): ProviderResult {
    return {provider,status:'skipped',count:0,blocking:true,message:`Skipped after ${provider} became unavailable during this enrichment operation.`,...(error.retryAfter === undefined ? {} : {retryAfter:error.retryAfter})};
  }
  private async providerCall<T>(provider: string, call: () => Promise<T>): Promise<T> {
    const wait = await this.repo.providerCooldown(provider);
    if (wait !== null) throw new ProviderError(provider,'rate_limited',`${provider} is cooling down after a rate limit. Try later.`,wait);
    try { return await call(); }
    catch (error) {
      if (error instanceof ProviderError && error.kind === 'rate_limited') await this.repo.setProviderCooldown(provider,error.retryAfter ?? 60);
      throw error;
    }
  }
  private limits(provider: string) {
    return async (headers: Headers) => {
      if (headers.get('X-RateLimit-Remaining') !== '0') return;
      const reset = Number(headers.get('X-RateLimit-Reset'));
      const seconds = Number.isFinite(reset) && reset > Date.now()/1000 ? Math.ceil(reset-Date.now()/1000) : 60;
      await this.repo.setProviderCooldown(provider,Math.min(seconds,86400));
    };
  }
  private needs(movie: Movie, snapshots: Score[]) { return missingLiveScoreDimensions([...movie.scores,...snapshots]); }
  private async capture(movie: Movie, batch?: {scores?: Score[]; error?: unknown}, failures?: Map<string,ProviderError>, refresh = false, missingOnly = false, eligible?: string[]): Promise<ProviderResult[]> {
    const providers: ProviderResult[] = [], snapshots: Score[] = [];
    const id = mdbId(movie.external_ids), imdb = movie.external_ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id));
    if (batch?.error) { providers.push(failure('mdblist',batch.error)); }
    else if (batch?.scores === undefined && failures?.has('mdblist')) providers.push(this.suppressed('mdblist',failures.get('mdblist')!));
    else if (!this.env.MDBLIST_API_KEY) providers.push({provider:'mdblist',status:'skipped',count:0,message:'Not configured.'});
    else if (!id) providers.push({provider:'mdblist',status:'skipped',count:0,message:'A supported external ID is required.'});
    // An omitted batch entry gets one sequential single-film attempt; errors never re-enter capture.
    else try { const scores = batch?.scores !== undefined ? batch.scores : await this.providerCall('mdblist',() => new MdbListProvider(this.env.MDBLIST_API_KEY!,this.limits('mdblist')).scores(id)); snapshots.push(...scores); providers.push({provider:'mdblist',status:'success',count:scores.length,message:scores.length?'Scores captured.':'No usable ratings supplied.'}); } catch (error) { if (failures && this.providerWide(error)) failures.set('mdblist',error); providers.push(failure('mdblist',error)); }
    const missing = refresh ? this.needs({...movie,scores:[]},snapshots) : this.needs(movie,snapshots);
    const unresolved = missing.filter(key => !eligible || eligible.includes(key));
    const omdbUseful = Boolean(imdb && ['imdb:rating','rottentomatoes:critic','metacritic:critic'].some(key => unresolved.includes(key)));
    if (failures?.has('omdb')) providers.push(this.suppressed('omdb',failures.get('omdb')!));
    else if (!this.env.OMDB_API_KEY) providers.push({provider:'omdb',status:'skipped',count:0,message:'Not configured.'});
    else if (!omdbUseful) providers.push({provider:'omdb',status:'skipped',count:0,message:'No missing score OMDb can supply.'});
    else try { const detail = await this.providerCall('omdb',() => new OmdbProvider(this.env.OMDB_API_KEY!,this.limits('omdb')).details(imdb!.external_id)); const scores = detail.scores; if (refresh || missingOnly) await this.repo.enrichOmdbMetadata(movie.id,imdb!.external_id,detail.metadata); snapshots.push(...scores); providers.push({provider:'omdb',status:'success',count:scores.length,message:scores.length?'Scores captured.':'No usable ratings supplied.'}); } catch (error) { if (failures && this.providerWide(error)) failures.set('omdb',error); providers.push(failure('omdb',error)); }
    const tmdb = movie.external_ids.find(e => e.provider === 'tmdb' && /^[1-9]\d{0,9}$/.test(e.external_id));
    const tmdbMissing = this.needs(refresh ? {...movie,scores:[]} : movie,snapshots).includes('tmdb:rating') && (!eligible || eligible.includes('tmdb:rating'));
    if (!tmdbMissing) providers.push({provider:'tmdb',status:'skipped',count:0,message:'TMDB rating already available.'});
    else if (failures?.has('tmdb')) providers.push(this.suppressed('tmdb',failures.get('tmdb')!));
    else if (!this.env.TMDB_READ_TOKEN || !tmdb) providers.push({provider:'tmdb',status:'skipped',count:0,message:!tmdb ? 'A valid TMDB identity is required.' : 'Not configured.'});
    else try {
      const scores = await this.providerCall('tmdb',() => new TmdbProvider(this.env.TMDB_READ_TOKEN!,this.limits('tmdb')).scores(tmdb.external_id));
      snapshots.push(...scores);
      providers.push({provider:'tmdb',status:'success',count:scores.length,message:scores.length ? 'Scores captured.' : 'No usable ratings supplied.'});
    } catch (error) { if (failures && this.providerWide(error)) failures.set('tmdb',error); providers.push(failure('tmdb',error)); }
    const captured = missingOnly ? snapshots.filter(s => s.retrieved_via === 'mdblist' || this.needs(movie,[]).includes(`${s.provider}:${s.metric}`)) : snapshots;
    if (missingOnly) for (const p of providers.filter(p => p.status === 'success')) {
      p.count = captured.filter(s => s.retrieved_via === p.provider).length;
      p.message = p.count ? 'Available scores captured.' : 'No missing scores supplied.';
    }
    await this.repo.appendScores(movie.id,captured);
    if (refresh || missingOnly) {
      const freshMissing = this.needs({...movie,scores:[]},snapshots);
      const checks = (eligible ?? [...requiredScores]).flatMap(key => {
        if (!freshMissing.includes(key)) return [{key,available:true}];
        // Every identity-applicable path must complete. Missing credentials and failures are inconclusive.
        const paths = ['mdblist',...(['imdb:rating','rottentomatoes:critic','metacritic:critic'].includes(key) && imdb ? ['omdb'] : []),...(key === 'tmdb:rating' && tmdb ? ['tmdb'] : [])];
        return paths.every(name => providers.some(p => p.provider === name && p.status === 'success')) ? [{key,available:false}] : [];
      });
      await this.repo.saveScoreChecks(movie.id,checks);
    }
    return providers.sort((a,b) => a.provider.localeCompare(b.provider));
  }
  async refresh(id: string): Promise<RefreshResult> {
    const service = new MovieService(this.repo,this.env);
    const providers = await this.capture(await service.detail(id));
    return {movie: await service.detail(id),providers};
  }
  async maintain(mode: MaintenanceMode, ids: string[]) {
    if (!ids.length || ids.length > 10) throw new ApiError(422,'INVALID_LIMIT','Choose 1–10 films.');
    const selected = await this.repo.maintenanceDetails([...new Set(ids)],true);
    const failures = new Map<string,ProviderError>(), batch = new Map<string,{scores?: Score[]; error?: unknown}>();
    const checks = mode === 'missing' ? await this.repo.scoreChecks(selected.map(m => m.id)) : [];
    const eligible = (m: Movie) => this.needs(m,[]).filter(key => !checks.some(c => c.movie_id === m.id && c.score_key === key && c.available === 0));
    const candidates = selected.filter(m => mode !== 'missing' || eligible(m).length > 0);
    if (mode !== 'metadata' && this.env.MDBLIST_API_KEY) for (const provider of ['imdb','tmdb']) {
      const group = candidates.filter(m => mdbId(m.external_ids)?.provider === provider);
      if (!group.length || failures.has('mdblist')) continue;
      try {
        const result = await this.providerCall('mdblist',() => new MdbListProvider(this.env.MDBLIST_API_KEY!,this.limits('mdblist')).batch(provider,group.map(m => mdbId(m.external_ids)!.external_id)));
        for (const m of group) batch.set(m.id,{scores:result.get(mdbId(m.external_ids)!.external_id)});
      } catch (error) {
        for (const m of group) batch.set(m.id,{error});
        if (this.providerWide(error)) failures.set('mdblist',error);
      }
    }
    const results: {id:string; providers:ProviderResult[]}[] = [];
    for (const movie of candidates) {
      if (results.length && !failures.size) await new Promise(resolve => setTimeout(resolve,500));
      if (mode !== 'metadata') { results.push({id:movie.id,providers:await this.capture(movie,batch.get(movie.id),failures,mode === 'refresh',mode === 'missing',mode === 'missing' ? eligible(movie) : undefined)}); continue; }
      const imdb = movie.external_ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id));
      let result: ProviderResult;
      if (failures.has('omdb')) result = this.suppressed('omdb',failures.get('omdb')!);
      else if (!this.env.OMDB_API_KEY || !imdb) result = {provider:'omdb',status:'skipped',count:0,message:!imdb ? 'A valid IMDb identity is required.' : 'Not configured.'};
      else try {
        const detail = await this.providerCall('omdb',() => new OmdbProvider(this.env.OMDB_API_KEY!,this.limits('omdb')).details(imdb.external_id));
        await this.repo.enrichOmdbMetadata(movie.id,imdb.external_id,detail.metadata);
        result = {provider:'omdb',status:'success',count:[detail.metadata.year,detail.metadata.runtime,detail.metadata.director,detail.metadata.genres.length || null].filter(v => v !== null).length,message:'Available IMDb metadata refreshed.'};
      } catch (error) { if (this.providerWide(error)) failures.set('omdb',error); result = failure('omdb',error); }
      results.push({id:movie.id,providers:[result]});
    }
    const current = await this.repo.maintenanceDetails(results.map(r => r.id));
    return {results:results.map((r,i) => ({providers:r.providers,movie:current[i]}))};
  }
  async enrich(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ApiError(422,'INVALID_LIMIT','Choose 1–10 films.');
    const candidates = await this.repo.enrichmentCandidates(limit);
    const selected = await this.repo.movieDetails(candidates.ids), batch = new Map<string,{scores?: Score[]; error?: unknown}>(), failures = new Map<string,ProviderError>();
    if (this.env.MDBLIST_API_KEY) for (const provider of ['imdb','tmdb']) {
      const group = selected.filter(m => mdbId(m.external_ids)?.provider === provider);
      if (!group.length) continue;
      try {
        const result = await this.providerCall('mdblist',() => new MdbListProvider(this.env.MDBLIST_API_KEY!,this.limits('mdblist')).batch(provider,group.map(m => mdbId(m.external_ids)!.external_id)));
        for (const m of group) batch.set(m.id,{scores: result.get(mdbId(m.external_ids)!.external_id)});
      } catch (error) { for (const m of group) batch.set(m.id,{error}); if (this.providerWide(error)) { failures.set('mdblist',error); break; } }
    }
    const results = [];
    // Sequential fallback prevents a provider-wide failure from multiplying calls.
    for (const m of selected) results.push({id:m.id,providers:await this.capture(m,batch.get(m.id),failures)});
    const current = await this.repo.movieDetails(results.map(r => r.id));
    return {results:results.map((r,i) => ({providers:r.providers,movie:current[i]})),remaining:candidates.remaining,unidentified:candidates.unidentified};
  }
}
