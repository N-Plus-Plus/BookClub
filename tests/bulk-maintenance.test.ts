import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../worker/src/index';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import type { Env } from '../worker/src/http';
import type { ScoreMaintenance } from '../shared/types';
let local: ReturnType<typeof disposableD1>, env: Env;
const call = (mode: string, movie_ids: string[], member='member-1') => worker.fetch(new Request('http://api/api/v1/movies/maintain',{method:'POST',headers:{'X-BookClub-Dev-Member':member},body:JSON.stringify({mode,movie_ids})}),env);
const data = async (response: Response): Promise<ScoreMaintenance> => { expect(response.status,await response.clone().text()).toBe(200); return (await response.json() as {data:ScoreMaintenance}).data; };
const ratings = [{source:'imdb',value:9},{source:'tomatoes',value:92},{source:'popcorn',value:93},{source:'letterboxd',value:4},{source:'metacritic',value:85},{source:'tmdb',value:81}];
beforeEach(() => {
  local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'");
  env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173',MDBLIST_API_KEY:'fictional',OMDB_API_KEY:'fictional'};
});
afterEach(() => { local.sqlite.close(); vi.unstubAllGlobals(); });
const add = async (id: string, provider='imdb') => {
 const repo=new Repository(local.db); const film=await repo.manualMovie({title:id}); await repo.setClassic(film,true);
 local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(film,provider,provider==='imdb'?id:'123'); return film;
};
it('guards all modes as admin only and rejects bounds or films outside Classics/History before provider calls',async() => {
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 for (const mode of ['missing','refresh','metadata']) expect((await call(mode,['arrival'],'member-2')).status).toBe(403);
 expect((await call('refresh',Array(11).fill('arrival'))).status).toBe(422);
 const orphan=await new Repository(local.db).manualMovie({title:'Orphan'});
 expect((await call('refresh',[orphan])).status).toBe(422);expect(fetch).not.toHaveBeenCalled();
});
it('batches History and Classics together, deduplicates shared films, preserves Seen/History and recalculates rankings',async() => {
 const repo=new Repository(local.db), before=await repo.catalog();const candidate=await add('tt0000001');
 const fetch=vi.fn(async(_url:string,init:RequestInit) => Response.json(JSON.parse(init.body as string).ids.map((imdb_id:string) => ({imdb_id,ratings}))));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('refresh',['arrival',candidate,'arrival']));
 expect(result.results.map(r=>r.movie.id)).toEqual(['arrival',candidate]);expect(fetch).toHaveBeenCalledTimes(1);
 expect(result.results[0].movie.appearances.length).toBeGreaterThan(0);
 const after=await repo.catalog();expect(after.sessions.map(s=>[s.id,s.host_member_id,s.movies.map(m=>m.id)])).toEqual(before.sessions.map(s=>[s.id,s.host_member_id,s.movies.map(m=>m.id)]));
 expect(after.movies.find(m=>m.id==='arrival')!.seen).toEqual(before.movies.find(m=>m.id==='arrival')!.seen);
 expect(result.results[1].movie.ranking!.sources).toHaveLength(6);
});
it('populates all returned MDBList inputs and does not fetch films merely missing Seen answers',async() => {
 const film=await add('tt0000002'),repo=new Repository(local.db);
 await repo.appendScores(film,[{provider:'imdb',metric:'rating',raw_value:7,raw_scale:10,normalized_value:70,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'mdblist'}]);
 const fetch=vi.fn(async(_url:string,init:RequestInit)=>Response.json(JSON.parse(init.body as string).ids.map((imdb_id:string)=>({imdb_id,ratings}))));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[film]));expect(result.results[0].movie.scores.filter(s=>s.provider==='imdb')).toHaveLength(2);
 expect(result.results[0].movie.ranking?.rankable).toBe(false);
 expect((await data(await call('missing',[film]))).results).toHaveLength(0);expect(fetch).toHaveBeenCalledTimes(1);
});
it('refreshes OMDb fallback despite old scores, reuses metadata without extra calls, and preserves unavailable fields',async()=>{
 const film=await add('tt0000003'),repo=new Repository(local.db);env.MDBLIST_API_KEY=undefined;
 await repo.appendScores(film,[{provider:'imdb',metric:'rating',raw_value:7,raw_scale:10,normalized_value:70,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'omdb'}]);
 const fetch=vi.fn().mockResolvedValue(Response.json({Response:'True',imdbRating:'8.5',Year:'1999',Runtime:'123 min',Director:'A Director',Genre:'Drama, Sci-Fi',Ratings:[{Source:'Rotten Tomatoes',Value:'90%'}]}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('refresh',[film]));expect(fetch).toHaveBeenCalledTimes(1);expect(result.results[0].movie).toMatchObject({year:1999,runtime:123,director:'A Director',genres:['Drama','Sci-Fi']});
 expect(result.results[0].movie.ranking!.sources.find(s=>s.provider==='imdb')?.value).toBe(85);
 fetch.mockResolvedValue(Response.json({Response:'True',Year:'N/A',Runtime:'N/A',Director:'N/A',Genre:'N/A'}));
 const metadata=await data(await call('metadata',[film]));expect(metadata.results[0].movie).toMatchObject({year:1999,runtime:123,director:'A Director',genres:['Drama','Sci-Fi']});
 expect(metadata.results[0].movie.scores).toEqual(result.results[0].movie.scores);
});
it('honours Retry-After and suppresses calls after a provider failure across subsequent requests',async()=>{
 const a=await add('tt0000004'),b=await add('tt0000005','tmdb');env.OMDB_API_KEY=undefined;
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:429,headers:{'Retry-After':'120'}}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('refresh',[a,b]));expect(fetch).toHaveBeenCalledTimes(1);expect(result.results[0].providers.find(p=>p.provider==='mdblist')).toMatchObject({status:'failed',retryAfter:120});
 await data(await call('refresh',[a]));expect(fetch).toHaveBeenCalledTimes(1);
});
it('stops upstream requests proactively when a successful response reports quota exhaustion',async()=>{
 const film=await add('tt0000006');env.OMDB_API_KEY=undefined;
 const fetch=vi.fn().mockResolvedValue(Response.json([{imdb_id:'tt0000006',ratings}],{headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(Math.ceil(Date.now()/1000)+120)}}));vi.stubGlobal('fetch',fetch);
 await data(await call('refresh',[film]));await data(await call('refresh',[film]));expect(fetch).toHaveBeenCalledTimes(1);
});
it('recognises OMDb body-level quota limits, retains saved data and avoids repeated requests',async()=>{
 const a=await add('tt0000007'),b=await add('tt0000008');
 const fetch=vi.fn().mockResolvedValue(Response.json({Response:'False',Error:'Request limit reached!'}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('metadata',[a,b]));expect(fetch).toHaveBeenCalledTimes(1);
 expect(result.results[0].providers[0]).toMatchObject({status:'failed',retryAfter:86400});expect(result.results[1].providers[0].status).toBe('skipped');
});

it('captures six MDBList signals even when the original three are present, without direct TMDB calls or persisted imputation',async()=>{
 const film=await add('tt0000010'),repo=new Repository(local.db);env.TMDB_READ_TOKEN='fictional';
 local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(film,'tmdb','10');
 await repo.appendScores(film,ratings.slice(0,3).map(r=>({provider:r.source==='imdb'?'imdb':'rottentomatoes',metric:r.source==='imdb'?'rating':r.source==='tomatoes'?'critic':'audience',raw_value:r.value,raw_scale:r.source==='imdb'?10:100,normalized_value:null,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'mdblist'})));
 const fetch=vi.fn().mockResolvedValue(Response.json([{imdb_id:'tt0000010',ratings}]));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[film]));expect(fetch).toHaveBeenCalledTimes(1);
 const movie=result.results[0].movie;
 expect(movie.ranking!.sources.map(s=>s.provider)).toContain('letterboxd');
 expect(movie.scores.filter(s=>['letterboxd','metacritic','tmdb'].includes(s.provider)).map(s=>[s.provider,s.normalized_value])).toEqual(expect.arrayContaining([['letterboxd',80],['metacritic',85],['tmdb',81]]));
 expect(movie.scores).toHaveLength(9);expect(movie.ranking!.imputedScores).toEqual([]);
});
it('uses direct TMDB only when its score is missing and reuses its stored result on Populate',async()=>{
 const film=await add('tt0000011'),repo=new Repository(local.db);env.TMDB_READ_TOKEN='fictional';env.OMDB_API_KEY=undefined;
 local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(film,'tmdb','11');
 const fetch=vi.fn(async(url:string)=>String(url).includes('mdblist')?Response.json([{imdb_id:'tt0000011',ratings:[]}]) : Response.json({id:11,title:'Film',vote_average:8.4,vote_count:100}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[film]));
 expect(fetch).toHaveBeenCalledTimes(2);expect(result.results[0].movie.ranking!.sources).toHaveLength(1);
 expect(result.results[0].movie.ranking!.imputedScores).toHaveLength(5);
 expect(result.results[0].movie.scores).toHaveLength(1);expect(result.results[0].movie.scores[0]).toMatchObject({provider:'tmdb',raw_scale:10,retrieved_via:'tmdb'});
 expect(result.results[0].movie.scores[0].normalized_value).toBeCloseTo(84);
 await data(await call('missing',[film]));expect(fetch).toHaveBeenCalledTimes(3);
 expect(fetch.mock.calls.filter(([url])=>String(url).includes('themoviedb'))).toHaveLength(1);
 expect((await repo.catalog()).movies.find(m=>m.id===film)!.scores).toHaveLength(1);
});
it('requests OMDb for missing Metacritic and retains MDBList precedence for duplicate IMDb/RT values',async()=>{
 const film=await add('tt0000012');
 const fetch=vi.fn(async(url:string)=>String(url).includes('mdblist')?Response.json([{imdb_id:'tt0000012',ratings:ratings.filter(r=>r.source!=='metacritic')}]) : Response.json({Response:'True',imdbRating:'5',Metascore:'77',Ratings:[{Source:'Rotten Tomatoes',Value:'50%'}]}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('refresh',[film]));expect(fetch).toHaveBeenCalledTimes(2);
 expect(result.results[0].movie.ranking!.sources.find(s=>s.provider==='imdb')).toMatchObject({value:90,retrieved_via:'mdblist'});
 expect(result.results[0].movie.ranking!.sources.find(s=>s.provider==='metacritic')).toMatchObject({value:77,retrieved_via:'omdb'});
});
it('legacy score routes also require admin and expose no ordinary-member maintenance',async()=>{
 for(const path of ['/movies/arrival/refresh-scores','/classics/enrich']) {
  const response=await worker.fetch(new Request('http://api/api/v1'+path,{method:'POST',headers:{'X-BookClub-Dev-Member':'member-2'},body:'{}'}),env);
  expect(response.status).toBe(403);
 }
});

it('persists TMDB cooldowns and suppresses duplicate direct requests within and across batches',async()=>{
 env.MDBLIST_API_KEY=undefined;env.OMDB_API_KEY=undefined;env.TMDB_READ_TOKEN='fictional';
 const a=await add('first','tmdb');
 local.sqlite.prepare("UPDATE movie_external_ids SET external_id='124' WHERE movie_id=? AND provider='tmdb'").run(a);
 const b=await add('second','tmdb');
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:429,headers:{'Retry-After':'120'}}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('refresh',[a,b]));expect(fetch).toHaveBeenCalledTimes(1);
 expect(result.results[0].providers.find(p=>p.provider==='tmdb')).toMatchObject({status:'failed',retryAfter:120});
 expect(result.results[1].providers.find(p=>p.provider==='tmdb')).toMatchObject({status:'skipped'});
 await data(await call('refresh',[a]));expect(fetch).toHaveBeenCalledTimes(1);
});
