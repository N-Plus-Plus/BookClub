import type { MaintenanceCoverage, MaintenanceProvider, ProviderCoverage } from '../../shared/maintenance-plan';
import type { ExternalId } from '../../shared/types';
import { ApiError, type Env } from './http';
import { ProviderEvidenceRepository } from './provider-evidence-repository';
import type { Repository } from './repository';
import { FieldCoverageRepository } from './field-coverage-repository';
import { scoreScopeSql } from './score-scope';
import { omdbCredentials } from './providers/omdb-credentials';
import { SchemaCapabilities } from './schema-capabilities';

export class CoverageRepository {
  constructor(private db:D1Database) {}
  async supported() {
    return Boolean(await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='movie_maintenance_coverage'").first());
  }
  async read(repo:Repository,env:Env,ids:string[],planning=false):Promise<MaintenanceCoverage> {
    if (!await this.supported() || !await repo.enrichmentSupported()) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Unified maintenance requires migration 0020 and the matching API Worker.');
    const where=ids.length ? ` WHERE movie_id IN (${ids.map(()=>'?').join(',')})` : ' WHERE 0';
    const rows=await this.db.batch([
      this.db.prepare(`SELECT * FROM movie_maintenance_coverage${where}`).bind(...ids),
      this.db.prepare(`SELECT movie_id,score_key FROM movie_score_checks${where} AND available=0`).bind(...ids),
      this.db.prepare(`SELECT movie_id,provider,identity_provider,external_id,checked_at,CASE WHEN provider='mdblist' THEN NOT EXISTS(SELECT 1 FROM movie_provider_keywords k WHERE k.movie_id=state.movie_id AND k.provider=state.provider) ELSE ${['countries','languages','companies','credits','content_ratings','keywords','watch_offers'].map(table=>`(NOT EXISTS(SELECT 1 FROM movie_provider_${table} r WHERE r.movie_id=state.movie_id AND r.provider=state.provider))`).join('+')} END AS unavailable_families FROM movie_provider_enrichment_state state${where}`).bind(...ids),
      this.db.prepare(`SELECT movie_id,provider,operation,attempted_at FROM movie_maintenance_failures${where}`).bind(...ids),
      this.db.prepare(`SELECT id FROM movies WHERE id IN (${ids.length?ids.map(()=>'?').join(','):'NULL'}) AND (${scoreScopeSql('movies.id',await new SchemaCapabilities(this.db).predictionsSupported())})`).bind(...ids),
    ]);
    const evidenceSupported=await new ProviderEvidenceRepository(this.db).supported();
    const evidence:ProviderCoverage[]=[];
    const failures=rows[3].results as NonNullable<MaintenanceCoverage['failures']>;
    if(evidenceSupported) failures.push(...(await this.db.prepare(`SELECT movie_id,provider,operation,attempted_at FROM movie_maintenance_evidence_failures${where}`).bind(...ids).all<NonNullable<MaintenanceCoverage['failures']>[number]>()).results);
    if(evidenceSupported) for(const [domain,provider,column] of [['collections','tmdb','collection_id'],['awards','omdb','awards_text']] as const) {
      const result=await this.db.prepare(`SELECT movie_id,identity_provider,external_id,checked_at,${column} IS NULL AS unavailable FROM movie_provider_${domain}${where}`).bind(...ids).all<{movie_id:string;identity_provider:string;external_id:string;checked_at:string;unavailable:number}>();
      evidence.push(...result.results.map(({unavailable,...row})=>({...row,provider,domain,absent:unavailable?[domain]:[]})));
    }
    const unavailable:MaintenanceCoverage['unavailable']={mdblist:null,omdb:null,tmdb:null};
    for (const provider of planning?[]:['mdblist','tmdb'] as const) {
      if (!(provider==='tmdb'?env.TMDB_READ_TOKEN:env.MDBLIST_API_KEY)) unavailable[provider]='Not configured.';
      else {const cooldown=await repo.providerCooldown(provider,true);if(cooldown) unavailable[provider]=`Cooling down for ${cooldown} seconds.`;}
    }
    const credentials=planning?[]:omdbCredentials(env).filter(([,key])=>Boolean(key));
    const waits=await Promise.all(credentials.map(([identity])=>repo.providerCooldown(identity,true)));
    if (!planning && !credentials.length) unavailable.omdb='Not configured.';
    else if(!planning && waits.every(wait=>wait!==null&&wait>0)) unavailable.omdb=`Cooling down for ${Math.min(...waits as number[])} seconds.`;
    const coverage:MaintenanceCoverage={scoreEligibleIds:(rows[4].results as {id:string}[]).map(row=>row.id),evidence,evidenceSupported,failures,checks:(rows[0].results as (Omit<ProviderCoverage,'absent'> & {absent_json:string})[]).map(({absent_json,...r})=>({...r,absent:JSON.parse(absent_json)})),negativeScores:rows[1].results as MaintenanceCoverage['negativeScores'],enrichment:rows[2].results as MaintenanceCoverage['enrichment'],unavailable};
    const fields=new FieldCoverageRepository(this.db);coverage.fieldsSupported=await fields.supported();coverage.fields=await fields.read(ids,coverage,coverage.fieldsSupported);
    return coverage;
  }
  statement(movieId:string,provider:MaintenanceProvider,domain:'metadata'|'scores',identity:ExternalId,absent:string[]) {
    return this.db.prepare(`INSERT INTO movie_maintenance_coverage(movie_id,provider,domain,identity_provider,external_id,checked_at,absent_json)
      VALUES(?,?,?, ?,CASE WHEN EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?) THEN ? ELSE NULL END,?,?)
      ON CONFLICT(movie_id,provider,domain) DO UPDATE SET identity_provider=excluded.identity_provider,external_id=excluded.external_id,checked_at=excluded.checked_at,absent_json=excluded.absent_json`)
      .bind(movieId,provider,domain,identity.provider,movieId,identity.provider,identity.external_id,identity.external_id,new Date().toISOString(),JSON.stringify(absent));
  }
  async save(movieId:string,provider:MaintenanceProvider,domain:'metadata'|'scores',identity:ExternalId,absent:string[]) {
    await this.statement(movieId,provider,domain,identity,absent).run();
  }
  async failure(movieId:string,provider:string,operations:string[],failed:boolean) {
    await this.db.batch(operations.map(operation=>{
      const table=operation==='tmdb-collections' || operation==='omdb-awards'?'movie_maintenance_evidence_failures':'movie_maintenance_failures';
      return failed ? this.db.prepare(`INSERT INTO ${table}(movie_id,provider,operation,attempted_at) VALUES(?,?,?,?) ON CONFLICT(movie_id,provider,operation) DO UPDATE SET attempted_at=excluded.attempted_at`).bind(movieId,provider,operation,new Date().toISOString()) : this.db.prepare(`DELETE FROM ${table} WHERE movie_id=? AND provider=? AND operation=?`).bind(movieId,provider,operation);
    }));
  }
  async page(after:string | null) {
    const rows=(await this.db.prepare('SELECT id FROM movies WHERE (? IS NULL OR id>?) ORDER BY id LIMIT 81').bind(after,after).all<{id:string}>()).results;
    return {ids:rows.slice(0,80).map(r=>r.id),next:rows.length>80?rows[79].id:null};
  }
}
