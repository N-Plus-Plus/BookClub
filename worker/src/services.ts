import { Repository } from './repository';
import { ApiError, type Env } from './http';
import { TmdbProvider } from './providers/tmdb';
import type { MovieDetail, SearchResponse } from '../../shared/types';

export class MovieService {
  constructor(private repo: Repository, private env: Env) {}
  async detail(id: string): Promise<MovieDetail> {
    const { movies,sessions } = await this.repo.catalog();
    const movie = movies.find(m => m.id === id);
    if (!movie) throw new ApiError(404,'NOT_FOUND','Film not found.');
    return { ...movie, appearances: sessions.flatMap(s => s.movies.flatMap((m,i) => m.id === id
      ? [{ id: s.id,event_date: s.event_date,date_precision: s.date_precision,kind: s.kind,title: s.title,position: i+1 }] : [])) };
  }
  async search(query: string): Promise<SearchResponse> {
    const { movies } = await this.repo.catalog();
    const local = movies.filter(m => `${m.title} ${m.original_title ?? ''} ${m.year ?? ''}`.toLowerCase().includes(query.toLowerCase())).slice(0,30);
    if (!this.env.TMDB_READ_TOKEN) return { local, external: [], lookup: { available: false, message: 'TMDB lookup is not configured. Search saved films or add one manually.' } };
    try {
      return { local, external: await new TmdbProvider(this.env.TMDB_READ_TOKEN).search(query), lookup: { available: true,message: null } };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return { local, external: [], lookup: { available: false,message: error.message } };
    }
  }
  async import(provider: string, externalId: string) {
    const existing = await this.repo.findExternal(provider,externalId);
    if (existing) return this.detail(existing);
    if (!this.env.TMDB_READ_TOKEN) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB lookup is not configured. Add a film manually.');
    const snapshot = await new TmdbProvider(this.env.TMDB_READ_TOKEN).details(externalId);
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
