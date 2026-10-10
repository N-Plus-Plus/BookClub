import { expect,it,vi } from 'vitest';
import { local,env,call,data,builder } from './helpers/product-api';
import type { HealthPage } from '../shared/data-health';
import worker from '../worker/src/index';
import { disposableD1 } from './d1';
import { DataHealthRepository } from '../worker/src/data-health-repository';
it('requires Admin, rejects writes and invalid cursors, and makes no provider calls or database writes',async()=>{
  expect((await worker.fetch(new Request('http://api/api/v1/admin/data-health'),env)).status).toBe(401);
  expect((await call('/admin/data-health')).status).toBe(403);
  expect((await call('/admin/data-health','POST',{},2)).status).toBe(405);
  expect((await call('/admin/data-health?after=bad%2Fid','GET',undefined,2)).status).toBe(422);
  const before=local.sqlite.prepare('SELECT total_changes() AS count').get();const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Provider calls forbidden'));
  try{expect((await data<HealthPage>(await call('/admin/data-health','GET',undefined,2))).scanned).toBeGreaterThan(0);expect(local.sqlite.prepare('SELECT total_changes() AS count').get()).toEqual(before);expect(fetch).not.toHaveBeenCalled();}finally{fetch.mockRestore();}
});
it('projects Builder-only counts and all prediction participants without leaking private titles, notes, owners or lineups',async()=>{
  local.sqlite.exec("INSERT INTO movies(id,title) VALUES('private-film','Private film'),('predicted','Predicted film'); INSERT INTO ai_predictions VALUES('member-1','predicted'),('member-4','predicted');");
  const saved=await builder(1,['private-film']);await builder(4,['private-film']);
  const page=await data<HealthPage>(await call('/admin/data-health','GET',undefined,2));
  expect(page.films.find(f=>f.id==='private-film')?.locations).toEqual([{kind:'builder',count:2,label:'Private saved Builder membership · 2 sets'}]);
  expect(page.films.find(f=>f.id==='predicted')?.locations[0]).toMatchObject({kind:'prediction'});
  expect(page.films.find(f=>f.id==='predicted')?.locations[0].label).toBe('Curated AI Prediction · Member 1, Member 4');
  const text=JSON.stringify(page);for(const privateValue of [saved.id,saved.title!,saved.notes!, 'owner_member_id','movie_ids'])expect(text).not.toContain(privateValue);
  expect((await call(`/builders/${saved.id}`,'GET',undefined,2)).status).toBe(404);
});
it('returns empty search and bounded keyset pages with no duplicates',async()=>{
  for(let n=0;n<85;n++)local.sqlite.prepare('INSERT INTO movies(id,title) VALUES(?,?)').run(`health-${String(n).padStart(3,'0')}`,'Health test');
  const first=await data<HealthPage>(await call('/admin/data-health?q=Health%20test','GET',undefined,2));expect(first.scanned).toBe(80);expect(first.next).toBe('health-079');
  const last=await data<HealthPage>(await call(`/admin/data-health?q=Health%20test&after=${first.next}`,'GET',undefined,2));expect(last.scanned).toBe(5);expect(last.next).toBeNull();expect(new Set([...first.films,...last.films].map(f=>f.id)).size).toBe(85);
  expect(await data(await call('/admin/data-health?q=unfindable','GET',undefined,2))).toEqual({films:[],scanned:0,next:null,partial:false});
});
it('reports partial older evidence schemas rather than inventing complete coverage',async()=>{
  const old=disposableD1('0022_collection_rosters.sql');
  try{old.sqlite.exec("INSERT INTO movies(id,title) VALUES('old','Old film')");const page=await new DataHealthRepository({...env,DB:old.db}).page(null,'');expect(page.partial).toBe(true);expect(page.scanned).toBe(1);}finally{old.sqlite.close();}
});
it('surfaces eligible collection roster gaps, retains conclusive rosters after failures and reports archived relationships',async()=>{
  local.sqlite.exec("UPDATE movie_external_ids SET external_id='10001' WHERE movie_id='arrival' AND provider='tmdb'; INSERT INTO movie_external_ids VALUES('moon','tmdb','10002'); INSERT INTO movie_provider_collections VALUES('arrival','tmdb','10001','2026-01-01',777,'Collection'),('moon','tmdb','10002','2026-01-01',777,'Collection');");
  const read=()=>call('/admin/data-health','GET',undefined,2).then(data<HealthPage>);
  expect((await read()).films.find(f=>f.id==='arrival')?.issues.find(i=>i.code==='collection-roster')).toMatchObject({state:'not_checked'});
  local.sqlite.exec("INSERT INTO tmdb_collection_rosters(collection_id,name,checked_at,parts_json,attempted_at,attempt_status) VALUES(777,'Collection','2026-01-01','[{\"id\":10001},{\"id\":10002}]','2026-01-02','failed');");
  expect((await read()).films.find(f=>f.id==='arrival')?.issues.some(i=>i.code==='collection-roster')).toBe(false);
  local.sqlite.exec("UPDATE sessions SET deleted_at='2026-01-01' WHERE id='demo-2'");
  expect((await read()).films.find(f=>f.id==='moon')?.locations.some(l=>l.kind==='archived')).toBe(true);
});
