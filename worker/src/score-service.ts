import type { Movie, ProviderResult, RefreshResult, Score } from '../../shared/types';
import { ApiError, type Env } from './http';
import { Repository } from './repository';
import { MovieService } from './services';
import { MdbListProvider, mdbId } from './providers/mdblist';
import { OmdbProvider } from './providers/omdb';
import { RatingError } from './providers/ratings';
import { TmdbProvider } from './providers/tmdb';
const failure = (provider: string, error: unknown): ProviderResult => ({provider,status: 'failed',count: 0,
  message: error instanceof ApiError ? error.message : `${provider} refresh failed. Try later.`,
  ...(error instanceof RatingError && error.retryAfter !== undefined ? {retryAfter: error.retryAfter} : {})});
export class ScoreService {
  constructor(private repo: Repository, private env: Env) {}
  private async capture(movie: Movie, batch?: {scores?: Score[]; error?: unknown}): Promise<ProviderResult[]> {
    const providers: ProviderResult[] = [], snapshots: Score[] = [];
    const id = mdbId(movie.external_ids), imdb = movie.external_ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id));
    const tmdb = movie.external_ids.find(e => e.provider === 'tmdb' && /^[1-9]\d*$/.test(e.external_id));
    const jobs: [string,boolean,(() => Promise<Score[]>) | undefined][] = [
      ['mdblist',Boolean(this.env.MDBLIST_API_KEY),id ? async () => {
        if (batch?.error) throw batch.error;
        if (batch) { if (!batch.scores) throw new RatingError('MDBList did not return this film in the batch.'); return batch.scores; }
        return new MdbListProvider(this.env.MDBLIST_API_KEY!).scores(id);
      } : undefined],
      ['omdb',Boolean(this.env.OMDB_API_KEY),imdb ? () => new OmdbProvider(this.env.OMDB_API_KEY!).scores(imdb.external_id) : undefined],
      ['tmdb',Boolean(this.env.TMDB_READ_TOKEN),tmdb ? () => new TmdbProvider(this.env.TMDB_READ_TOKEN!).scores(tmdb.external_id) : undefined],
    ];
    // Providers run concurrently; failures never expose upstream payloads or credential URLs.
    await Promise.all(jobs.map(async ([provider,configured,job]) => {
      if (!configured || !job) { providers.push({provider,status: 'skipped',count: 0,message: !configured ? 'Not configured.' : 'A supported external ID is required.'}); return; }
      try { const scores = await job(); snapshots.push(...scores); providers.push({provider,status: 'success',count: scores.length,message: scores.length ? 'Scores captured.' : 'No usable ratings supplied.'}); }
      catch (error) { providers.push(failure(provider,error)); }
    }));
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
        const result = await new MdbListProvider(this.env.MDBLIST_API_KEY).batch(provider,group.map(m => mdbId(m.external_ids)!.external_id));
        for (const m of group) batch.set(m.id,{scores: result.get(mdbId(m.external_ids)!.external_id)});
      } catch (error) { for (const m of group) batch.set(m.id,{error}); }
    }
    const results = [];
    // Bound concurrency and read the final catalog once, avoiding per-film D1 read batches.
    for (let i=0;i<selected.length;i+=2) results.push(...await Promise.all(selected.slice(i,i+2).map(async m => ({id: m.id,providers: await this.capture(m,batch.get(m.id))}))));
    const current = await this.repo.catalog();
    return {results: results.map(r => ({providers: r.providers,movie: {...current.movies.find(m => m.id === r.id)!,
      appearances: current.sessions.flatMap(s => s.movies.flatMap((m,i) => m.id === r.id ? [{id: s.id,event_date: s.event_date,date_precision: s.date_precision,kind: s.kind,title: s.title,position: i+1}] : []))}})),
      remaining: Math.max(0,candidates.length-selected.length),unidentified: movies.filter(m => m.classic && !m.ranking?.rankable && !mdbId(m.external_ids)).length};
  }
}
