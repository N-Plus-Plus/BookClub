import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it } from 'vitest';
import worker from '../worker/src/index';
import { Repository } from '../worker/src/repository';
import { missingAnswers } from '../shared/ranking';
import { disposableD1 } from './d1';
import type { JournalMutationResult } from '../shared/types';
import type { Env } from '../worker/src/http';
let local: ReturnType<typeof disposableD1>, env: Env;
beforeEach(()=>{local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-2'; INSERT INTO members(id,display_name,sort_order,active) VALUES('former','Former',6,0)");env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'};});
afterEach(()=>local.sqlite.close());
const call=(path:string,method:string,input?:unknown,member='member-2')=>worker.fetch(new Request(`http://api/api/v1${path}`,{method,headers:{'X-BookClub-Dev-Member':member},...(input===undefined?{}:{body:JSON.stringify(input)})}),env);
const save={event_date:'2030-05-06',movie_ids:['moon','alien']};
const states=(id:string)=>local.sqlite.prepare('SELECT member_id,seen FROM seen_states WHERE movie_id=? ORDER BY member_id').all(id);
const allSeen=(id:string)=>expect(states(id)).toEqual([1,2,3,4].map(i=>({member_id:`member-${i}`,seen:1})));
it.each([2,5])('saves every film all Seen for hosted/Classics slot %i, overrides No and excludes former members',async slot=>{
 local.sqlite.exec(`UPDATE club_rotation SET nominal_slot=${slot},version=version+1; DELETE FROM seen_states WHERE movie_id IN ('moon','alien'); INSERT INTO seen_states(movie_id,member_id,seen) VALUES('moon','member-1',0)`);
 local.sqlite.exec("INSERT OR IGNORE INTO classics(movie_id,source) VALUES('moon','test'),('alien','test'),('arrival','test')");
 const response=await call('/sessions','POST',save);expect(response.status,await response.clone().text()).toBe(201);
 allSeen('moon');allSeen('alien');const {data:result}=await response.json() as {data:JournalMutationResult};const data=result.session!;
 expect(data.kind).toBe(slot===5?'classics':'hosted');
 for(const film of data.movies) expect(film.ranking).toMatchObject({seenCount:4,unknownCount:0,eligible:false});
 for(let i=0;i<2;i++) {
  const correction=await call(`/sessions/${data.id}`,'PUT',{...save,movie_ids:['moon','arrival']});expect(correction.status).toBe(200);
  const {data:corrected}=await correction.json() as {data:JournalMutationResult};
  expect(corrected.session!.movies.find(movie=>movie.id==='arrival')!.ranking).toMatchObject({seenCount:4,unknownCount:0,eligible:false});
 }
 allSeen('moon');allSeen('arrival');allSeen('alien');
 expect((await call(`/sessions/${data.id}`,'DELETE')).status).toBe(200);allSeen('moon');
 local.sqlite.exec("DELETE FROM seen_states WHERE movie_id='moon'; UPDATE seen_states SET seen=0 WHERE movie_id='arrival'");
 const restored=await call(`/sessions/${data.id}/restore`,'POST');expect(restored.status).toBe(200);allSeen('moon');allSeen('arrival');
 const {data:restoration}=await restored.json() as {data:JournalMutationResult};
 for(const film of restoration.session!.movies) expect(film.ranking).toMatchObject({seenCount:4,unknownCount:0,eligible:false});
 const catalog=await new Repository(local.db).catalog();
 for(const member of catalog.members.filter(member=>member.active===1)) expect(missingAnswers(catalog.movies,catalog.members,member.id,new Set(catalog.sessions.flatMap(s=>s.movies.map(m=>m.id)))).some(q=>['moon','arrival'].includes(q.movie.id))).toBe(false);
});
it.each([false,true])('admin removal preserves canonical relationships and History precedence (%s)',async history=>{
 local.sqlite.exec("INSERT OR IGNORE INTO classics(movie_id,source) VALUES('moon','test'); INSERT INTO seen_states(movie_id,member_id,seen) VALUES('moon','member-1',0)");
 if(!history) local.sqlite.exec("UPDATE sessions SET deleted_at='2030-01-01' WHERE id IN (SELECT session_id FROM session_movies WHERE movie_id='moon')");
 if(history) expect((await call('/sessions','POST',{...save,movie_ids:['moon']})).status).toBe(201);
 const tables=['movies','source_scores','movie_assets','movie_external_ids','movie_genres','sessions','session_movies','classics_seed_allocations'];
 const before=tables.map(t=>local.sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all());
 expect((await call('/movies/moon/classics','DELETE',undefined,'member-1')).status).toBe(403);
 expect((await call('/movies/moon/classics','PUT',{classic:false},'member-1')).status).toBe(403);
 expect((await call('/movies/moon/classics','DELETE')).status).toBe(200);
 expect(local.sqlite.prepare("SELECT * FROM classics WHERE movie_id='moon'").get()).toBeUndefined();
 if(history) allSeen('moon');else expect(states('moon')).toEqual([]);
 expect(tables.map(t=>local.sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all())).toEqual(before);
 const answers=states('arrival');expect((await call('/movies/arrival/classics','DELETE')).status).toBe(404);expect(states('arrival')).toEqual(answers);
 expect((await call('/movies/missing/classics','DELETE')).status).toBe(404);
});
it('sanitation scopes exactly current Classics with active History, changes No/Unknown, and reruns without writes',()=>{
 local.sqlite.exec("UPDATE sessions SET deleted_at='2030-01-01' WHERE id IN (SELECT session_id FROM session_movies WHERE movie_id='alien'); DELETE FROM seen_states; INSERT OR IGNORE INTO classics(movie_id,source) VALUES('arrival','test'); DELETE FROM classics WHERE movie_id='paris'; INSERT INTO seen_states(movie_id,member_id,seen) VALUES('arrival','member-1',0),('alien','member-1',0),('paris','member-1',0)");
 const sql=readFileSync('scripts/dev/classics-history-sanitation.sql','utf8');local.sqlite.exec(sql);allSeen('arrival');
 expect(states('alien')).toEqual([{member_id:'member-1',seen:0}]);expect(states('paris')).toEqual([{member_id:'member-1',seen:0}]);
 const before=local.sqlite.prepare('SELECT * FROM seen_states ORDER BY movie_id,member_id').all();local.sqlite.exec(sql);expect(local.sqlite.prepare('SELECT changes() n').get()?.n).toBe(0);expect(local.sqlite.prepare('SELECT * FROM seen_states ORDER BY movie_id,member_id').all()).toEqual(before);
});

it.each([false,null] as const)('queued personal %s cannot undo active History but remains valid outside it',async answer=>{
 local.sqlite.exec("UPDATE sessions SET deleted_at='2030-01-01'; DELETE FROM seen_states WHERE movie_id='bicycle'; INSERT INTO seen_states(movie_id,member_id,seen) VALUES('bicycle','member-2',1)");
 expect((await call('/movies/bicycle/seen/member-2','PUT',{seen:answer})).status).toBe(200);
 expect(states('bicycle')).toEqual(answer===null?[]:[{member_id:'member-2',seen:0}]);
 const published=await call('/sessions','POST',{...save,movie_ids:['bicycle']});expect(published.status).toBe(201);allSeen('bicycle');
 const late=await call('/movies/bicycle/seen/member-2','PUT',{seen:answer});expect(late.status).toBe(200);allSeen('bicycle');
 const {data}=await late.json() as {data:import('../shared/types').MovieDetail};
 expect(data.ranking).toMatchObject({seenCount:4,unknownCount:0,eligible:false});
});
