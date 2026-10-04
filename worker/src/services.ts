import { Repository } from './repository';
import { ApiError, type Env } from './http';
import { TmdbProvider } from './providers/tmdb';
import type { Movie, MovieDetail, SearchResponse, MetadataEnrichment } from '../../shared/types';
import { normalizedGenres } from '../../shared/genres';

export function metadataGaps(movie: Movie): number {
  return (normalizedGenres(movie.genres).length ? 0 : 10) + [movie.original_title,movie.release_date,movie.runtime,movie.overview,
    movie.assets.find(a => a.provider === 'tmdb' && a.asset_type === 'poster'),movie.assets.find(a => a.provider === 'tmdb' && a.asset_type === 'backdrop')].filter(v => !v).length;
}

export class MovieService {
  constructor(private repo: Repository, private env: Env) {}
  async enrichMetadata(limit: number): Promise<MetadataEnrichment> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ApiError(422,'INVALID_LIMIT','Choose a limit from 1 to 10.');
    if (!this.env.TMDB_READ_TOKEN) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB metadata enrichment is not configured.');
    const catalog = await this.repo.catalog();
    const identity = (m: Movie) => m.external_ids.find(e => e.provider === 'tmdb')?.external_id;
    const candidates = catalog.movies.filter(m => identity(m) && !m.tmdb_metadata_checked_at).sort((a,b) => metadataGaps(b)-metadataGaps(a) || a.id.localeCompare(b.id)).slice(0,limit);
    const results: MetadataEnrichment['results'] = [];
    const provider = new TmdbProvider(this.env.TMDB_READ_TOKEN);
    for (const movie of candidates) {
      try {
        const tmdb = identity(movie)!;
        if (!/^[1-9]\d{0,9}$/.test(tmdb)) throw new ApiError(422,'INVALID_IDENTITY','Stored TMDB identity needs owner review.');
        await this.repo.enrichMetadata(movie.id,tmdb,await provider.details(tmdb));
        results.push({movieId: movie.id,title: movie.title,provider: 'tmdb',status: 'success',message: 'Stored metadata updated.'});
      } catch (error) {
        results.push({movieId: movie.id,title: movie.title,provider: 'tmdb',status: error instanceof ApiError && error.status === 409 ? 'conflict' : 'failed',
          message: error instanceof ApiError ? error.message : 'Metadata could not be updated. Retry or ask the administrator to review this film.'});
      }
    }
    const updated = await this.repo.catalog();
    return {results,remaining: updated.movies.filter(m => identity(m) && !m.tmdb_metadata_checked_at).length,unidentified: updated.movies.filter(m => !identity(m)).length};
  }
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
