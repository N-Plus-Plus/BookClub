import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../worker/src/index';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import type { Env } from '../worker/src/http';
import { maintainScores } from '../frontend/score-maintenance';
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
afterEach(() => { local.sqlite.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
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
 const fetch=vi.fn(async(_url:string,init:RequestInit) => Response.json(JSON.parse(init.body as string).ids.map((imdbid:string) => ({ids:{imdb:imdbid},ratings}))));vi.stubGlobal('fetch',fetch);
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
 const fetch=vi.fn(async(_url:string,init:RequestInit)=>Response.json(JSON.parse(init.body as string).ids.map((imdbid:string)=>({ids:{imdb:imdbid},ratings}))));vi.stubGlobal('fetch',fetch);
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
 const fetch=vi.fn().mockResolvedValue(Response.json([{ids:{imdb:'tt0000006'},ratings}],{headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(Math.ceil(Date.now()/1000)+120)}}));vi.stubGlobal('fetch',fetch);
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
 const fetch=vi.fn().mockResolvedValue(Response.json([{ids:{imdb:'tt0000010'},ratings}]));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[film]));expect(fetch).toHaveBeenCalledTimes(1);
 const movie=result.results[0].movie;
 expect(movie.ranking!.sources.map(s=>s.provider)).toContain('letterboxd');
 expect(movie.scores.filter(s=>['letterboxd','metacritic','tmdb'].includes(s.provider)).map(s=>[s.provider,s.normalized_value])).toEqual(expect.arrayContaining([['letterboxd',80],['metacritic',85],['tmdb',81]]));
 expect(movie.scores).toHaveLength(9);expect(movie.ranking!.imputedScores).toEqual([]);
});
it('uses direct TMDB only when its score is missing and reuses its stored result on Populate',async()=>{
 const film=await add('tt0000011'),repo=new Repository(local.db);env.TMDB_READ_TOKEN='fictional';env.OMDB_API_KEY=undefined;
 local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(film,'tmdb','11');
 const fetch=vi.fn(async(url:string)=>String(url).includes('mdblist')?Response.json([{ids:{imdb:'tt0000011'},ratings:[]}]) : Response.json({id:11,title:'Film',vote_average:8.4,vote_count:100}));vi.stubGlobal('fetch',fetch);
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
 const fetch=vi.fn(async(url:string)=>String(url).includes('mdblist')?Response.json([{ids:{imdb:'tt0000012'},ratings:ratings.filter(r=>r.source!=='metacritic')}]) : Response.json({Response:'True',imdbRating:'5',Metascore:'77',Ratings:[{Source:'Rotten Tomatoes',Value:'50%'}]}));vi.stubGlobal('fetch',fetch);
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

it('uses only selected-film reads and returns the ordinary detail contract, including repeated appearances',async()=>{
 const repo=new Repository(local.db);
 local.sqlite.exec("INSERT INTO session_movies(session_id,movie_id,position) SELECT session_id,movie_id,(SELECT MAX(position)+1 FROM session_movies j WHERE j.session_id=session_movies.session_id) FROM session_movies WHERE movie_id='arrival' LIMIT 1");
 const catalog=await repo.catalog();
 const movie=catalog.movies.find(m=>m.id==='arrival')!;
 const expected={...movie,appearances:catalog.sessions.flatMap(s=>s.movies.flatMap((m,i)=>m.id==='arrival'?[{id:s.id,event_date:s.event_date,date_precision:s.date_precision,kind:s.kind,host_member_id:s.host_member_id,position:i+1}]:[]))};
 const spy=vi.spyOn(Repository.prototype,'catalog').mockRejectedValue(new Error('Full catalogue forbidden'));
 env.MDBLIST_API_KEY=undefined;env.OMDB_API_KEY=undefined;
 const result=await data(await call('refresh',['arrival']));
 expected.external_ids.sort((a,b)=>a.provider.localeCompare(b.provider));
 result.results[0].movie.external_ids.sort((a,b)=>a.provider.localeCompare(b.provider));
 expect(result.results[0].movie).toEqual(expected);expect(spy).not.toHaveBeenCalled();
 const orphan=await repo.manualMovie({title:'Deleted History only'});
 local.sqlite.prepare("INSERT INTO sessions(id,event_date,kind,date_precision,deleted_at) VALUES('deleted','2020-01-01','hosted','exact','2020-02-01')").run();
 local.sqlite.prepare("INSERT INTO session_movies(session_id,movie_id,position) VALUES('deleted',?,1)").run(orphan);
 expect((await call('refresh',[orphan])).status).toBe(422);
});
it('serves ordinary auth and catalogue reads while a maintenance provider response is pending',async()=>{
 const film=await add('tt0000020');
 let release!: (response:Response)=>void, entered!: ()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;});
 vi.stubGlobal('fetch',vi.fn(()=>{entered();return new Promise<Response>(resolve=>{release=resolve;});}));
 const pending=call('refresh',[film]);await started;
 try {
  for (const path of ['/auth/me','/catalog']) {
   const response=await worker.fetch(new Request('http://api/api/v1'+path,{headers:{'X-BookClub-Dev-Member':'member-1'}}),env);
   expect(response.status).toBe(200);
  }
 } finally {release(Response.json([{ids:{imdb:'tt0000020'},ratings}]));await pending;}
});

it('keeps ten IMDb films in one MDBList provider request without catalogue reads',async()=>{
 vi.useFakeTimers();
 try {
  const films=[];
  for(let i=30;i<40;i++) films.push(await add(`tt00000${i}`));
  const fetch=vi.fn(async(_url:string,init:RequestInit)=>Response.json(JSON.parse(init.body as string).ids.map((imdbid:string)=>({ids:{imdb:imdbid},ratings}))));
  vi.stubGlobal('fetch',fetch);
  const catalog=vi.spyOn(Repository.prototype,'catalog').mockRejectedValue(new Error('Full catalogue forbidden'));
  const pending=call('refresh',films);
  await vi.runAllTimersAsync();
  const result=await data(await pending);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body as string).ids).toHaveLength(10);
  expect(result.results.map(r=>r.movie.id)).toEqual(films);
  expect(catalog).not.toHaveBeenCalled();
 } finally {vi.useRealTimers();}
});

it('persists conclusive absence, skips Populate, and reconsiders it on Refresh without changing ranking inputs',async()=>{
 const film=await add('tt0000901');env.TMDB_READ_TOKEN=undefined;
 const fetch=vi.fn(async(url:string,init:RequestInit)=>url.includes('mdblist') ? Response.json([{ids:{imdb:'tt0000901'},ratings:[]}]) : Response.json({Response:'True',Ratings:[]}));vi.stubGlobal('fetch',fetch);
 const repo=new Repository(local.db);
 expect((await repo.scoreMaintenanceStatus()).candidateIds).toContain(film);
 await data(await call('missing',[film]));
 expect(await repo.scoreChecks([film])).toHaveLength(6);
 expect((await repo.scoreChecks([film])).every(c=>c.available===0)).toBe(true);
 expect((await repo.scoreMaintenanceStatus()).candidateIds).not.toContain(film);
 expect((await data(await call('missing',[film]))).results).toHaveLength(0);
 expect(fetch).toHaveBeenCalledTimes(2);
 await data(await call('refresh',[film]));expect(fetch).toHaveBeenCalledTimes(4);
 fetch.mockImplementation(async(url:string)=>url.includes('mdblist') ? Response.json([{ids:{imdb:'tt0000901'},ratings:[{source:'imdb',value:8}]}]) : Response.json({Response:'True',Ratings:[]}));
 const result=await data(await call('refresh',[film]));
 expect((await repo.scoreChecks([film])).find(c=>c.score_key==='imdb:rating')?.available).toBe(1);
 expect(result.results[0].movie.ranking?.sources).toHaveLength(1);
 expect(local.sqlite.prepare('SELECT count(*) n FROM source_scores WHERE movie_id=?').get(film)?.n).toBe(1);
 const catalog=await repo.catalog();expect(JSON.stringify(catalog)).not.toContain('score_key');
 const status=await worker.fetch(new Request('http://api/api/v1/movies/maintenance-status',{headers:{'X-BookClub-Dev-Member':'member-2'}}),env);expect(status.status).toBe(403);
});
it.each(['outage','network','cooldown','credentials'])('does not persist negative checks after %s',async(kind)=>{
 const film=await add('tt0000902');env.OMDB_API_KEY=undefined;
 const fetch=vi.fn(async()=>{if(kind==='network') throw new DOMException('Timed out','TimeoutError');return new Response(null,{status:kind==='cooldown'?429:503});});vi.stubGlobal('fetch',fetch);
 if(kind==='credentials') env.MDBLIST_API_KEY=undefined;
 await data(await call('refresh',[film]));expect(await new Repository(local.db).scoreChecks([film])).toEqual([]);
});
it('exhausts fallback before a negative check and leaves failed fallback dimensions unchanged',async()=>{
 const film=await add('tt0000903');
 const fetch=vi.fn(async(url:string)=>{
   if(url.includes('mdblist')) return Response.json([{ids:{imdb:'tt0000903'},ratings:[]}]);
   expect((await new Repository(local.db).scoreChecks([film])).find(c=>c.score_key==='imdb:rating')).toBeUndefined();
   return new Response(null,{status:503});
 });vi.stubGlobal('fetch',fetch);
 await data(await call('missing',[film]));
 const checks=await new Repository(local.db).scoreChecks([film]);expect(checks.find(c=>c.score_key==='imdb:rating')).toBeUndefined();expect(checks.find(c=>c.score_key==='rottentomatoes:audience')?.available).toBe(0);
 // A negative RT audience observation must not drive an OMDb request on the next Populate.
});

it('only unresolved dimensions drive provider fallback and incomplete batch entries are inconclusive',async()=>{
 const film=await add('tt0000904'),repo=new Repository(local.db);
 await repo.saveScoreChecks(film,['imdb:rating','rottentomatoes:critic','metacritic:critic','tmdb:rating','rottentomatoes:audience'].map(key=>({key,available:false})));
 const fetch=vi.fn(async(_url:string,_init?:RequestInit)=>Response.json([{ids:{imdb:'tt0000904'},ratings:[]}]));vi.stubGlobal('fetch',fetch);
 await data(await call('missing',[film]));expect(fetch).toHaveBeenCalledTimes(1);expect((await repo.scoreChecks([film])).find(c=>c.score_key==='letterboxd:rating')?.available).toBe(0);
 const other=await add('tt0000905');env.OMDB_API_KEY=undefined;fetch.mockImplementation(async(_url:string,init?:RequestInit)=>init?.method==='POST'?Response.json([]):new Response(null,{status:404}));
 await data(await call('missing',[other]));expect(await repo.scoreChecks([other])).toEqual([]);
});
it.each(['imdb','tmdb'])('captures a partial %s batch but keeps the omitted film incomplete and eligible',async(provider)=>{
 const a=await add('tt0000951',provider),repo=new Repository(local.db);
 if(provider==='tmdb') local.sqlite.prepare("UPDATE movie_external_ids SET external_id='124' WHERE movie_id=? AND provider='tmdb'").run(a);
 const b=await add('tt0000952',provider);
 env.OMDB_API_KEY=undefined;
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const fetch=vi.fn().mockResolvedValueOnce(Response.json([{id:999,ids:provider==='imdb'?{imdb:'tt0000951'}:{tmdb:124},ratings}])).mockResolvedValue(new Response(null,{status:404}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[a,b]));
 expect(fetch).toHaveBeenCalledTimes(2);
 expect(result.results[0].providers.find(p=>p.provider==='mdblist')).toMatchObject({status:'success',count:6});
 expect(result.results[0].movie.scores).toHaveLength(6);
 expect(result.results[1].providers.find(p=>p.provider==='mdblist')).toMatchObject({status:'failed',count:0,blocking:false,message:'MDBList could not find this film.'});
 expect(result.results[1].movie.scores).toEqual([]);expect(await repo.scoreChecks([b])).toEqual([]);
 expect((await repo.scoreMaintenanceStatus()).candidateIds).toContain(b);
 expect(warn).toHaveBeenCalledTimes(1);
});
it('legacy-only ratings remain unresolved and the third live capture immediately retires all legacy',async()=>{
 const film=await add('tt0000910'),repo=new Repository(local.db);
 const {requiredScores}=await import('../shared/ranking');
 await repo.appendScores(film,requiredScores.map(key=>{const [provider,metric]=key.split(':');return {provider,metric,raw_value:70,raw_scale:100,normalized_value:null,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'legacy-spreadsheet'};}));
 expect((await repo.scoreMaintenanceStatus()).candidateIds).toContain(film);
 await repo.appendScores(film,ratings.slice(0,2).map(r=>({provider:r.source==='imdb'?'imdb':'rottentomatoes',metric:r.source==='imdb'?'rating':'critic',raw_value:r.value,raw_scale:r.source==='imdb'?10:100,normalized_value:null,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'mdblist'})));
 const fetch=vi.fn(async(url:string)=>url.includes('mdblist')?Response.json([{ids:{imdb:'tt0000910'},ratings:[{source:'letterboxd',value:4}]}]):Response.json({Response:'True',Ratings:[]}));vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[film]));
 expect(result.results[0].movie.ranking!.sources).toHaveLength(3);
 expect(result.results[0].movie.ranking!.sources.every(s=>s.retrieved_via!=='legacy-spreadsheet')).toBe(true);
 expect(result.results[0].movie.ranking!.imputedScores).toHaveLength(3);
 expect(result.results[0].movie.scores.filter(s=>s.retrieved_via==='legacy-spreadsheet')).toHaveLength(6);
 expect((await repo.scoreChecks([film])).find(c=>c.score_key==='metacritic:critic')?.available).toBe(0);
 expect((await data(await call('missing',[film]))).results).toHaveLength(0);
 await data(await call('refresh',[film]));expect(fetch).toHaveBeenCalledTimes(4);
});

it.each(['scores','empty','not_found'])('recovers only the omitted film in a ten-film batch with %s and continues the run',async(outcome)=>{
 vi.useFakeTimers();env.OMDB_API_KEY=undefined;
 const films=[];for(let i=100;i<111;i++) films.push(await add(`tt0000${i}`));
 const repo=new Repository(local.db), omitted=films[4];
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method==='POST') {
   const ids=JSON.parse(init.body as string).ids as string[];
   return Response.json(ids.filter(id=>id!=='tt0000104').reverse().map(id=>({ids:{imdb:id},ratings})));
  }
  expect(url).toContain('/imdb/movie/tt0000104/');
  return outcome==='not_found'?new Response(null,{status:404}):Response.json({ratings:outcome==='scores'?ratings:[]});
 });vi.stubGlobal('fetch',fetch);
 const promise=maintainScores({ids:films,batch:async ids=>data(await call('missing',ids)),stopped:()=>false,progress:async()=>{}});
 await vi.runAllTimersAsync();const run=await promise;
 expect(fetch).toHaveBeenCalledTimes(3);expect(fetch.mock.calls.filter(([,init])=>init?.method!=='POST')).toHaveLength(1);
 expect(run).toMatchObject({processed:11,remaining:0,failed:outcome==='not_found'?1:0,updated:outcome==='scores'?11:10});
 expect(warn).toHaveBeenCalledWith('MDBList batch correlation incomplete',expect.objectContaining({requested:10,returned:9,matched:9}));
 if(outcome==='not_found') {
  expect(run.message).toBe('Finished with 1 unresolved film. Completed updates are saved.');
  expect(await repo.scoreChecks([omitted])).toEqual([]);
  expect((await repo.scoreMaintenanceStatus()).candidateIds).toContain(omitted);
  expect(run.providers.find(p=>p.status==='failed')).toMatchObject({filmTitle:'tt0000104',blocking:false});
 } else if(outcome==='empty') {
  const checks=await repo.scoreChecks([omitted]);
  expect(checks.filter(c=>c.available===0).map(c=>c.score_key)).toEqual(expect.arrayContaining(['letterboxd:rating','rottentomatoes:audience','tmdb:rating']));
  expect(checks.some(c=>c.score_key==='imdb:rating')).toBe(false); // Missing OMDb credentials remain inconclusive.
 } else expect((await repo.movieDetails([omitted]))[0].scores).toHaveLength(6);
 expect((await repo.movieDetails([films[0],films[10]])).every(m=>m.scores.length===6)).toBe(true);
});
it('a valid empty targeted recovery exhausts OMDb/TMDB fallback before writing conclusive checks',async()=>{
 const film=await add('tt0000120'),repo=new Repository(local.db);env.TMDB_READ_TOKEN='fictional';
 local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(film,'tmdb','120');
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.includes('mdblist')) return Response.json(init?.method==='POST'?[]:{ratings:[]});
  if(url.includes('omdbapi')) return Response.json({Response:'True',Ratings:[]});
  return Response.json({id:120,title:'Film',vote_average:null,vote_count:0});
 });vi.stubGlobal('fetch',fetch);
 const result=await data(await call('missing',[film]));
 expect(fetch).toHaveBeenCalledTimes(4);expect(result.results[0].providers.every(p=>p.status==='success')).toBe(true);
 const checks=await repo.scoreChecks([film]);expect(checks).toHaveLength(6);expect(checks.every(c=>c.available===0)).toBe(true);
});
it.each(['rate_limited','credentials','outage','network','contract'])('stops after a blocking %s during targeted recovery without retrying or losing matched updates',async(kind)=>{
 vi.useFakeTimers();env.OMDB_API_KEY=undefined;
 const films=[];for(let i=130;i<141;i++) films.push(await add(`tt0000${i}`));
 const fetch=vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST') return Response.json((JSON.parse(init.body as string).ids as string[]).filter(id=>!['tt0000131','tt0000132'].includes(id)).map(id=>({ids:{imdb:id},ratings})));
  if(kind==='network') throw new Error('private upstream URL');
  if(kind==='contract') return Response.json({private:'payload'});
  return new Response(null,{status:kind==='rate_limited'?429:kind==='credentials'?401:503,headers:kind==='rate_limited'?{'Retry-After':'120'}:{}});
 });vi.stubGlobal('fetch',fetch);
 const promise=maintainScores({ids:films,batch:async ids=>data(await call('missing',ids)),stopped:()=>false,progress:async()=>{}});
 await vi.runAllTimersAsync();const run=await promise;
 expect(fetch).toHaveBeenCalledTimes(2);expect(run).toMatchObject({processed:10,remaining:1,updated:8,failed:1});expect(run.message).toContain('provider failure');
 const repo=new Repository(local.db);
 expect(await repo.scoreChecks([films[1],films[2]])).toEqual([]);
 expect((await repo.movieDetails([films[0],films[9]])).every(m=>m.scores.length===6)).toBe(true);
 if(kind==='rate_limited') {
  expect(run.providers.find(p=>p.status==='failed')).toMatchObject({blocking:true,retryAfter:120});
  await data(await call('refresh',[films[1]]));expect(fetch).toHaveBeenCalledTimes(2);
 }
});
it.each(['credentials','outage','network','contract','batch_not_found'])('stops on a provider-wide %s batch failure with no single-film recovery',async(kind)=>{
 vi.useFakeTimers();env.OMDB_API_KEY=undefined;
 const films=[];for(let i=150;i<161;i++) films.push(await add(`tt0000${i}`));
 const fetch=vi.fn(async()=>{
  if(kind==='network') throw new Error('private URL');
  if(kind==='contract') return Response.json([{ratings:[]}]);
  return new Response(null,{status:kind==='credentials'?403:kind==='batch_not_found'?404:503});
 });vi.stubGlobal('fetch',fetch);
 const promise=maintainScores({ids:films,batch:async ids=>data(await call('missing',ids)),stopped:()=>false,progress:async()=>{}});
 await vi.runAllTimersAsync();const run=await promise;
 expect(fetch).toHaveBeenCalledTimes(1);expect(run.remaining).toBe(1);expect(run.message).toContain('provider failure');
 expect(await new Repository(local.db).scoreChecks(films)).toEqual([]);
});
