import { emptyEnrichmentMovie, type MetricsEnrichment } from '../../shared/metrics-enrichment';
import { ApiError } from './http';

/** Seven set-based SELECTs; no provider service or write dependency. */
export class MetricsRepository {
  constructor(private db: D1Database) {}
  async enrichment(): Promise<MetricsEnrichment> {
    const scope = `movie_id IN (SELECT sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL)`;
    const projections = [
      ['movie_provider_metadata','metadata','original_language,budget,revenue',"provider='tmdb'"],
      ['movie_provider_countries','countries','code,name',"provider='tmdb'"],
      ['movie_provider_languages','languages','code,name,english_name',"provider='tmdb'"],
      ['movie_provider_companies','companies','external_id,name',"provider='tmdb'"],
      ['movie_provider_credits','credits','kind,role,person_id,name',"provider='tmdb' AND (kind='cast' OR role IN ('writer','screenplay','cinematographer','composer','editor','producer'))"],
      ['movie_provider_content_ratings','contentRatings','certification,release_type',"provider='tmdb' AND country='AU'"],
      ['movie_provider_keywords','keywords','provider,name',"provider IN ('tmdb','mdblist')"],
    ] as const;
    let result: D1Result<Record<string,unknown>>[];
    try { result = await this.db.batch(projections.map(([table,,columns,where]) => this.db.prepare(`SELECT movie_id,${columns} FROM ${table} WHERE ${scope} AND ${where} ORDER BY movie_id${table === 'movie_provider_metadata' ? '' : ',item_key'}`))); }
    catch (error) {
      if (error instanceof Error && /no such table.*movie_provider_/.test(error.message)) throw new ApiError(503,'METRICS_ENRICHMENT_UNAVAILABLE','Enriched Metrics is unavailable until the provider cache schema is installed.');
      throw error;
    }
    const payload: MetricsEnrichment = {movies:{}};
    result.forEach((batch,index) => {
      for (const {movie_id,...fact} of batch.results) {
        const id = String(movie_id), movie = payload.movies[id] ??= emptyEnrichmentMovie(), key = projections[index][1];
        if (key === 'metadata') movie.metadata = fact as NonNullable<typeof movie.metadata>;
        else (movie[key] as Record<string,unknown>[]).push(fact);
      }
    });
    return payload;
  }
}
