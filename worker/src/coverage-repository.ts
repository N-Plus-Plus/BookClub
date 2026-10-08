import type { MaintenanceCoverage, MaintenanceProvider, ProviderCoverage } from '../../shared/maintenance-plan';
import type { ExternalId } from '../../shared/types';
import { ApiError, type Env } from './http';
import type { Repository } from './repository';

export class CoverageRepository {
  constructor(private db:D1Database) {}
  async supported() {
    return Boolean(await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='movie_maintenance_coverage'").first());
  }
  async read(repo:Repository,env:Env,ids:string[]):Promise<MaintenanceCoverage> {
    if (!await this.supported() || !await repo.enrichmentSupported()) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Unified maintenance requires migration 0020 and the matching API Worker.');
    const where=ids.length ? ` WHERE movie_id IN (${ids.map(()=>'?').join(',')})` : ' WHERE 0';
    const rows=await this.db.batch([
      this.db.prepare(`SELECT * FROM movie_maintenance_coverage${where}`).bind(...ids),
      this.db.prepare(`SELECT movie_id,score_key FROM movie_score_checks${where} AND available=0`).bind(...ids),
      this.db.prepare(`SELECT movie_id,provider,identity_provider,external_id,checked_at,CASE WHEN provider='mdblist' THEN NOT EXISTS(SELECT 1 FROM movie_provider_keywords k WHERE k.movie_id=state.movie_id AND k.provider=state.provider) ELSE ${['countries','languages','companies','credits','content_ratings','keywords','watch_offers'].map(table=>`(NOT EXISTS(SELECT 1 FROM movie_provider_${table} r WHERE r.movie_id=state.movie_id AND r.provider=state.provider))`).join('+')} END AS unavailable_families FROM movie_provider_enrichment_state state${where}`).bind(...ids),
      this.db.prepare(`SELECT movie_id,provider,operation,attempted_at FROM movie_maintenance_failures${where}`).bind(...ids),
    ]);
    const unavailable:MaintenanceCoverage['unavailable']={mdblist:null,omdb:null,tmdb:null};
    for (const provider of ['mdblist','tmdb'] as const) {
      if (!(provider==='tmdb'?env.TMDB_READ_TOKEN:env.MDBLIST_API_KEY)) unavailable[provider]='Not configured.';
      else {const cooldown=await repo.providerCooldown(provider,true);if(cooldown) unavailable[provider]=`Cooling down for ${cooldown} seconds.`;}
    }
    const omdb=env.OMDB_API_KEY ? await repo.providerCooldown('omdb',true) : Infinity;
    const secondary=env.OMDB_API_KEY_SECONDARY ? await repo.providerCooldown('omdb-secondary',true) : Infinity;
    if (!env.OMDB_API_KEY && !env.OMDB_API_KEY_SECONDARY) unavailable.omdb='Not configured.';
    else if(omdb && secondary) unavailable.omdb=`Cooling down for ${Math.min(omdb,secondary)} seconds.`;
    return {failures:rows[3].results as MaintenanceCoverage['failures'],checks:(rows[0].results as (Omit<ProviderCoverage,'absent'> & {absent_json:string})[]).map(({absent_json,...r})=>({...r,absent:JSON.parse(absent_json)})),negativeScores:rows[1].results as MaintenanceCoverage['negativeScores'],enrichment:rows[2].results as MaintenanceCoverage['enrichment'],unavailable};
  }
  async save(movieId:string,provider:MaintenanceProvider,domain:'metadata'|'scores',identity:ExternalId,absent:string[]) {
    await this.db.prepare(`INSERT INTO movie_maintenance_coverage(movie_id,provider,domain,identity_provider,external_id,checked_at,absent_json)
      VALUES(?,?,?, ?,CASE WHEN EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?) THEN ? ELSE NULL END,?,?)
      ON CONFLICT(movie_id,provider,domain) DO UPDATE SET identity_provider=excluded.identity_provider,external_id=excluded.external_id,checked_at=excluded.checked_at,absent_json=excluded.absent_json`)
      .bind(movieId,provider,domain,identity.provider,movieId,identity.provider,identity.external_id,identity.external_id,new Date().toISOString(),JSON.stringify(absent)).run();
  }
  async failure(movieId:string,provider:string,operations:string[],failed:boolean) {
    await this.db.batch(operations.map(operation=>failed ? this.db.prepare('INSERT INTO movie_maintenance_failures(movie_id,provider,operation,attempted_at) VALUES(?,?,?,?) ON CONFLICT(movie_id,provider,operation) DO UPDATE SET attempted_at=excluded.attempted_at').bind(movieId,provider,operation,new Date().toISOString()) : this.db.prepare('DELETE FROM movie_maintenance_failures WHERE movie_id=? AND provider=? AND operation=?').bind(movieId,provider,operation)));
  }
  async page(after:string | null) {
    const rows=(await this.db.prepare('SELECT id FROM movies WHERE (? IS NULL OR id>?) ORDER BY id LIMIT 81').bind(after,after).all<{id:string}>()).results;
    return {ids:rows.slice(0,80).map(r=>r.id),next:rows.length>80?rows[79].id:null};
  }
}
