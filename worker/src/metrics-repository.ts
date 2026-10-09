import { emptyEnrichmentMovie, type MetricsEnrichment } from '../../shared/metrics-enrichment/facts';
import { ApiError } from './http';
import { ProviderEvidenceRepository } from './provider-evidence-repository';
import { CollectionRosterRepository } from './collection-roster-repository';

/** Fixed set-based projections with additive evidence capability detection; no HTTP or writes. */
export class MetricsRepository {
  constructor(private db: D1Database) {}
  async enrichment(): Promise<MetricsEnrichment> {
    const scope = `movie_id IN (SELECT sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL)`;
    const projections = [
      ['movie_provider_metadata','metadata','original_language,budget,revenue',"provider='tmdb'"],
      ['movie_provider_countries','countries','code,name',"provider='tmdb'"],
      ['movie_provider_languages','languages','code,name,english_name',"provider='tmdb'"],
      ['movie_provider_companies','companies','external_id,name',"provider='tmdb'"],
      ['movie_provider_credits','credits','kind,role,person_id,name',"provider='tmdb' AND (kind='cast' OR role IN ('director','writer','screenplay','cinematographer','composer','editor','producer'))"],
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
    if(await new ProviderEvidenceRepository(this.db).supported()) {
      const rows=await this.db.batch<Record<string,unknown>>([
        this.db.prepare(`SELECT e.movie_id,e.external_id,e.checked_at,e.collection_id,e.collection_name FROM movie_provider_collections e JOIN movie_external_ids i ON i.movie_id=e.movie_id AND i.provider=e.identity_provider AND i.external_id=e.external_id WHERE e.${scope}`),
        this.db.prepare(`SELECT e.movie_id,e.external_id,e.checked_at,e.awards_text,e.wins,e.nominations FROM movie_provider_awards e JOIN movie_external_ids i ON i.movie_id=e.movie_id AND i.provider=e.identity_provider AND i.external_id=e.external_id WHERE e.${scope}`),
        this.db.prepare(`SELECT movie_id,operation FROM movie_maintenance_evidence_failures WHERE ${scope} AND operation IN ('tmdb-collections','omdb-awards')`),
      ]);
      const initialise=(id:string)=>{
        const movie=payload.movies[id] ??= emptyEnrichmentMovie();
        movie.collection ??= {status:'not_checked',external_id:null,checked_at:null,collection_id:null,collection_name:null};
        movie.awards ??= {status:'not_checked',external_id:null,checked_at:null,awards_text:null,wins:null,nominations:null};
        return movie;
      };
      for(const row of rows[2].results) {const movie=initialise(String(row.movie_id));if(row.operation==='tmdb-collections') movie.collection!.status='inconclusive';else movie.awards!.status='inconclusive';}
      for(const {movie_id,...fact} of rows[0].results) initialise(String(movie_id)).collection={...fact,status:fact.collection_id===null?'checked_none':'checked_present'} as NonNullable<typeof payload.movies[string]['collection']>;
      for(const {movie_id,...fact} of rows[1].results) initialise(String(movie_id)).awards={...fact,status:fact.awards_text===null?'checked_unavailable':fact.wins===null && fact.nominations===null?'checked_unquantified':'checked_quantified'} as NonNullable<typeof payload.movies[string]['awards']>;
      for(const id of Object.keys(payload.movies)) initialise(id);
    }
    const rosters=new CollectionRosterRepository(this.db);
    if(await rosters.supported()) {
      payload.collections=Object.fromEntries((await rosters.eligible()).map(c=>[c.id,c.evidence]));
    }
    return payload;
  }
}
