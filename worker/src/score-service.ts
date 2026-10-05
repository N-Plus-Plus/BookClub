import type { Movie, ProviderResult, RefreshResult, Score } from '../../shared/types';
import { ApiError, type Env } from './http';
import { Repository } from './repository';
import { MovieService } from './services';
import { MdbListProvider, mdbId } from './providers/mdblist';
import { TmdbProvider } from './providers/tmdb';
import { OmdbProvider } from './providers/omdb';
import { ProviderError } from './providers/http';
import { maintenanceMovies, missingScores, type MaintenanceMode } from '../../shared/score-maintenance';
import { rankMovie } from '../../shared/ranking';
const failure = (provider: string, error: unknown): ProviderResult => ({provider,status: 'failed',count: 0,
  message: error instanceof ApiError ? error.message : `${provider} refresh failed. Try later.`,
  ...(error instanceof ProviderError && error.retryAfter !== undefined ? {retryAfter: error.retryAfter} : {})});
export class ScoreService {
  constructor(private repo: Repository, private env: Env) {}
  private providerWide(error: unknown): error is ProviderError {
    return error instanceof ProviderError && ['credentials','rate_limited','outage','network'].includes(error.kind);
  }
  private suppressed(provider: string, error: ProviderError): ProviderResult {
    return {provider,status:'skipped',count:0,message:`Skipped after ${provider} became unavailable during this enrichment operation.`,...(error.retryAfter === undefined ? {} : {retryAfter:error.retryAfter})};
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
  private needs(movie: Movie, snapshots: Score[]) { return rankMovie([...movie.scores,...snapshots],movie.seen,[],movie.classics_membership?.rank_seed ?? 0).missingRequiredScores; }
  private async capture(movie: Movie, batch?: {scores?: Score[]; error?: unknown}, failures?: Map<string,ProviderError>, refresh = false, missingOnly = false): Promise<ProviderResult[]> {
    const providers: ProviderResult[] = [], snapshots: Score[] = [];
    const id = mdbId(movie.external_ids), imdb = movie.external_ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id));
    if (batch?.error) { providers.push(failure('mdblist',batch.error)); }
    else if (failures?.has('mdblist')) providers.push(this.suppressed('mdblist',failures.get('mdblist')!));
    else if (!this.env.MDBLIST_API_KEY) providers.push({provider:'mdblist',status:'skipped',count:0,message:'Not configured.'});
    else if (!id) providers.push({provider:'mdblist',status:'skipped',count:0,message:'A supported external ID is required.'});
    else try { const scores = batch ? batch.scores ?? [] : await this.providerCall('mdblist',() => new MdbListProvider(this.env.MDBLIST_API_KEY!,this.limits('mdblist')).scores(id)); snapshots.push(...scores); providers.push({provider:'mdblist',status:'success',count:scores.length,message:scores.length?'Scores captured.':'No usable ratings supplied.'}); } catch (error) { if (failures && this.providerWide(error)) failures.set('mdblist',error); providers.push(failure('mdblist',error)); }
    const missing = refresh ? this.needs({...movie,scores:[]},snapshots) : this.needs(movie,snapshots);
    const omdbUseful = Boolean(imdb && (missing.includes('imdb:rating') || missing.includes('rottentomatoes:critic') || missing.includes('metacritic:critic')));
    if (failures?.has('omdb')) providers.push(this.suppressed('omdb',failures.get('omdb')!));
    else if (!this.env.OMDB_API_KEY) providers.push({provider:'omdb',status:'skipped',count:0,message:'Not configured.'});
    else if (!omdbUseful) providers.push({provider:'omdb',status:'skipped',count:0,message:'No missing score OMDb can supply.'});
    else try { const detail = await this.providerCall('omdb',() => new OmdbProvider(this.env.OMDB_API_KEY!,this.limits('omdb')).details(imdb!.external_id)); const scores = detail.scores; if (refresh || missingOnly) await this.repo.enrichOmdbMetadata(movie.id,imdb!.external_id,detail.metadata); snapshots.push(...scores); providers.push({provider:'omdb',status:'success',count:scores.length,message:scores.length?'Scores captured.':'No usable ratings supplied.'}); } catch (error) { if (failures && this.providerWide(error)) failures.set('omdb',error); providers.push(failure('omdb',error)); }
    const tmdb = movie.external_ids.find(e => e.provider === 'tmdb' && /^[1-9]\d{0,9}$/.test(e.external_id));
    const tmdbMissing = this.needs(refresh ? {...movie,scores:[]} : movie,snapshots).includes('tmdb:rating');
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
    return providers.sort((a,b) => a.provider.localeCompare(b.provider));
  }
  async refresh(id: string): Promise<RefreshResult> {
    const service = new MovieService(this.repo,this.env);
    const providers = await this.capture(await service.detail(id));
    return {movie: await service.detail(id),providers};
  }
  async maintain(mode: MaintenanceMode, ids: string[]) {
    if (!ids.length || ids.length > 10) throw new ApiError(422,'INVALID_LIMIT','Choose 1–10 films.');
    const catalog = await this.repo.catalog(), scope = maintenanceMovies(catalog);
    const selected = [...new Set(ids)].map(id => {
      const movie = scope.find(m => m.id === id);
      if (!movie) throw new ApiError(422,'INVALID_SCOPE','Maintenance only covers Classics and History films.');
      return movie;
    });
    const failures = new Map<string,ProviderError>(), batch = new Map<string,{scores?: Score[]; error?: unknown}>();
    const candidates = selected.filter(m => mode !== 'missing' || missingScores(m));
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
      if (mode !== 'metadata') { results.push({id:movie.id,providers:await this.capture(movie,batch.get(movie.id),failures,mode === 'refresh',mode === 'missing')}); continue; }
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
    const current = await this.repo.catalog();
    return {results:results.map(r => ({providers:r.providers,movie:{...current.movies.find(m => m.id === r.id)!,
      appearances:current.sessions.flatMap(s => s.movies.flatMap((m,i) => m.id === r.id ? [{id:s.id,event_date:s.event_date,date_precision:s.date_precision,kind:s.kind,host_member_id:s.host_member_id,position:i+1}] : []))}}))};
  }
  async enrich(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ApiError(422,'INVALID_LIMIT','Choose 1–10 films.');
    const {movies} = await this.repo.catalog();
    const candidates = movies.filter(m => m.classic && !m.ranking?.rankable && mdbId(m.external_ids));
    const selected = candidates.slice(0,limit), batch = new Map<string,{scores?: Score[]; error?: unknown}>(), failures = new Map<string,ProviderError>();
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
    const current = await this.repo.catalog();
    return {results: results.map(r => ({providers: r.providers,movie: {...current.movies.find(m => m.id === r.id)!,
      appearances: current.sessions.flatMap(s => s.movies.flatMap((m,i) => m.id === r.id ? [{id: s.id,event_date: s.event_date,date_precision: s.date_precision,kind: s.kind,host_member_id: s.host_member_id,position: i+1}] : []))}})),
      remaining: Math.max(0,candidates.length-selected.length),unidentified: movies.filter(m => m.classic && !m.ranking?.rankable && !mdbId(m.external_ids)).length};
  }
}
