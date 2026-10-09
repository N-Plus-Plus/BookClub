import type { JobOperation, MaintenanceJob } from '../../shared/maintenance-job';
import { maintenanceOperations, planMaintenance, providerIdentity, type MaintenanceIntent, type MaintenanceUnit } from '../../shared/maintenance-plan';
import { maintenanceContract } from '../../shared/maintenance-contract';
import { ApiError, type Env } from './http';
import { Repository } from './repository';
import { CoverageRepository } from './coverage-repository';
import { UnifiedMaintenanceService } from './unified-maintenance';
import { CollectionRosterService } from './collection-roster-service';
import { CollectionRosterRepository } from './collection-roster-repository';
import { maintenanceJobDatabase } from './maintenance-job-db';
import { classifyMaintenanceFailure } from './maintenance-failure';
import type { LegacyMaintenanceImport } from '../../shared/maintenance-legacy';
import { providerKeys } from '../../shared/maintenance-plan';

const leaseMs=180000;
// At most 15 film/provider units (two 90-bind INSERTs) per planning invocation.
const planningPageSize=5;
interface PlanningRow {stage:'films'|'collections'|'complete';cursor:number;total:number;failed:number;diagnostic:string|null;legacy:number}
type JobRow=Omit<MaintenanceJob,'counts'|'lease'|'issues'|'issuesNext'> & {include_rosters:number;roster_started_at:string|null;stop_requested:number};
interface UnitRow {key:string;movie_id:string|null;collection_id:number|null;provider:MaintenanceUnit['provider'];identity_provider:string|null;external_id:string|null;operations_json:string;score_keys_json:string;status:string;attempts:number;last_attempt_at:string|null;retry_at:string|null}
const terminal=['completed','completed_with_issues','cancelled'];
const now=()=>new Date().toISOString();
const filmUnit=(row:UnitRow):MaintenanceUnit=>{const scoreKeys:string[]=JSON.parse(row.score_keys_json);return {movieId:row.movie_id!,provider:row.provider,identity:{provider:row.identity_provider!,external_id:row.external_id!},operations:JSON.parse(row.operations_json),...(scoreKeys.length?{scoreKeys}:{})};};

/** Browser dispatches one bounded step. D1 owns both the scope and execution fence. */
export class MaintenanceJobs {
  constructor(private env:Env){}
  private get db(){return this.env.DB;}
  private schema?:Promise<void>;
  async requireSchema(){
    return this.schema??=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='maintenance_job_planning'").first().then(row=>{if(!row)throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Durable maintenance planning requires migration 0025 and the matching API.');});
  }
  private async row(id:string){await this.requireSchema();const row=await this.db.prepare('SELECT * FROM maintenance_jobs WHERE id=?').bind(id).first<JobRow>();if(!row)throw new ApiError(404,'JOB_NOT_FOUND','Maintenance job not found.');return row;}
  async status(id:string,after:string|null=null):Promise<MaintenanceJob>{
    const job=await this.row(id);
    const planning=await this.db.prepare('SELECT * FROM maintenance_job_planning WHERE job_id=?').bind(id).first<PlanningRow>();
    const rows=await this.db.prepare('SELECT status,outcome,count(*) AS n FROM maintenance_job_units WHERE job_id=? GROUP BY status,outcome').bind(id).all<{status:string;outcome:string|null;n:number}>();
    const counts:MaintenanceJob['counts']={pending:0,running:0,successful:0,skipped:0,deferred:0,blocked:0,updated:0,no_change:0};
    for(const row of rows.results){counts[row.status as keyof typeof counts]+=row.n;if(row.status==='successful' && (row.outcome==='updated'||row.outcome==='no_change'))counts[row.outcome]+=row.n;}
    const lease=await this.db.prepare('SELECT job_id,owner,expires_at FROM maintenance_lease WHERE slot=1').first<{job_id:string|null;owner:string|null;expires_at:number}>();
    const issues=await this.db.prepare("SELECT key,movie_id AS movieId,collection_id AS collectionId,provider,operations_json,failure_category AS category,diagnostic AS message,attempts,retry_at AS retryAt FROM maintenance_job_units WHERE job_id=? AND status IN ('deferred','blocked') AND (? IS NULL OR key>?) ORDER BY key LIMIT 81").bind(id,after,after).all<MaintenanceJob['issues'][number] & {operations_json:string}>();
    return {id:job.id,intent:job.intent,operation:job.operation,started_at:job.started_at,phase:job.phase,state:planning&&planning.stage!=='complete'?(planning.failed?'planning_failed':'planning'):job.state,created_at:job.created_at,updated_at:job.updated_at,requests:job.requests,provider:job.provider??null,diagnostic:job.diagnostic,counts,
      ...(planning?{planning:{stage:planning.stage,processed:planning.cursor,total:planning.total,failed:Boolean(planning.failed),diagnostic:planning.diagnostic}}:{}),
      lease:{active:Boolean(lease && lease.expires_at>Date.now()),owner:lease?.owner??null,expiresAt:lease?.expires_at??0},
      issues:issues.results.slice(0,80).map(({operations_json,...row})=>({...row,operations:JSON.parse(operations_json)})),issuesNext:issues.results.length>80?issues.results[79].key:null};
  }
  async list(after:string|null=null){await this.requireSchema();const rows=(await this.db.prepare("SELECT j.id,j.intent,j.operation,CASE WHEN p.stage<>'complete' THEN CASE WHEN p.failed=1 THEN 'planning_failed' ELSE 'planning' END ELSE j.state END AS state,j.updated_at FROM maintenance_jobs j LEFT JOIN maintenance_job_planning p ON p.job_id=j.id WHERE ? IS NULL OR (j.created_at,j.id)<(SELECT created_at,id FROM maintenance_jobs WHERE id=?) ORDER BY j.created_at DESC,j.id DESC LIMIT 41").bind(after,after).all<Pick<MaintenanceJob,'id'|'intent'|'operation'|'state'|'updated_at'>>()).results;return {jobs:rows.slice(0,40),next:rows.length>40?rows[39].id:null};}
  private inserts(id:string,units:MaintenanceUnit[],collections:number[]=[]){
    const values:unknown[][]=[...units.map(u=>[id,`${u.movieId}:${u.provider}`,u.movieId,null,u.provider,u.identity.provider,u.identity.external_id,JSON.stringify(u.operations),JSON.stringify(u.scoreKeys??[])]),...collections.map(collection=>[id,`collection:${collection}`,null,collection,'tmdb',null,null,'["collection-rosters"]','[]'])];
    const statements:D1PreparedStatement[]=[];
    for(let i=0;i<values.length;i+=10){const group=values.slice(i,i+10);statements.push(this.db.prepare(`INSERT OR IGNORE INTO maintenance_job_units(job_id,key,movie_id,collection_id,provider,identity_provider,external_id,operations_json,score_keys_json,status) VALUES ${group.map(()=>"(?,?,?,?,?,?,?,?,?,'pending')").join(',')}`).bind(...group.flat()));}
    return statements;
  }
  /** Candidate IDs are captured once with set-based SQL, never a full catalogue load. */
  private candidates(id:string,phase:'films'|'collections') {
    if(phase==='films')return this.db.prepare(`INSERT INTO maintenance_job_candidates(job_id,phase,ordinal,movie_id)
      SELECT ?,'films',row_number() OVER(ORDER BY id),id FROM movies`).bind(id);
    return this.db.prepare(`INSERT INTO maintenance_job_candidates(job_id,phase,ordinal,collection_id)
      SELECT ?,'collections',(SELECT coalesce(max(ordinal),0) FROM maintenance_job_candidates WHERE job_id=? AND phase='collections')+row_number() OVER(ORDER BY collection_id),collection_id FROM (
        SELECT e.collection_id FROM movie_provider_collections e JOIN movie_external_ids i ON i.movie_id=e.movie_id AND i.provider='tmdb' AND i.external_id=e.external_id
        WHERE e.collection_id IS NOT NULL AND EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=e.movie_id AND s.deleted_at IS NULL)
        GROUP BY e.collection_id HAVING count(DISTINCT e.movie_id)>=2
      ) eligible WHERE NOT EXISTS(SELECT 1 FROM maintenance_job_candidates c WHERE c.job_id=? AND c.phase='collections' AND c.collection_id=eligible.collection_id)`).bind(id,id,id);
  }
  private async validateLegacy(legacy:LegacyMaintenanceImport) {
    if(legacy.startedAt>now() || legacy.rosterStartedAt && (legacy.rosterStartedAt<legacy.startedAt||legacy.rosterStartedAt>now()) || legacy.phase==='collections' && legacy.units.length || legacy.phase==='films' && legacy.collections.length || legacy.filmOnly && (legacy.phase!=='films'||legacy.collections.length))throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy phase or planning boundary is invalid.');
    const selected=legacy.operation==='all'?maintenanceOperations:legacy.operation==='collection-rosters'?[]:[legacy.operation];
    const keys=new Set<string>();
    for(const [movieId,provider,identityProvider,externalId,operations,scoreKeys] of legacy.units){
      const key=`${movieId}:${provider}`;
      if(keys.has(key)||!operations.length||new Set(operations).size!==operations.length||operations.some(o=>!selected.includes(o)||o!=='scores'&&!o.startsWith(provider))||scoreKeys.some(k=>!providerKeys[provider].includes(k))||new Set(scoreKeys).size!==scoreKeys.length||operations.includes('scores')&&!scoreKeys.length||provider==='omdb'&&identityProvider!=='imdb'||provider==='tmdb'&&identityProvider!=='tmdb'||!externalId)throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy identity or operation scope needs owner review. The browser checkpoint is preserved.');
      keys.add(key);
    }
    // A compact JSON parameter avoids thousands of binds/queries for import validation.
    const invalid=await this.db.prepare(`SELECT 1 FROM json_each(?) u WHERE NOT EXISTS(
      SELECT 1 FROM movie_external_ids i WHERE i.movie_id=json_extract(u.value,'$[0]') AND i.provider=json_extract(u.value,'$[2]') AND i.external_id=json_extract(u.value,'$[3]')
    ) OR (EXISTS(SELECT 1 FROM json_each(json_extract(u.value,'$[4]')) o WHERE o.value='scores') AND NOT EXISTS(SELECT 1 FROM classics WHERE movie_id=json_extract(u.value,'$[0]')) AND NOT EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=json_extract(u.value,'$[0]') AND s.deleted_at IS NULL))
    OR (json_extract(u.value,'$[1]')='mdblist' AND json_extract(u.value,'$[2]')='tmdb' AND EXISTS(SELECT 1 FROM movie_external_ids i WHERE i.movie_id=json_extract(u.value,'$[0]') AND i.provider='imdb' AND i.external_id GLOB 'tt[0-9]*')) LIMIT 1`).bind(JSON.stringify(legacy.units)).first();
    if(invalid||new Set(legacy.collections).size!==legacy.collections.length)throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy identity or eligibility changed; owner review is required.');
    if(legacy.collections.length){
      const invalidCollection=await this.db.prepare(`SELECT 1 FROM json_each(?) c WHERE (SELECT count(DISTINCT e.movie_id) FROM movie_provider_collections e JOIN movie_external_ids i ON i.movie_id=e.movie_id AND i.provider='tmdb' AND i.external_id=e.external_id WHERE e.collection_id=c.value AND EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=e.movie_id AND s.deleted_at IS NULL))<2 LIMIT 1`).bind(JSON.stringify(legacy.collections)).first();
      if(invalidCollection)throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy collection eligibility changed; owner review is required.');
    }
  }
  async create(id:string,intent:MaintenanceIntent,operation:JobOperation,legacy?:LegacyMaintenanceImport){
    await this.requireSchema();
    const existing=await this.db.prepare('SELECT intent,operation FROM maintenance_jobs WHERE id=?').bind(id).first<{intent:string;operation:string}>();
    if(existing){if(existing.intent!==intent||existing.operation!==operation)throw new ApiError(409,'JOB_SCOPE_CONFLICT','This job ID already has another scope.');return this.status(id);}
    const at=now(),phase=legacy?.phase??(operation==='collection-rosters'?'collections':'films'),token=crypto.randomUUID();
    const lease=await this.db.prepare('UPDATE maintenance_lease SET job_id=?,owner=?,token=?,execution=?,expires_at=? WHERE slot=1 AND expires_at<=? RETURNING slot').bind(id,'Planning',token,token,Date.now()+leaseMs,Date.now()).first();
    if(!lease)throw new ApiError(409,'MAINTENANCE_BUSY','Another browser currently owns maintenance execution.');
    const db=maintenanceJobDatabase(this.db,id,token,token);
    try{
      // Recheck inside ownership: concurrent retries of the same UUID are idempotent.
      const raced=await this.db.prepare('SELECT intent,operation FROM maintenance_jobs WHERE id=?').bind(id).first<{intent:string;operation:string}>();
      if(raced){if(raced.intent!==intent||raced.operation!==operation)throw new ApiError(409,'JOB_SCOPE_CONFLICT','This job ID already has another scope.');return await this.status(id);}
      if(await this.db.prepare("SELECT id FROM maintenance_jobs WHERE state NOT IN ('completed','completed_with_issues','cancelled') LIMIT 1").first())throw new ApiError(409,'UNFINISHED_JOB','Resume the existing maintenance job before starting a new run.');
      if(legacy)await this.validateLegacy(legacy);
      const candidate=legacy?this.db.prepare(`INSERT INTO maintenance_job_candidates(job_id,phase,ordinal,movie_id,collection_id,legacy_unit)
        SELECT ?,?,CAST(key AS INTEGER)+1,CASE WHEN ?='films' THEN json_extract(value,'$[0]') END,CASE WHEN ?='collections' THEN value END,CASE WHEN ?='films' THEN value END FROM json_each(?)`).bind(id,phase,phase,phase,phase,JSON.stringify(phase==='films'?legacy.units:legacy.collections)):this.candidates(id,phase);
      await db.batch([
        db.prepare('INSERT INTO maintenance_jobs(id,intent,operation,started_at,phase,state,include_rosters,roster_started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,intent,operation,legacy?.startedAt??at,phase,'paused',operation==='all'&&!legacy?.filmOnly?1:0,legacy?.rosterStartedAt??(operation==='collection-rosters'?(legacy?.startedAt??at):null),at,at),
        candidate,
        db.prepare('INSERT INTO maintenance_job_planning(job_id,stage,total,legacy) SELECT ?,?,count(*),? FROM maintenance_job_candidates WHERE job_id=? AND phase=?').bind(id,phase,legacy?1:0,id,phase),
      ]);
    }finally{await this.db.prepare('UPDATE maintenance_lease SET expires_at=0,owner=NULL,execution=NULL WHERE slot=1 AND token=?').bind(token).run();}
    return this.status(id);
  }
  /** Exactly one atomic page; replay observes the committed cursor, never duplicate units. */
  async plan(id:string,token:string){
    const job=await this.row(id),{execution,db}=await this.begin(id,token);
    try{
      const planning=await this.db.prepare('SELECT * FROM maintenance_job_planning WHERE job_id=?').bind(id).first<PlanningRow>();
      if(!planning||planning.stage==='complete')return await this.status(id);
      if(job.stop_requested){await db.prepare('UPDATE maintenance_jobs SET stop_requested=0,updated_at=? WHERE id=?').bind(now(),id).run();return await this.status(id);}
      const page=(await this.db.prepare('SELECT ordinal,movie_id,collection_id,legacy_unit FROM maintenance_job_candidates WHERE job_id=? AND phase=? AND ordinal>? ORDER BY ordinal LIMIT ?').bind(id,planning.stage,planning.cursor,planningPageSize).all<{ordinal:number;movie_id:string|null;collection_id:number|null;legacy_unit:string|null}>()).results;
      if(!page.length&&planning.cursor<planning.total)throw new ApiError(503,'PLANNING_SCOPE_INVALID','The saved planning manifest needs owner review.');
      let units:MaintenanceUnit[]=[],collections:number[]=[];
      if(planning.stage==='films'&&page.length){
        const repo=new Repository(this.db),movies=await repo.planningMovies(page.map(r=>r.movie_id!));
        const coverage=job.intent==='populate'&&!planning.legacy?await new CoverageRepository(this.db).read(repo,this.env,movies.map(m=>m.id),true):{checks:[],negativeScores:[],enrichment:[],unavailable:{omdb:null,tmdb:null,mdblist:null}};
        if(job.intent==='populate'&&!planning.legacy&&(!coverage.fieldsSupported||!coverage.evidenceSupported))throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Maintenance field and provider evidence schemas are required.');
        // History eligibility is per selected movie; no catalogue-wide query or roster needed.
        const catalog={members:[],cycles:[],movies,sessions:movies.filter(m=>m.history).map(m=>({movies:[m]}))} as unknown as import('../../shared/types').Catalog;
        units=planMaintenance(catalog,coverage,planning.legacy?'refresh':job.intent,job.operation==='all'?maintenanceOperations:job.operation==='collection-rosters'?[]:[job.operation]).units;
        if(planning.legacy){
          units=page.map(row=>{const [movieId,provider,identityProvider,external_id,operations,scoreKeys]=JSON.parse(row.legacy_unit!) as LegacyMaintenanceImport['units'][number];return {movieId,provider,identity:{provider:identityProvider,external_id},operations,...(scoreKeys.length?{scoreKeys}:{})};});
          // The frozen original manifest is retained if a film changes after import.
        }
      }else if(planning.stage==='collections'&&page.length){
        const eligible=await new CollectionRosterRepository(this.db).eligible(page.map(r=>r.collection_id!));
        collections=planning.legacy?page.map(r=>r.collection_id!):eligible.filter(c=>job.intent==='refresh'||!c.checked_at).map(c=>c.id);
      }
      const cursor=page.at(-1)?.ordinal??planning.cursor,complete=cursor>=planning.total;
      await db.batch([...this.inserts(id,units,collections),
        db.prepare('UPDATE maintenance_job_planning SET cursor=?,stage=?,failed=0,diagnostic=NULL WHERE job_id=? AND cursor=?').bind(cursor,complete?'complete':planning.stage,id,planning.cursor),
        db.prepare('UPDATE maintenance_jobs SET state=?,diagnostic=NULL,updated_at=? WHERE id=?').bind(complete?'ready':'paused',now(),id),
      ]);
      return await this.status(id);
    }catch(error){
      try{await db.prepare("UPDATE maintenance_job_planning SET failed=1,diagnostic='Planning was interrupted. Saved pages are retained; resume planning.' WHERE job_id=? AND stage<>'complete'").bind(id).run();}catch{/* Expired owners cannot change durable progress. */}
      throw new ApiError(503,'MAINTENANCE_PLANNING_PAUSED','Planning was interrupted. Saved pages are retained; resume planning.');
    }finally{await this.db.prepare('UPDATE maintenance_lease SET execution=NULL WHERE slot=1 AND job_id=? AND token=? AND execution=?').bind(id,token,execution).run();}
  }
  async claim(id:string,owner:string){
    const job=await this.row(id);if(terminal.includes(job.state))throw new ApiError(409,'JOB_COMPLETE','This run has finished. Retry failed work explicitly or start a new run.');
    const token=crypto.randomUUID(),at=Date.now();
    const claimed=await this.db.prepare('UPDATE maintenance_lease SET job_id=?,owner=?,token=?,expires_at=?,execution=NULL WHERE slot=1 AND expires_at<=? RETURNING slot').bind(id,owner,token,at+leaseMs,at).first();
    if(!claimed)throw new ApiError(409,'MAINTENANCE_BUSY','Another browser owns an active maintenance lease. Wait for it to pause or expire.');
    return {token,job:await this.status(id)};
  }
  private async begin(id:string,token:string){
    const execution=crypto.randomUUID();
    const row=await this.db.prepare('UPDATE maintenance_lease SET execution=?,expires_at=? WHERE slot=1 AND job_id=? AND token=? AND expires_at>? AND execution IS NULL RETURNING slot').bind(execution,Date.now()+leaseMs,id,token,Date.now()).first();
    if(!row)throw new ApiError(409,'LEASE_LOST','Execution is already in progress or this browser no longer owns the lease.');
    return {execution,db:maintenanceJobDatabase(this.db,id,token,execution)};
  }
  async release(id:string,token:string){
    await this.row(id);
    await this.db.prepare('UPDATE maintenance_lease SET expires_at=0,owner=NULL,execution=NULL WHERE slot=1 AND job_id=? AND token=? AND execution IS NULL').bind(id,token).run();
    return this.status(id);
  }
  async stop(id:string){await this.row(id);await this.db.prepare("UPDATE maintenance_jobs SET stop_requested=1,updated_at=? WHERE id=? AND state NOT IN ('completed','completed_with_issues','cancelled')").bind(now(),id).run();return this.status(id);}
  async retry(id:string,keys?:string[]){
    const job=await this.row(id);if(job.state==='cancelled')throw new ApiError(409,'JOB_CANCELLED','Cancelled maintenance cannot be resumed.');
    if(await this.db.prepare("SELECT 1 FROM maintenance_job_planning WHERE job_id=? AND stage<>'complete'").bind(id).first())throw new ApiError(409,'JOB_PLANNING','Resume planning before retrying provider failures.');
    const token=crypto.randomUUID();
    const lease=await this.db.prepare('UPDATE maintenance_lease SET job_id=?,owner=?,token=?,execution=?,expires_at=? WHERE slot=1 AND expires_at<=? RETURNING slot').bind(id,'Retry planning',token,token,Date.now()+leaseMs,Date.now()).first();
    if(!lease)throw new ApiError(409,'MAINTENANCE_BUSY','Pause active maintenance before retrying failures.');
    const db=maintenanceJobDatabase(this.db,id,token,token);
    const scope=keys?.length?` AND key IN (${keys.map(()=>'?').join(',')})`:'';
    // Minimum one minute between explicit attempts prevents immediate poison loops.
    try{
      if(await db.prepare("SELECT id FROM maintenance_jobs WHERE id<>? AND state NOT IN ('completed','completed_with_issues','cancelled') LIMIT 1").bind(id).first())throw new ApiError(409,'UNFINISHED_JOB','Finish the existing maintenance run before retrying an earlier run.');
      const eligible=await db.prepare(`SELECT key FROM maintenance_job_units WHERE job_id=? AND status='deferred' AND (retry_at IS NULL OR retry_at<=?)${scope} LIMIT 1`).bind(id,now(),...(keys??[])).first();
      if(eligible)await db.batch([
        db.prepare(`UPDATE maintenance_job_units SET status='pending',diagnostic=NULL,failure_category=NULL WHERE job_id=? AND status='deferred' AND (retry_at IS NULL OR retry_at<=?)${scope}`).bind(id,now(),...(keys??[])),
        db.prepare("UPDATE maintenance_jobs SET state='ready',phase=CASE WHEN EXISTS(SELECT 1 FROM maintenance_job_units WHERE job_id=? AND movie_id IS NOT NULL AND status='pending') THEN 'films' ELSE phase END,stop_requested=0,updated_at=? WHERE id=?").bind(id,now(),id),
      ]);
    }finally{await this.db.prepare('UPDATE maintenance_lease SET expires_at=0,execution=NULL WHERE slot=1 AND token=?').bind(token).run();}
    return this.status(id);
  }
  private async reconcile(job:JobRow,rows:UnitRow[],db:D1Database){
    const repo=new Repository(db),filmRows=rows.filter(r=>r.movie_id!==null);
    // Load only extant films. Deleted and ineligible work is an accurate skip.
    const ids=filmRows.map(r=>r.movie_id!);
    const present=ids.length?(await db.prepare(`SELECT id FROM movies WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<{id:string}>()).results.map(r=>r.id):[];
    const movies=present.length?await repo.maintenanceDetails(present):[];
    const coverage=filmRows.length?await new CoverageRepository(db).read(repo,{...this.env,DB:db},present):null;
    const collections=rows.some(r=>r.collection_id!==null)?await new CollectionRosterRepository(db).eligible():[];
    const pending:UnitRow[]=[];
    for(const row of rows){
      let outcome:string|null=null,reason:string|null=null;
      if(row.movie_id){
        const movie=movies.find(m=>m.id===row.movie_id),unit=filmUnit(row);
        if(!movie){outcome='skipped';reason='Film was deleted.';}
        else{
          const identity=providerIdentity(movie,row.provider);
          if(!identity || identity.provider!==row.identity_provider || identity.external_id!==row.external_id){
            await db.prepare("UPDATE maintenance_job_units SET status='deferred',failure_category='record',diagnostic='Provider identity changed; owner review required.',retry_at=?,checked_at=NULL WHERE job_id=? AND key=?").bind(new Date(Date.now()+60000).toISOString(),job.id,row.key).run();continue;
          }
          const scopes=unit.operations.filter(o=>o!=='scores'||movie.classic||movie.appearances.length);
          if(!scopes.length){outcome='skipped';reason='Film is no longer eligible for this operation.';}
          else{
            const checks=coverage!.fields?.filter(c=>c.movie_id===row.movie_id&&c.provider===row.provider&&c.identity_provider===row.identity_provider&&c.external_id===row.external_id);
            const complete=scopes.every(operation=>{const fields=checks?.find(c=>c.operation===operation)?.fields;const keys=operation==='scores'?unit.scoreKeys!:maintenanceContract[operation].fields.map(f=>f.id);return keys.every(key=>fields?.[key]&&(job.intent==='populate'||fields[key].checked_at>=job.started_at));});
            if(complete){outcome='successful';reason='Reconciled committed provider evidence.';}
          }
        }
      }else{
        const collection=collections.find(c=>c.id===row.collection_id);
        if(!collection){outcome='skipped';reason='Collection is no longer eligible.';}
        else if(collection.checked_at && (job.intent==='populate'||collection.checked_at>=(job.roster_started_at??job.started_at))){outcome='successful';reason='Reconciled committed collection evidence.';}
      }
      if(outcome)await db.prepare('UPDATE maintenance_job_units SET status=?,outcome=?,checked_at=?,diagnostic=?,failure_category=NULL WHERE job_id=? AND key=?').bind(outcome,outcome==='successful'?'no_change':'skipped',now(),reason,job.id,row.key).run();
      else if(row.status==='running')await db.prepare("UPDATE maintenance_job_units SET status='deferred',failure_category='ambiguous',diagnostic='Interrupted request has no conclusive completion evidence. Retry failed explicitly.',retry_at=? WHERE job_id=? AND key=?").bind(new Date(Date.now()+60000).toISOString(),job.id,row.key).run();
      else pending.push(row);
    }
    return pending;
  }
  async step(id:string,token:string){
    const job=await this.row(id);if(terminal.includes(job.state))return this.status(id);
    const planning=await this.db.prepare("SELECT 1 FROM maintenance_job_planning WHERE job_id=? AND stage<>'complete'").bind(id).first();
    if(planning)throw new ApiError(409,'JOB_PLANNING','Resume planning before provider maintenance can begin.');
    const {execution,db}=await this.begin(id,token);
    try{
      if(job.stop_requested){await db.prepare("UPDATE maintenance_jobs SET state='paused',stop_requested=0,updated_at=? WHERE id=?").bind(now(),id).run();return await this.status(id);}
      await db.prepare("UPDATE maintenance_jobs SET state='running',diagnostic=NULL,updated_at=? WHERE id=?").bind(now(),id).run();
      // Unacknowledged work is reconciled first; successful evidence wins over a lost response.
      const abandoned=(await db.prepare("SELECT * FROM maintenance_job_units WHERE job_id=? AND status='running' ORDER BY key LIMIT 10").bind(id).all<UnitRow>()).results;
      if(abandoned.length)await this.reconcile(job,abandoned,db);
      const rows=(await db.prepare("SELECT * FROM maintenance_job_units WHERE job_id=? AND status IN ('pending','blocked') AND (?='films' AND movie_id IS NOT NULL OR ?='collections' AND collection_id IS NOT NULL) ORDER BY provider,key LIMIT 10").bind(id,job.phase,job.phase).all<UnitRow>()).results;
      const candidates=await this.reconcile(job,rows,db);
      const repo=new Repository(db),coverage=candidates.some(r=>r.movie_id)?await new CoverageRepository(db).read(repo,{...this.env,DB:db},candidates.filter(r=>r.movie_id).map(r=>r.movie_id!)):null;
      const rosterUnavailable=job.phase==='collections'?(await new CollectionRosterService({...this.env,DB:db}).status()).unavailable:null;
      const available:UnitRow[]=[];
      for(const row of candidates){
        const unavailable=row.movie_id?coverage!.unavailable[row.provider]:rosterUnavailable;
        if(unavailable || row.retry_at && row.retry_at>now())await db.prepare("UPDATE maintenance_job_units SET status='blocked',failure_category='provider',diagnostic=? WHERE job_id=? AND key=?").bind(unavailable??'Waiting for provider recovery.',id,row.key).run();
        else available.push(row);
      }
      // Search beyond blocked providers so other providers can continue safely.
      if(!available.length && candidates.length){
        const next=(await db.prepare("SELECT * FROM maintenance_job_units WHERE job_id=? AND status='pending' AND provider NOT IN (SELECT provider FROM maintenance_job_units WHERE job_id=? AND status='blocked') ORDER BY provider,key LIMIT 10").bind(id,id).all<UnitRow>()).results;
        available.push(...await this.reconcile(job,next,db));
      }
      if(available.length){
        const provider=available[0].provider,family=available[0].identity_provider;
        await db.prepare('UPDATE maintenance_jobs SET provider=? WHERE id=?').bind(provider,id).run();
        const batch=available.filter(r=>r.provider===provider&&(provider!=='mdblist'||r.identity_provider===family)).slice(0,job.phase==='collections'?1:provider==='mdblist'?10:2);
        await db.batch(batch.map(row=>db.prepare("UPDATE maintenance_job_units SET status='running',attempts=attempts+1,last_attempt_at=?,diagnostic=NULL,failure_category=NULL WHERE job_id=? AND key=? AND status IN ('pending','blocked')").bind(now(),id,row.key)));
        const beforeRequest=async()=>{
          await db.prepare('UPDATE maintenance_jobs SET requests=requests+1,updated_at=? WHERE id=?').bind(now(),id).run();
          // Renewal is conditional and bounded. It cannot resurrect an expired owner.
          const renewed=await this.db.prepare('UPDATE maintenance_lease SET expires_at=? WHERE slot=1 AND job_id=? AND token=? AND execution=? AND expires_at>? RETURNING slot').bind(Date.now()+leaseMs,id,token,execution,Date.now()).first();
          if(!renewed)throw new ApiError(409,'LEASE_LOST','Maintenance ownership changed.');
        };
        if(job.phase==='films'){
          const result=await new UnifiedMaintenanceService(repo,{...this.env,DB:db},beforeRequest).execute(job.intent,batch.map(filmUnit),job.started_at);
          for(const row of batch){const item=result.results.find(r=>r.movieId===row.movie_id);if(!item){await this.block(db,id,row,'Provider stopped before this record was attempted.',60);continue;}
            if(item.status==='failed'){
              if(item.failure?.category==='transient')await this.defer(db,id,row,item.message,'transient');
              else if(item.failure?.category==='provider')await this.block(db,id,row,item.message,item.retryAfter??60);
              else await this.defer(db,id,row,item.message,item.failure?.category??'record');
            }else await this.success(db,id,row,item.status==='skipped'?'skipped':'successful',item.status);
          }
        }else{
          const result=await new CollectionRosterService({...this.env,DB:db},beforeRequest).execute(job.intent,[batch[0].collection_id!],job.roster_started_at??job.started_at);
          const item=result.results[0];
          if(item?.status==='failed'){if(item.failure?.category==='provider')await this.block(db,id,batch[0],item.message,item.failure.retryAfter??60);else await this.defer(db,id,batch[0],item.message,item.failure?.category??'record');}
          else if(item)await this.success(db,id,batch[0],item.status==='skipped'?'skipped':'successful',item.status==='checked'?'updated':'skipped');
        }
      }
      const totals=await this.status(id);
      const phasePending=await db.prepare("SELECT count(*) AS n FROM maintenance_job_units WHERE job_id=? AND status IN ('pending','running','blocked') AND (?='films' AND movie_id IS NOT NULL OR ?='collections' AND collection_id IS NOT NULL)").bind(id,job.phase,job.phase).first<{n:number}>();
      if(!phasePending?.n && job.phase==='films' && job.include_rosters){
        // Retain the original planning boundary for existing rosters. A later explicit
        // retry may extend eligibility, but INSERT OR IGNORE never replays successes.
        await db.batch([this.candidates(id,'collections'),
          db.prepare("INSERT INTO maintenance_job_planning(job_id,stage,total) SELECT ?,'collections',count(*) FROM maintenance_job_candidates WHERE job_id=? AND phase='collections' ON CONFLICT(job_id) DO UPDATE SET stage='collections',cursor=0,total=excluded.total,failed=0,diagnostic=NULL,legacy=0").bind(id,id),
          db.prepare("UPDATE maintenance_jobs SET state='paused',phase='collections',roster_started_at=coalesce(roster_started_at,?),updated_at=? WHERE id=?").bind(now(),now(),id)]);
      }else if(!phasePending?.n){
        await db.prepare('UPDATE maintenance_jobs SET state=?,updated_at=? WHERE id=?').bind(totals.counts.deferred?'completed_with_issues':'completed',now(),id).run();
      }else if(!available.length && candidates.length){
        await db.prepare("UPDATE maintenance_jobs SET state='awaiting_cooldown',diagnostic='Provider capacity is unavailable. Resume remaining after recovery.',updated_at=? WHERE id=?").bind(now(),id).run();
      }
      return await this.status(id);
    }catch(error){
      const failure=classifyMaintenanceFailure(error);
      // If storage is unavailable, leave running evidence for reconciliation rather
      // than fabricating hundreds of record failures. A lost fence cannot update state.
      try{await db.prepare("UPDATE maintenance_jobs SET state='failed',diagnostic=?,updated_at=? WHERE id=?").bind(failure.message,now(),id).run();}catch{/* Durable running units retain ambiguity. */}
      throw new ApiError(503,'MAINTENANCE_PAUSED',failure.message);
    }finally{
      await this.db.prepare('UPDATE maintenance_lease SET execution=NULL WHERE slot=1 AND job_id=? AND token=? AND execution=?').bind(id,token,execution).run();
    }
  }
  private block(db:D1Database,id:string,row:UnitRow,message:string,seconds:number){return db.prepare("UPDATE maintenance_job_units SET status='blocked',failure_category='provider',diagnostic=?,retry_at=? WHERE job_id=? AND key=?").bind(message,new Date(Date.now()+Math.max(60,Math.min(seconds,86400))*1000).toISOString(),id,row.key).run();}
  private defer(db:D1Database,id:string,row:UnitRow,message:string,category:string){return db.prepare("UPDATE maintenance_job_units SET status='deferred',failure_category=?,diagnostic=?,retry_at=? WHERE job_id=? AND key=?").bind(category,message,new Date(Date.now()+60000).toISOString(),id,row.key).run();}
  private success(db:D1Database,id:string,row:UnitRow,status:string,outcome:string){return db.prepare('UPDATE maintenance_job_units SET status=?,outcome=?,checked_at=?,failure_category=NULL,diagnostic=NULL,retry_at=NULL WHERE job_id=? AND key=?').bind(status,outcome,now(),id,row.key).run();}
}
