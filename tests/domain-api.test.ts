import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker/src/index';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import type { Env } from '../worker/src/http';
import type { Catalog, MovieDetail, RefreshResult, Session } from '../shared/types';
let local: ReturnType<typeof disposableD1>, env: Env;
const call = (path: string,method='GET',body?: unknown) => worker.fetch(new Request(`http://api/api/v1${path}`,{method,headers:{'X-BookClub-Dev-Member':'member-1'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
const data = async <T>(response: Response): Promise<T> => { expect(response.ok,await response.clone().text()).toBe(true);return (await response.json() as {data:T}).data; };
beforeEach(()=>{local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:5173'};});
afterEach(()=>{local.sqlite.close();vi.unstubAllGlobals();});
describe('cycles and membership',()=>{
  it('seed shows cycles, three candidate states, Unknown and additional ratings; rerun preserves changes',async()=>{
    const catalog=await data<Catalog>(await call('/catalog'));expect(catalog.cycles).toHaveLength(1);expect(catalog.sessions.some(s=>s.kind==='classics')).toBe(true);
    const classics=catalog.movies.filter(m=>m.classic);expect(classics.some(m=>m.ranking?.rankable&&m.ranking.eligible)).toBe(true);expect(classics.some(m=>!m.ranking?.rankable)).toBe(true);expect(classics.some(m=>!m.ranking?.eligible)).toBe(true);
    expect(classics.some(m=>m.ranking?.unknownCount)).toBe(true);expect(classics.some(m=>m.scores.some(s=>s.provider==='letterboxd'))).toBe(true);
    await new Repository(local.db).setSeen('bicycle','member-1',null);await new Repository(local.db).setClassic('bicycle',false);
    local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));expect((await new Repository(local.db).catalog()).movies.find(m=>m.id==='bicycle')!.classic).toBe(false);
    expect(local.sqlite.prepare("SELECT * FROM seen_states WHERE movie_id='bicycle' AND member_id='member-1'").get()).toBeUndefined();
  });
  it('creates a slot-1 anchored cycle atomically and preserves film order',async()=>{
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');
    const s=await data<Session>(await call('/sessions','POST',{event_date:'2000-02-01',kind:'hosted',host_member_id:'member-1',new_cycle:{rough_date:'2000-02-01',title:'Fictional cycle'},date_precision:'exact',cycle_slot:1,movie_ids:['arrival','moon','arrival']}));
    expect(s.date_precision).toBe('exact');expect(s.movies.map(m=>m.id)).toEqual(['arrival','moon','arrival']);
    const c=await data<Catalog>(await call('/catalog'));expect(c.cycles.find(x=>x.id===s.cycle_id)?.rough_date).toBe('2000-02-01');
    expect((await call('/sessions','POST',{event_date:'2000-02-02',cycle_id:s.cycle_id,date_precision:'cycle_rough',movie_ids:['moon']})).status).toBe(422);
  });
  it('allows exact dates and derives new Event kind/host from the current turn',async()=>{
    const s=await data<Session>(await call('/sessions','POST',{event_date:'2026-10-01',kind:'classics',cycle_id:'demo-cycle-a',date_precision:'exact',movie_ids:['moon']}));expect(s.host_member_id).toBeNull();
    expect((await data<Session>(await call('/sessions','POST',{event_date:'2026-10-01',kind:'classics',host_member_id:'member-1',movie_ids:['moon']}))).host_member_id).toBeNull();
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=2,version=version+1');
    expect((await data<Session>(await call('/sessions','POST',{event_date:'2026-10-01',kind:'hosted',movie_ids:['moon']}))).host_member_id).toBe('member-2');
    const old=await data<Session>(await call('/sessions','POST',{event_date:'2026-10-01',movie_ids:['moon']}));expect(old).toMatchObject({kind:'hosted',date_precision:'exact',cycle_id:null});
    expect((await call('/sessions','POST',{event_date:'2026-10-01',cycle_id:'missing',movie_ids:['moon']})).status).toBe(422);
  });
  it('keeps seeds stable across removal/readdition; allocates without reuse',async()=>{
    const original=await data<MovieDetail>(await call('/movies/bicycle'));
    await call('/movies/bicycle/classics','PUT',{classic:false});const added=await data<MovieDetail>(await call('/movies/moon/classics','PUT',{classic:true}));
    const restored=await data<MovieDetail>(await call('/movies/bicycle/classics','PUT',{classic:true}));expect(restored.classics_membership?.rank_seed).toBe(original.classics_membership?.rank_seed);
    expect(added.classics_membership!.rank_seed).toBeGreaterThan(original.classics_membership!.rank_seed);expect(restored.appearances.length).toBe(original.appearances.length);
  });
  it('rolls back a new cycle when event insertion fails',async()=>{
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');
    const repo=new Repository(local.db), before=(await repo.catalog()).cycles.length;
    local.sqlite.exec("CREATE TRIGGER fail_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT,'test'); END");
    await expect(repo.saveSession({event_date:'2000-01-01',new_cycle:{rough_date:'2000-01-01'},kind:'hosted',host_member_id:'member-1',cycle_slot:1,date_precision:'exact',movie_ids:['moon']})).rejects.toThrow();expect((await repo.catalog()).cycles.length).toBe(before);
  });
});
describe('persisted score refresh',()=>{
  beforeEach(()=>local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'"));
  it('appends scores, keeps history, derives rank and tolerates partial failure safely',async()=>{
    env.MDBLIST_API_KEY='secret-mdb';env.OMDB_API_KEY='secret-omdb';
    const before=await data<MovieDetail>(await call('/movies/arrival'));
    await call('/movies/arrival/classics','PUT',{classic:true});
    vi.stubGlobal('fetch',vi.fn(async(url:string)=> url.includes('mdblist')?Response.json({ratings:[{source:'imdb',value:8},{source:'tomatoes',value:90},{source:'popcorn',value:85}]}):new Response('secret-omdb',{status:429,headers:{'Retry-After':'60'}})));
    const r=await data<RefreshResult>(await call('/movies/arrival/refresh-scores','POST'));
    expect(r.movie.scores.length).toBe(before.scores.length+3);
    // Three distinct live dimensions retire demo ranking inputs without deleting history.
    expect(r.movie.ranking?.sources).toEqual([
      {provider:'imdb',metric:'rating',value:80,retrieved_via:'mdblist'},
      {provider:'rottentomatoes',metric:'audience',value:85,retrieved_via:'mdblist'},
      {provider:'rottentomatoes',metric:'critic',value:90,retrieved_via:'mdblist'},
    ]);
    expect(r.movie.ranking?.availableScoreAverage).toBe(85);
    expect(r.movie.ranking?.imputedScores).toEqual([
      {provider:'letterboxd',metric:'rating',value:85},
      {provider:'metacritic',metric:'critic',value:85},
      {provider:'tmdb',metric:'rating',value:85},
    ]);
    expect(r.movie.ranking?.rawScore).toBe(43_400);
    const demoTmdb=before.scores.find(s=>s.provider==='tmdb'&&s.metric==='rating'&&s.retrieved_via==='development-demo');
    expect(demoTmdb).toMatchObject({raw_value:8.3,raw_scale:10});
    expect(r.movie.scores).toContainEqual(demoTmdb);
    expect(r.providers.find(p=>p.provider==='omdb')).toMatchObject({status:'failed',retryAfter:60});expect(JSON.stringify(r)).not.toContain('secret-');
    expect(r.movie.scores.filter(s=>s.retrieved_via==='mdblist')).toHaveLength(3);
  });
  it('deduplicates a refresh operation and retains older capture times',async()=>{
    const repo=new Repository(local.db), score={provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:null,fetched_at:'2026-10-01T00:00:00Z',retrieved_via:'mdblist'};
    await repo.appendScores('moon',[score,score]);await repo.appendScores('moon',[{...score,fetched_at:'2026-10-02T00:00:00Z'}]);
    expect(local.sqlite.prepare("SELECT count(*) n FROM source_scores WHERE movie_id='moon' AND retrieved_via='mdblist'").get()?.n).toBe(2);
  });
  it('bounds enrichment and batches MDBList lookups',async()=>{
    env.MDBLIST_API_KEY='key';const repo=new Repository(local.db);
    for(let i=1;i<=12;i++){const id=await repo.manualMovie({title:`Fictional candidate ${i}`});await repo.setClassic(id,true);local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'imdb',`tt${String(i).padStart(7,'0')}`);}
    const fetch=vi.fn(async(_url:string,init:RequestInit)=>Response.json(JSON.parse(init.body as string).ids.map((imdb_id:string)=>({imdb_id,ratings:[{source:'imdb',value:8},{source:'tomatoes',value:90},{source:'popcorn',value:85}]}))));vi.stubGlobal('fetch',fetch);
    const r=await data<{results:RefreshResult[];remaining:number;unidentified:number}>(await call('/classics/enrich','POST',{limit:10}));expect(r.results).toHaveLength(10);expect(r.remaining).toBe(2);expect(fetch).toHaveBeenCalledTimes(1);
    expect((await call('/classics/enrich','POST',{limit:11})).status).toBe(422);
  });
  it('suppresses all MDBList calls after a provider-wide batch failure, including mixed ID groups',async()=>{
    env.MDBLIST_API_KEY='key';local.sqlite.exec('DELETE FROM classics');const repo=new Repository(local.db);
    for(let i=1;i<=5;i++){const id=await repo.manualMovie({title:`IMDb failed ${i}`});await repo.setClassic(id,true);local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'imdb',`tt${String(i).padStart(7,'0')}`);}
    for(let i=1;i<=5;i++){const id=await repo.manualMovie({title:`TMDB skipped ${i}`});await repo.setClassic(id,true);local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'tmdb',String(1000+i));}
    const fetch=vi.fn().mockResolvedValue(new Response(null,{status:503}));vi.stubGlobal('fetch',fetch);
    const result=await data<{results:RefreshResult[]}>(await call('/classics/enrich','POST',{limit:10}));
    expect(fetch).toHaveBeenCalledTimes(1);expect(result.results.filter(r=>r.providers.find(p=>p.provider==='mdblist')?.status==='skipped')).toHaveLength(5);
  });
  it('suppresses OMDb after one provider-wide fallback failure during bulk enrichment',async()=>{
    env.MDBLIST_API_KEY='key';env.OMDB_API_KEY='key';local.sqlite.exec('DELETE FROM classics');const repo=new Repository(local.db);
    for(let i=1;i<=10;i++){const id=await repo.manualMovie({title:`OMDb failed ${i}`});await repo.setClassic(id,true);local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'imdb',`tt${String(i).padStart(7,'0')}`);}
    const fetch=vi.fn(async(url:string,init?:RequestInit)=>url.includes('mdblist') ? Response.json(JSON.parse(init!.body as string).ids.map((imdb_id:string)=>({imdb_id,ratings:[{source:'popcorn',value:85}]}))) : new Response(null,{status:503}));vi.stubGlobal('fetch',fetch);
    const result=await data<{results:RefreshResult[]}>(await call('/classics/enrich','POST',{limit:10}));
    expect(fetch.mock.calls.filter(([url])=>String(url).includes('omdbapi')).length).toBe(1);expect(result.results.filter(r=>r.providers.find(p=>p.provider==='omdb')?.status==='skipped')).toHaveLength(9);
  });
  it('guards new endpoints before any database access',async()=>{
    env={...env,APP_ENV:'production',DB:{} as D1Database};for(const [path,method] of [['/movies/arrival/refresh-scores','POST'],['/classics/enrich','POST'],['/movies/arrival/classics','PUT'],['/cycles','GET']]) expect((await call(path,method,method==='GET'?undefined:{})).status).toBe(401);
  });
});
