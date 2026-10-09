import type { JobOperation, MaintenanceJob } from '../../shared/maintenance-job';
import { maintenanceOperations, planMaintenance, providerIdentity, type MaintenanceIntent, type MaintenanceUnit, type MaintenanceCoverage } from '../../shared/maintenance-plan';
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
type JobRow=Omit<MaintenanceJob,'counts'|'lease'|'issues'|'issuesNext'> & {include_rosters:number;roster_started_at:string|null;stop_requested:number};
interface UnitRow {key:string;movie_id:string|null;collection_id:number|null;provider:MaintenanceUnit['provider'];identity_provider:string|null;external_id:string|null;operations_json:string;score_keys_json:string;status:string;attempts:number;last_attempt_at:string|null;retry_at:string|null}
const terminal=['completed','completed_with_issues','cancelled'];
const now=()=>new Date().toISOString();
const filmUnit=(row:UnitRow):MaintenanceUnit=>{const scoreKeys:string[]=JSON.parse(row.score_keys_json);return {movieId:row.movie_id!,provider:row.provider,identity:{provider:row.identity_provider!,external_id:row.external_id!},operations:JSON.parse(row.operations_json),...(scoreKeys.length?{scoreKeys}:{})};};

/** Browser dispatches one bounded step. D1 owns both the scope and execution fence. */
export class MaintenanceJobs {
  constructor(private env:Env){}
  private get db(){return this.env.DB;}
  async requireSchema(){
    if(!await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='maintenance_jobs'").first())throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Durable maintenance requires migration 0024 and the matching API.');
  }
  private async row(id:string){await this.requireSchema();const row=await this.db.prepare('SELECT * FROM maintenance_jobs WHERE id=?').bind(id).first<JobRow>();if(!row)throw new ApiError(404,'JOB_NOT_FOUND','Maintenance job not found.');return row;}
  async status(id:string,after:string|null=null):Promise<MaintenanceJob>{
    const job=await this.row(id);
    const rows=await this.db.prepare('SELECT status,outcome,count(*) AS n FROM maintenance_job_units WHERE job_id=? GROUP BY status,outcome').bind(id).all<{status:string;outcome:string|null;n:number}>();
    const counts:MaintenanceJob['counts']={pending:0,running:0,successful:0,skipped:0,deferred:0,blocked:0,updated:0,no_change:0};
    for(const row of rows.results){counts[row.status as keyof typeof counts]+=row.n;if(row.status==='successful' && (row.outcome==='updated'||row.outcome==='no_change'))counts[row.outcome]+=row.n;}
    const lease=await this.db.prepare('SELECT job_id,owner,expires_at FROM maintenance_lease WHERE slot=1').first<{job_id:string|null;owner:string|null;expires_at:number}>();
    const issues=await this.db.prepare("SELECT key,movie_id AS movieId,collection_id AS collectionId,provider,operations_json,failure_category AS category,diagnostic AS message,attempts,retry_at AS retryAt FROM maintenance_job_units WHERE job_id=? AND status IN ('deferred','blocked') AND (? IS NULL OR key>?) ORDER BY key LIMIT 81").bind(id,after,after).all<MaintenanceJob['issues'][number] & {operations_json:string}>();
    return {id:job.id,intent:job.intent,operation:job.operation,started_at:job.started_at,phase:job.phase,state:job.state,created_at:job.created_at,updated_at:job.updated_at,requests:job.requests,provider:job.provider??null,diagnostic:job.diagnostic,counts,
      lease:{active:Boolean(lease && lease.expires_at>Date.now()),owner:lease?.owner??null,expiresAt:lease?.expires_at??0},
      issues:issues.results.slice(0,80).map(({operations_json,...row})=>({...row,operations:JSON.parse(operations_json)})),issuesNext:issues.results.length>80?issues.results[79].key:null};
  }
  async list(after:string|null=null){await this.requireSchema();const rows=(await this.db.prepare('SELECT id,intent,operation,state,updated_at FROM maintenance_jobs WHERE ? IS NULL OR (created_at,id)<(SELECT created_at,id FROM maintenance_jobs WHERE id=?) ORDER BY created_at DESC,id DESC LIMIT 41').bind(after,after).all<Pick<MaintenanceJob,'id'|'intent'|'operation'|'state'|'updated_at'>>()).results;return {jobs:rows.slice(0,40),next:rows.length>40?rows[39].id:null};}
  private async coverage(repo:Repository,ids:string[]):Promise<MaintenanceCoverage>{
    const store=new CoverageRepository(this.db),result:MaintenanceCoverage={checks:[],negativeScores:[],enrichment:[],fields:[],evidence:[],failures:[],unavailable:{omdb:null,tmdb:null,mdblist:null}};
    for(let offset=0;offset<ids.length || offset===0;offset+=80){const page=await store.read(repo,this.env,ids.slice(offset,offset+80));for(const key of ['checks','negativeScores','enrichment','fields','evidence','failures'] as const)(result[key] as unknown[]).push(...(page[key] ?? []));result.unavailable=page.unavailable;result.fieldsSupported=page.fieldsSupported;result.evidenceSupported=page.evidenceSupported;}
    if(!result.fieldsSupported || !result.evidenceSupported)throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Maintenance field and provider evidence schemas are required.');
    return result;
  }
  private inserts(id:string,units:MaintenanceUnit[],collections:number[]=[]){
    const values:unknown[][]=[...units.map(u=>[id,`${u.movieId}:${u.provider}`,u.movieId,null,u.provider,u.identity.provider,u.identity.external_id,JSON.stringify(u.operations),JSON.stringify(u.scoreKeys??[])]),...collections.map(collection=>[id,`collection:${collection}`,null,collection,'tmdb',null,null,'["collection-rosters"]','[]'])];
    const statements:D1PreparedStatement[]=[];
    for(let i=0;i<values.length;i+=10){const group=values.slice(i,i+10);statements.push(this.db.prepare(`INSERT OR IGNORE INTO maintenance_job_units(job_id,key,movie_id,collection_id,provider,identity_provider,external_id,operations_json,score_keys_json,status) VALUES ${group.map(()=>"(?,?,?,?,?,?,?,?,?,'pending')").join(',')}`).bind(...group.flat()));}
    return statements;
  }
  async create(id:string,intent:MaintenanceIntent,operation:JobOperation,legacy?:LegacyMaintenanceImport){
    await this.requireSchema();
    const existing=await this.db.prepare('SELECT intent,operation FROM maintenance_jobs WHERE id=?').bind(id).first<{intent:string;operation:string}>();if(existing){if(existing.intent!==intent||existing.operation!==operation)throw new ApiError(409,'JOB_SCOPE_CONFLICT','This job ID already has another scope.');return this.status(id);}
    // A new run never silently replaces an unfinished run, even from another device.
    if(await this.db.prepare("SELECT id FROM maintenance_jobs WHERE state NOT IN ('completed','completed_with_issues','cancelled') LIMIT 1").first())throw new ApiError(409,'UNFINISHED_JOB','Resume the existing maintenance job before starting a new run.');
    const repo=new Repository(this.db),catalog=await repo.catalog();
    const coverage=await this.coverage(repo,catalog.movies.map(m=>m.id));
    let units=operation==='collection-rosters'?[]:planMaintenance(catalog,{...coverage,unavailable:{omdb:null,tmdb:null,mdblist:null}},intent,operation==='all'?maintenanceOperations:[operation]).units;
    let collections=operation==='collection-rosters'?(await new CollectionRosterRepository(this.db).eligible()).filter(c=>intent==='refresh'||!c.checked_at).map(c=>c.id):[];
    if(legacy){
      if(legacy.startedAt>now() || legacy.rosterStartedAt && (legacy.rosterStartedAt<legacy.startedAt||legacy.rosterStartedAt>now()) || legacy.phase==='collections' && legacy.units.length || legacy.phase==='films' && legacy.collections.length || legacy.filmOnly && (legacy.phase!=='films'||legacy.collections.length))throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy phase or planning boundary is invalid.');
      units=legacy.units.map(([movieId,provider,identityProvider,external_id,operations,scoreKeys])=>({movieId,provider,identity:{provider:identityProvider,external_id},operations,...(scoreKeys.length?{scoreKeys}:{})}));
      const current=planMaintenance(catalog,{...coverage,unavailable:{omdb:null,tmdb:null,mdblist:null}},'refresh',operation==='all'?maintenanceOperations:operation==='collection-rosters'?[]:[operation]).units;
      for(const unit of units){const owner=current.find(u=>u.movieId===unit.movieId&&u.provider===unit.provider);if(!owner || owner.identity.provider!==unit.identity.provider||owner.identity.external_id!==unit.identity.external_id || new Set(unit.operations).size!==unit.operations.length || unit.operations.some(o=>!owner.operations.includes(o)) || unit.scoreKeys?.some(key=>!providerKeys[unit.provider].includes(key)) || new Set(unit.scoreKeys??[]).size!==(unit.scoreKeys??[]).length || unit.operations.includes('scores')&&!unit.scoreKeys?.length)throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy identity or operation scope needs owner review. The browser checkpoint is preserved.');}
      if(new Set(units.map(u=>`${u.movieId}:${u.provider}`)).size!==units.length)throw new ApiError(422,'INVALID_LEGACY_SCOPE','Duplicate legacy work units.');
      const eligible=new Set((await new CollectionRosterRepository(this.db).eligible()).map(c=>c.id));if(legacy.collections.some(id=>!eligible.has(id))||new Set(legacy.collections).size!==legacy.collections.length)throw new ApiError(422,'INVALID_LEGACY_SCOPE','Legacy collection eligibility changed; owner review is required.');
      collections=legacy.collections;
    }
    const at=now(),startedAt=legacy?.startedAt??at,phase=legacy?.phase??(operation==='collection-rosters'?'collections':'films'),token=crypto.randomUUID();
    // Atomic conditional insert plus units: two simultaneous creations cannot both
    // establish jobs. The guard transaction serializes against all maintenance writes.
    const lease=await this.db.prepare('UPDATE maintenance_lease SET job_id=?,owner=?,token=?,execution=?,expires_at=? WHERE slot=1 AND expires_at<=? RETURNING slot').bind(id,'Planning',token,token,Date.now()+leaseMs,Date.now()).first();
    if(!lease)throw new ApiError(409,'MAINTENANCE_BUSY','Another browser currently owns maintenance execution.');
    const guarded=maintenanceJobDatabase(this.db,id,token,token);
    try{
      if(await this.db.prepare("SELECT id FROM maintenance_jobs WHERE state NOT IN ('completed','completed_with_issues','cancelled') LIMIT 1").first())throw new ApiError(409,'UNFINISHED_JOB','Resume the existing maintenance job.');
      await guarded.batch([this.db.prepare('INSERT INTO maintenance_jobs(id,intent,operation,started_at,phase,state,include_rosters,roster_started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,intent,operation,startedAt,phase,'ready',operation==='all'&&!legacy?.filmOnly?1:0,legacy?.rosterStartedAt??(operation==='collection-rosters'?startedAt:null),at,at),...this.inserts(id,units,collections)]);
    }finally{await this.db.prepare('UPDATE maintenance_lease SET expires_at=0,execution=NULL WHERE slot=1 AND token=?').bind(token).run();}
    return this.status(id);
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
        const collections=(await new CollectionRosterRepository(db).eligible()).filter(c=>job.intent==='refresh'||!c.checked_at).map(c=>c.id);
        await db.batch([...this.inserts(id,[],collections),db.prepare("UPDATE maintenance_jobs SET phase='collections',roster_started_at=coalesce(roster_started_at,?),updated_at=? WHERE id=?").bind(now(),now(),id)]);
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
