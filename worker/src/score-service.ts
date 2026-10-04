import type { Movie, ProviderResult, RefreshResult, Score } from '../../shared/types';
import { ApiError, type Env } from './http';
import { Repository } from './repository';
import { MovieService } from './services';
import { MdbListProvider, mdbId } from './providers/mdblist';
import { OmdbProvider } from './providers/omdb';
import { ProviderError } from './providers/http';
import { rankMovie } from '../../shared/ranking';
const failure = (provider: string, error: unknown): ProviderResult => ({provider,status: 'failed',count: 0,
  message: error instanceof ApiError ? error.message : `${provider} refresh failed. Try later.`,
  ...(error instanceof ProviderError && error.retryAfter !== undefined ? {retryAfter: error.retryAfter} : {})});
export class ScoreService {
  constructor(private repo: Repository, private env: Env) {}
  private async providerCall<T>(provider: string, call: () => Promise<T>): Promise<T> {
    const wait = await this.repo.providerCooldown(provider);
    if (wait !== null) throw new ProviderError(provider,'rate_limited',`${provider} is cooling down after a rate limit. Try later.`,wait);
    try { return await call(); }
    catch (error) {
      if (error instanceof ProviderError && error.kind === 'rate_limited') await this.repo.setProviderCooldown(provider,error.retryAfter ?? 60);
      throw error;
    }
  }
  private needs(movie: Movie, snapshots: Score[]) { return rankMovie([...movie.scores,...snapshots],movie.seen,[],movie.classics_membership?.rank_seed ?? 0).missingRequiredScores; }
  private async capture(movie: Movie, batch?: {scores?: Score[]; error?: unknown}): Promise<ProviderResult[]> {
    const providers: ProviderResult[] = [], snapshots: Score[] = [];
    const id = mdbId(movie.external_ids), imdb = movie.external_ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id));
    if (!this.env.MDBLIST_API_KEY) providers.push({provider:'mdblist',status:'skipped',count:0,message:'Not configured.'});
    else if (!id) providers.push({provider:'mdblist',status:'skipped',count:0,message:'A supported external ID is required.'});
    else try { const scores = batch ? (batch.error ? await Promise.reject(batch.error) : batch.scores ?? []) : await this.providerCall('mdblist',() => new MdbListProvider(this.env.MDBLIST_API_KEY!).scores(id)); snapshots.push(...scores); providers.push({provider:'mdblist',status:'success',count:scores.length,message:scores.length?'Scores captured.':'No usable ratings supplied.'}); } catch (error) { providers.push(failure('mdblist',error)); }
    const missing = this.needs(movie,snapshots);
    const omdbUseful = Boolean(imdb && (missing.includes('imdb:rating') || missing.includes('rottentomatoes:critic')));
    if (!this.env.OMDB_API_KEY) providers.push({provider:'omdb',status:'skipped',count:0,message:'Not configured.'});
    else if (!omdbUseful) providers.push({provider:'omdb',status:'skipped',count:0,message:'No missing score OMDb can supply.'});
    else try { const scores = await this.providerCall('omdb',() => new OmdbProvider(this.env.OMDB_API_KEY!).scores(imdb!.external_id)); snapshots.push(...scores); providers.push({provider:'omdb',status:'success',count:scores.length,message:scores.length?'Scores captured.':'No usable ratings supplied.'}); } catch (error) { providers.push(failure('omdb',error)); }
    providers.push({provider:'tmdb',status:'skipped',count:0,message:'TMDB rating is not a Watch Order input.'});
    await this.repo.appendScores(movie.id,snapshots);
    return providers.sort((a,b) => a.provider.localeCompare(b.provider));
  }
  async refresh(id: string): Promise<RefreshResult> {
    const service = new MovieService(this.repo,this.env);
    const providers = await this.capture(await service.detail(id));
    return {movie: await service.detail(id),providers};
  }
  async enrich(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ApiError(422,'INVALID_LIMIT','Choose 1–10 films.');
    const {movies} = await this.repo.catalog();
    const candidates = movies.filter(m => m.classic && !m.ranking?.rankable && mdbId(m.external_ids));
    const selected = candidates.slice(0,limit), batch = new Map<string,{scores?: Score[]; error?: unknown}>();
    if (this.env.MDBLIST_API_KEY) for (const provider of ['imdb','tmdb']) {
      const group = selected.filter(m => mdbId(m.external_ids)?.provider === provider);
      if (!group.length) continue;
      try {
        const result = await this.providerCall('mdblist',() => new MdbListProvider(this.env.MDBLIST_API_KEY!).batch(provider,group.map(m => mdbId(m.external_ids)!.external_id)));
        for (const m of group) batch.set(m.id,{scores: result.get(mdbId(m.external_ids)!.external_id)});
      } catch (error) { for (const m of group) batch.set(m.id,{error}); if (error instanceof ProviderError && ['rate_limited','credentials','outage'].includes(error.kind)) break; }
    }
    const results = [];
    // Sequential fallback prevents a provider-wide failure from multiplying calls.
    for (const m of selected) results.push({id:m.id,providers:await this.capture(m,batch.get(m.id))});
    const current = await this.repo.catalog();
    return {results: results.map(r => ({providers: r.providers,movie: {...current.movies.find(m => m.id === r.id)!,
      appearances: current.sessions.flatMap(s => s.movies.flatMap((m,i) => m.id === r.id ? [{id: s.id,event_date: s.event_date,date_precision: s.date_precision,kind: s.kind,title: s.title,position: i+1}] : []))}})),
      remaining: Math.max(0,candidates.length-selected.length),unidentified: movies.filter(m => m.classic && !m.ranking?.rankable && !mdbId(m.external_ids)).length};
  }
}
