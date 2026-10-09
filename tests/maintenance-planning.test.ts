import {afterEach,expect,it,vi} from 'vitest';
import {disposableD1} from './d1';
import {d1Budget} from './helpers/d1-budget';
import {MaintenanceJobs} from '../worker/src/maintenance-jobs';
import {Repository} from '../worker/src/repository';
import {CoverageRepository} from '../worker/src/coverage-repository';
import {maintenanceOperations,planMaintenance} from '../shared/maintenance-plan';
import {maintenanceContract} from '../shared/maintenance-contract';
import type {Env} from '../worker/src/http';
import type {JobOperation,MaintenanceJob} from '../shared/maintenance-job';
const fixtures:ReturnType<typeof disposableD1>[]=[];
afterEach(()=>{fixtures.splice(0).forEach(f=>f.sqlite.close());vi.unstubAllGlobals();});
function fixture(n:number){
  const local=disposableD1();fixtures.push(local);local.sqlite.exec("BEGIN;INSERT INTO members(id,display_name,sort_order,active) VALUES('member','Fictional',1,1);INSERT INTO sessions(id,event_date,date_precision,host_member_id,kind) VALUES('history','2020-01-01','exact','member','hosted')");
  for(let i=1;i<=n;i++){
    const id=`film-${String(i).padStart(4,'0')}`,imdb=`tt${String(i).padStart(7,'0')}`;
    local.sqlite.prepare('INSERT INTO movies(id,title) VALUES(?,?)').run(id,`Film ${i}`);
    local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'imdb',?)").run(id,imdb);
    local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb',?)").run(id,String(i));
    local.sqlite.prepare("INSERT INTO classics(movie_id,source) VALUES(?,'member-added')").run(id);
    local.sqlite.prepare("INSERT INTO session_movies(session_id,movie_id,position) VALUES('history',?,?)").run(id,i);
    local.sqlite.prepare('INSERT INTO movie_provider_collections(movie_id,identity_provider,external_id,checked_at,collection_id,collection_name) VALUES(?,?,?,?,?,?)').run(id,'tmdb',String(i),'2000-01-01T00:00:00.000Z',Math.ceil(i/2),'Series');
    if(i%4===0)local.sqlite.prepare("INSERT INTO tmdb_collection_rosters(collection_id,name,checked_at,parts_json,attempted_at,attempt_status) VALUES(?,'Series','2000-01-01T00:00:00.000Z',?,'2000-01-01T00:00:00.000Z','checked')").run(i/2,JSON.stringify([{id:i-1},{id:i}]));
    if(i%3===0)continue;
    local.sqlite.prepare("INSERT INTO movie_maintenance_coverage VALUES(?,'omdb','metadata','imdb',?,'2000-01-01T00:00:00.000Z','[]')").run(id,imdb);
    for(const provider of ['tmdb','mdblist'])local.sqlite.prepare("INSERT INTO movie_provider_enrichment_state(movie_id,provider,identity_provider,external_id,content_hash,fetched_at,checked_at) VALUES(?,?,?,?,'fictional','2000-01-01T00:00:00.000Z','2000-01-01T00:00:00.000Z')").run(id,provider,provider==='tmdb'?'tmdb':'imdb',provider==='tmdb'?String(i):imdb);
    for(const operation of maintenanceOperations){
      const providers=operation==='scores'?['omdb','tmdb','mdblist']:[operation.startsWith('tmdb')?'tmdb':operation.startsWith('omdb')?'omdb':'mdblist'];
      for(const provider of providers){const fields=Object.fromEntries(maintenanceContract[operation].fields.map(f=>[f.id,{state:'checked_unavailable',checked_at:'2000-01-01T00:00:00.000Z'}]));
        local.sqlite.prepare('INSERT INTO movie_maintenance_fields VALUES(?,?,?,?,?,?)').run(id,provider,operation,provider==='tmdb'?'tmdb':'imdb',provider==='tmdb'?String(i):imdb,JSON.stringify(fields));}
    }
  }
  local.sqlite.exec('COMMIT');
  const budget=d1Budget(local.db,40),env:Env={DB:budget.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'',TMDB_READ_TOKEN:'fictional',MDBLIST_API_KEY:'fictional',OMDB_API_KEY:'fictional',OMDB_API_KEY_PREMIUM:'fictional',OMDB_API_KEY_SECONDARY:'fictional'};
  const invoke=async<T>(work:(jobs:MaintenanceJobs)=>Promise<T>)=>{budget.reset();return work(new MaintenanceJobs(env));};
  const calls=vi.fn(()=>{throw Error('Providers forbidden during planning');});vi.stubGlobal('fetch',calls);
  return {local,budget,env,invoke,calls};
}
async function finish(f:ReturnType<typeof fixture>,job:MaintenanceJob,token:string){
  while(job.planning?.stage!=='complete')job=await f.invoke(j=>j.plan(job.id,token));return job;
}
it.each([500,1000,2000])('plans every card and both aggregates with %i covered films under a 40-statement invocation budget',async n=>{
  const f=fixture(n),repo=new Repository(f.local.db),catalog=await repo.catalog();
  const coverage={checks:[],negativeScores:[],enrichment:[],fields:[],fieldsSupported:true,evidenceSupported:true,unavailable:{omdb:null,tmdb:null,mdblist:null}} as Awaited<ReturnType<CoverageRepository['read']>>;
  for(let i=0;i<catalog.movies.length;i+=80){const c=await new CoverageRepository(f.local.db).read(repo,f.env,catalog.movies.slice(i,i+80).map(m=>m.id),true);for(const key of ['checks','negativeScores','enrichment','fields'] as const)(coverage[key] as unknown[]).push(...c[key]!);}
  for(const intent of ['populate','refresh'] as const)for(const operation of ['all',...maintenanceOperations,'collection-rosters'] as JobOperation[]){
    const id=crypto.randomUUID(),created=await f.invoke(j=>j.create(id,intent,operation));
    expect(created.state).toBe('planning');expect(created.counts.pending).toBe(0);
    const lease=await f.invoke(j=>j.claim(id,'Planner'));
    await expect(f.invoke(j=>j.step(id,lease.token))).rejects.toMatchObject({code:'JOB_PLANNING'});
    const done=await finish(f,created,lease.token);expect(done.state).toBe('ready');expect(done.started_at).toBe(created.started_at);expect(done.requests).toBe(0);
    const expected=operation==='collection-rosters'?[]:planMaintenance(catalog,coverage,intent,operation==='all'?maintenanceOperations:[operation]).units;
    const actual=f.local.sqlite.prepare('SELECT movie_id,provider,identity_provider,external_id,operations_json,score_keys_json FROM maintenance_job_units WHERE job_id=? AND movie_id IS NOT NULL ORDER BY movie_id,provider').all(id);
    expect(actual).toEqual(expected.sort((a,b)=>a.movieId.localeCompare(b.movieId)||a.provider.localeCompare(b.provider)).map(u=>({movie_id:u.movieId,provider:u.provider,identity_provider:u.identity.provider,external_id:u.identity.external_id,operations_json:JSON.stringify(u.operations),score_keys_json:JSON.stringify(u.scoreKeys??[])})));
    expect(f.local.sqlite.prepare('SELECT count(*) AS n FROM maintenance_job_candidates WHERE job_id=?').get(id)?.n).toBe(operation==='collection-rosters'?n/2:n);
    if(operation==='collection-rosters')expect(done.counts.pending).toBe(intent==='refresh'?n/2:n/4);
    await f.invoke(j=>j.release(id,lease.token));f.local.sqlite.prepare("UPDATE maintenance_jobs SET state='cancelled' WHERE id=?").run(id);
  }
  expect(f.calls).not.toHaveBeenCalled();expect(f.budget.max).toBeLessThanOrEqual(40);
},120000);
it('resumes halfway on another device after lost responses, freezes additions and fences racing planners',async()=>{
  const f=fixture(1000),id=crypto.randomUUID(),start=await f.invoke(j=>j.create(id,'refresh','all'));
  const duplicate=await f.invoke(j=>j.create(id,'refresh','all'));expect(duplicate.started_at).toBe(start.started_at);
  await expect(f.invoke(j=>j.create(id,'populate','all'))).rejects.toMatchObject({code:'JOB_SCOPE_CONFLICT'});
  await expect(f.invoke(j=>j.create(crypto.randomUUID(),'refresh','all'))).rejects.toMatchObject({code:'UNFINISHED_JOB'});
  const owner=await f.invoke(j=>j.claim(id,'First browser'));
  await expect(f.invoke(j=>j.claim(id,'Second browser'))).rejects.toMatchObject({code:'MAINTENANCE_BUSY'});
  let job=start;for(let i=0;i<100;i++)job=await f.invoke(j=>j.plan(id,owner.token));
  expect(job.planning?.processed).toBe(500);expect(job.counts.pending).toBe(1500);
  // The last response is lost; the retry advances from D1 rather than replaying it.
  await f.invoke(j=>j.plan(id,owner.token));job=await f.invoke(j=>j.create(id,'refresh','all'));expect(job.planning?.processed).toBe(505);
  f.local.sqlite.prepare("INSERT INTO movies(id,title) VALUES('late','Outside frozen scope')").run();
  await f.invoke(j=>j.stop(id));await f.invoke(j=>j.plan(id,owner.token));await f.invoke(j=>j.release(id,owner.token));
  const other=await f.invoke(j=>j.claim(id,'Second device'));
  await expect(f.invoke(j=>j.plan(id,owner.token))).rejects.toMatchObject({code:'LEASE_LOST'});
  const results=await Promise.allSettled([new MaintenanceJobs(f.env).plan(id,other.token),new MaintenanceJobs(f.env).plan(id,other.token)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  job=await finish(f,await f.invoke(j=>j.status(id)),other.token);
  expect(job.started_at).toBe(start.started_at);expect(job.counts.pending).toBe(3000);expect(job.planning?.processed).toBe(1000);expect(f.calls).not.toHaveBeenCalled();
});
it('rolls a failed page back with its cursor, exposes planning failure and retries without lost or duplicate units',async()=>{
  const f=fixture(500),id=crypto.randomUUID(),job=await f.invoke(j=>j.create(id,'populate','all')),claim=await f.invoke(j=>j.claim(id,'Planner'));
  await f.invoke(j=>j.plan(id,claim.token));
  const before=await f.invoke(j=>j.status(id));
  f.local.sqlite.exec("CREATE TRIGGER reject_planner BEFORE UPDATE OF cursor ON maintenance_job_planning BEGIN SELECT RAISE(ABORT,'synthetic planning storage failure'); END");
  await expect(f.invoke(j=>j.plan(id,claim.token))).rejects.toMatchObject({code:'MAINTENANCE_PLANNING_PAUSED'});
  const failed=await f.invoke(j=>j.status(id));expect(failed.state).toBe('planning_failed');expect(failed.planning?.processed).toBe(before.planning?.processed);expect(failed.counts.pending).toBe(before.counts.pending);
  f.local.sqlite.exec('DROP TRIGGER reject_planner');const done=await finish(f,job,claim.token);expect(done.state).toBe('ready');expect(done.counts.pending).toBeGreaterThan(0);expect(f.calls).not.toHaveBeenCalled();
});

it('two simultaneous creations establish only one durable job, and the losing browser can discover it',async()=>{
 const f=fixture(500),ids=[crypto.randomUUID(),crypto.randomUUID()];f.budget.reset();
 const results=await Promise.allSettled(ids.map(id=>new MaintenanceJobs(f.env).create(id,'refresh','all')));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 const found=await f.invoke(j=>j.list());expect(found.jobs).toHaveLength(1);expect(found.jobs[0].state).toBe('planning');
 const created=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<MaintenanceJob>).value;
 expect((await f.invoke(j=>j.create(created.id,'refresh','all'))).started_at).toBe(created.started_at);expect(f.calls).not.toHaveBeenCalled();
});
