import { expect, it } from 'vitest';
import type { AiPrediction, Catalog } from '../shared/types';
import { local,env,call,data,builder,session,sessionData } from './helpers/product-api';
import { Repository } from '../worker/src/repository';
import { CatalogRepository } from '../worker/src/catalog-repository';
import { CoverageRepository } from '../worker/src/coverage-repository';
import { MaintenanceJobs } from '../worker/src/maintenance-jobs';
import { disposableD1 } from './d1';
import { PredictionRepository } from '../worker/src/prediction-repository';
import { hashToken } from '../worker/src/auth';
import { tokens } from './helpers/product-api';

const add=(member_id='member-1',movie_id='prediction')=>call('/predictions','POST',{member_id,movie_id},2);
const predictions=()=>call('/predictions').then(data<AiPrediction[]>);
function film(id='prediction',title='Predicted film') { local.sqlite.prepare('INSERT INTO movies(id,title,year) VALUES(?,?,?)').run(id,title,2025); }
it('requires authentication and Admin management/export, accepts only human participants and canonical movies',async()=>{
  film();expect((await call('/predictions','POST',{member_id:'member-1',movie_id:'prediction'})).status).toBe(403);
  expect((await call('/predictions','DELETE',{member_id:'member-1',movie_id:'prediction'})).status).toBe(403);
  expect((await call('/participants/member-1/history-export')).status).toBe(403);
  expect((await add('classics')).status).toBe(422);expect((await add('member-1','missing')).status).toBe(422);
  local.sqlite.exec("UPDATE members SET active=0 WHERE id='member-4'");expect((await add('member-4')).status).toBe(422);
  expect((await call('/predictions','POST',{member_id:'member-1',movie_id:'prediction',title:'extra'},2)).status).toBe(422);
});
it('deduplicates concurrent adds, supports multiple participants and idempotent removal without erasing evidence',async()=>{
  film();const before=await data<Catalog>(await call('/catalog'));
  expect((await Promise.all([add(),add()])).map(r=>r.status)).toEqual([200,200]);await add('member-2');expect(await predictions()).toHaveLength(2);
  const after=await data<Catalog>(await call('/catalog'));expect(after).toEqual(before);
  local.sqlite.exec("INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,fetched_at) VALUES('retained','prediction','imdb','rating',8,10,'2026-01-01')");
  await call('/predictions','DELETE',{member_id:'member-1',movie_id:'prediction'},2);await call('/predictions','DELETE',{member_id:'member-1',movie_id:'prediction'},2);
  expect(await predictions()).toEqual([{member_id:'member-2',movie_id:'prediction'}]);expect(local.sqlite.prepare("SELECT id FROM source_scores WHERE id='retained'").get()).toBeTruthy();
});
it('prunes every participant on Event creation including Classics and refuses active History additions',async()=>{
  film();await add();await add('member-2');const s=await sessionData(await session({movie_ids:['prediction']}));expect(s.kind).toBe('classics');expect(await predictions()).toEqual([]);expect((await add()).status).toBe(409);
});
it('prunes edited lineups, Builder publication and restored History; deletion never resurrects predictions',async()=>{
  film();await add();
  await call('/sessions/demo-2','PUT',{event_date:'2026-09-19',movie_ids:['prediction'],cycle_id:'demo-cycle-a',cycle_slot:2,date_precision:'cycle_rough'},2);
  expect(await predictions()).toEqual([]);await call('/sessions/demo-2','DELETE',undefined,2);await add();expect(await predictions()).toHaveLength(1);
  await call('/sessions/demo-2/restore','POST',undefined,2);expect(await predictions()).toEqual([]);
  film('published');await add('member-1','published');const set=await builder(1,['published']);
  const response=await call(`/builders/${set.id}/publish`,'POST',{revision:set.revision,event_date:'2030-01-01',cycle_id:null,cycle_slot:1,complete_turn:false},1);
  expect(response.status,await response.clone().text()).toBe(201);expect(await predictions()).toEqual([]);
});
it('enforces pruning for direct import inserts/updates and rejects concurrent add versus History in either order',async()=>{
  film();film('other');await add();
  local.sqlite.exec("INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES('imported','2026-01-01','hosted','member-1');INSERT INTO session_movies(session_id,movie_id,position) VALUES('imported','prediction',1)");
  expect(await predictions()).toEqual([]);await add('member-1','other');local.sqlite.exec("UPDATE session_movies SET movie_id='other' WHERE session_id='imported'");expect(await predictions()).toEqual([]);
  expect(()=>local.sqlite.exec("INSERT INTO ai_predictions VALUES('member-1','other')")).toThrow('PREDICTION_HISTORY');
  await add();const responses=await Promise.all([add(),call('/sessions','POST',{event_date:'2030-01-01',movie_ids:['prediction'],complete_turn:false},2)]);
  expect(responses[1].status).toBe(201);expect(await predictions()).toEqual([]);
  const outcomes=await Promise.all([call('/sessions','POST',{event_date:'2030-01-02',movie_ids:['prediction'],complete_turn:false},2),add()]);expect(outcomes[1].status).toBe(409);expect(await predictions()).toEqual([]);
});
it('rolls pruning back if the enclosing History transaction fails',async()=>{
  film();await add();
  expect(()=>local.sqlite.exec("BEGIN; INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES('rolled','2026-01-01','hosted','member-1'); INSERT INTO session_movies VALUES('rolled','prediction',1); INSERT INTO session_movies VALUES('rolled','missing',2); COMMIT;")).toThrow();local.sqlite.exec('ROLLBACK');expect(await predictions()).toHaveLength(1);
});
it('prunes imports with deferred parent insertion and protects updates to predictions',async()=>{
  film();await add();
  local.sqlite.exec("BEGIN; PRAGMA defer_foreign_keys=ON;INSERT INTO session_movies VALUES('deferred-parent','prediction',1);INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES('deferred-parent','2026-01-01','hosted','member-1');COMMIT;");expect(await predictions()).toEqual([]);
  film('other');await add('member-1','other');expect(()=>local.sqlite.exec("UPDATE ai_predictions SET movie_id='prediction' WHERE movie_id='other'")).toThrow('PREDICTION_HISTORY');
});
it('defaults off and persists only the authenticated member, independently of participant and token',async()=>{
  for(let i=1;i<=4;i++)expect(await data(await call('/auth/preferences','GET',undefined,i))).toEqual({show_ai:false});
  expect(await data(await call('/auth/preferences','PUT',{show_ai:true},1))).toEqual({show_ai:true});expect(await data(await call('/auth/preferences'))).toEqual({show_ai:true});expect(await data(await call('/auth/preferences','GET',undefined,2))).toEqual({show_ai:false});
  expect((await call('/auth/preferences','PUT',{show_ai:true,member_id:'member-2'})).status).toBe(422);
  expect((await call('/auth/preferences','PUT',{show_ai:1})).status).toBe(422);
  expect(local.sqlite.prepare('SELECT * FROM member_preferences').all()).toEqual([{member_id:'member-1',show_ai:1}]);
  await call('/auth/logout','POST');expect((await call('/auth/preferences')).status).toBe(401);
  local.sqlite.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(await hashToken(tokens[0]),'member-1','2026-01-01','2200-01-01');expect(await data(await call('/auth/preferences'))).toEqual({show_ai:true});
});
it('keeps older score schemas readable while new endpoints fail closed before a write',async()=>{
  const old=disposableD1('0025_maintenance_planning.sql');
  try{old.sqlite.exec("INSERT INTO members(id,display_name,sort_order) VALUES('human','Human',1);INSERT INTO movies(id,title) VALUES('film','Film');INSERT INTO classics(movie_id) VALUES('film');");expect((await new Repository(old.db).scoreMaintenanceStatus()).eligibleIds).toEqual(['film']);await expect(new PredictionRepository(old.db).preference('human')).rejects.toMatchObject({status:503});}finally{old.sqlite.close();}
});
it('includes prediction-only films in modern planning/coverage, compatibility status and selected scope, and removes eligibility on removal',async()=>{
  film();local.sqlite.exec("INSERT INTO movie_external_ids VALUES('prediction','imdb','tt1234567')");await add();const repo=new Repository(env.DB);
  expect((await repo.scoreMaintenanceStatus()).eligibleIds).toContain('prediction');expect((await repo.enrichmentCandidates(20)).ids).toContain('prediction');
  expect((await new CatalogRepository(env.DB).planningMovies(['prediction']))[0]).toMatchObject({scoreEligible:1,history:0,classic:false});expect(await repo.maintenanceDetails(['prediction'],true)).toHaveLength(1);
  expect((await new CoverageRepository(env.DB).read(repo,env,['prediction'],true)).scoreEligibleIds).toEqual(['prediction']);
  const jobs=new MaintenanceJobs(env),id=crypto.randomUUID();await jobs.create(id,'populate','scores');const lease=await jobs.claim(id,'member-2');
  let job=lease.job;while(job.planning?.stage!=='complete')job=await jobs.plan(id,lease.token);
  expect(local.sqlite.prepare("SELECT movie_id FROM maintenance_job_units WHERE job_id=? AND movie_id='prediction'").get(id)).toBeTruthy();await jobs.release(id,lease.token);
  await call('/predictions','DELETE',{member_id:'member-1',movie_id:'prediction'},2);
  expect((await repo.scoreMaintenanceStatus()).eligibleIds).not.toContain('prediction');expect((await new CoverageRepository(env.DB).read(repo,env,['prediction'],true)).scoreEligibleIds).toEqual([]);
  local.sqlite.prepare("UPDATE maintenance_job_units SET status='successful' WHERE job_id=? AND movie_id<>'prediction'").run(id);
  const resumed=await jobs.claim(id,'member-3');await jobs.step(id,resumed.token);expect(local.sqlite.prepare("SELECT status FROM maintenance_job_units WHERE job_id=? AND movie_id='prediction'").get(id)?.status).toBe('skipped');
});
it('exports every chronological appearance in canonical cycle/slot order with public IDs, CRLF, repeats and escaped values',async()=>{
  film('export','A, "quoted"\r\nfilm');film('blank');
  local.sqlite.exec("INSERT INTO movie_external_ids VALUES('export','imdb','tt7654321');INSERT INTO movie_external_ids VALUES('export','tmdb','7654321');UPDATE movies SET year=NULL WHERE id='blank'; INSERT INTO cycles(id,ordinal,rough_date) VALUES('export-cycle',100,'2000-01-01');");
  for(const [id,slot,date] of [['later',2,'1900-01-01'],['earlier',1,'2050-01-01']] as const){local.sqlite.prepare("INSERT INTO sessions(id,event_date,cycle_id,cycle_slot,kind,host_member_id) VALUES(?,?,?,?,'hosted','member-4')").run(id,date,'export-cycle',slot);local.sqlite.prepare('INSERT INTO session_movies VALUES(?,?,1)').run(id,id==='earlier'?'export':'blank');local.sqlite.prepare('INSERT INTO session_movies VALUES(?,?,2)').run(id,id==='earlier'?'blank':'export');local.sqlite.prepare('INSERT INTO session_movies VALUES(?,?,3)').run(id,'export');}
  local.sqlite.exec("INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES('ungrouped','1900-01-01','hosted','member-4');INSERT INTO session_movies VALUES('ungrouped','blank',1);");
  local.sqlite.exec("INSERT INTO sessions(id,event_date,kind,host_member_id,deleted_at) VALUES('excluded-deleted','2000-01-01','hosted','member-4','2026-01-01'),('excluded-classic','2000-01-01','classics',NULL,NULL),('excluded-other','2000-01-01','hosted','member-3',NULL);INSERT INTO session_movies VALUES('excluded-deleted','blank',1),('excluded-classic','blank',1),('excluded-other','blank',1);");film('not-history');await add('member-4','not-history');
  const result=await data<{text:string;filename:string}>(await call('/participants/member-4/history-export','GET',undefined,2));
  const line='"A, ""quoted""\r\nfilm",2025,tt7654321,7654321\r\n';expect(result.text).toBe('Title,Year,IMDb ID,TMDB ID\r\n'+line+'Predicted film,,,\r\n'+line+'Predicted film,,,\r\n'+line+line+'Predicted film,,,\r\n');expect(result.filename).toBe('bookclub-Member-4-history.txt');
  // A large ungrouped archive has no UI pagination or endpoint limit.
  for(let i=0;i<150;i++){local.sqlite.prepare("INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES(?,'2000-01-01','hosted','member-4')").run(`many-${i}`);local.sqlite.prepare('INSERT INTO session_movies VALUES(?,?,1)').run(`many-${i}`,'blank');}
  expect((await data<{text:string}>(await call('/participants/member-4/history-export','GET',undefined,2))).text.match(/Predicted film,,,\r\n/g)).toHaveLength(153);
});
