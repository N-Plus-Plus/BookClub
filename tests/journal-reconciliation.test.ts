// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../worker/src/index';
import { Repository } from '../worker/src/repository';
import { catalogIndex } from '../shared/catalog-index';
import { missingAnswers } from '../shared/ranking';
import { ProductRepository } from '../worker/src/product-repository';
import { MetricsRepository } from '../worker/src/metrics-repository';
import { hydrateCatalog } from '../shared/catalog';
import { calculateMetrics, metricsDashboard, contributorMetrics } from '../shared/metrics';
import { filmEconomics, themeFingerprint, recurringTalent } from '../shared/metrics-enrichment';
import { genreRevenue, collectionCompletion } from '../shared/metrics-staging/films';
import { classicsViewed } from '../shared/metrics-staging/numerical';
import { disposableD1 } from './d1';
import { api } from '../frontend/api';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { metricsCatalog, selectedAppearances, extremesCabinet, type MetricsFilter } from '../shared/metrics';
import { useBookClubData } from '../frontend/useBookClubData';
import type { Catalog, JournalMutationResult, MovieDetail, Rotation } from '../shared/types';
import type { Env } from '../worker/src/http';
vi.mock('../frontend/api',()=>({api:{health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(),seen:vi.fn(),metricsEnrichment:vi.fn()},hasSession:()=>true,ApiClientError:class extends Error {}}));
let local:ReturnType<typeof disposableD1>,repo:Repository,product:ProductRepository,env:Env,root:Root,container:HTMLDivElement,data:ReturnType<typeof useBookClubData>;
let showMetrics=false;
function Probe(){data=useBookClubData(false);return showMetrics && data.catalog ? h(MetricsScreen,{catalog:data.catalog,viewer:data.viewer,onUpdated:data.refreshData,resource:data.metricsResource}) : null;}
async function mutation(path:string,method:string,input?:unknown):Promise<JournalMutationResult> {
  const response=await worker.fetch(new Request(`http://local/api/v1${path}`,{method,headers:{'X-BookClub-Dev-Member':'member-2'},...(input?{body:JSON.stringify(input)}:{})}),env);
  expect(response.ok,await response.clone().text()).toBe(true);return (await response.json() as {data:JournalMutationResult}).data;
}
async function apply(result:JournalMutationResult){await act(async()=>data.applyJournalMutation(result));}
const counts=()=>{expect(api.catalog).toHaveBeenCalledOnce();expect(api.rotation).toHaveBeenCalledOnce();};
beforeEach(async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.resetAllMocks();showMetrics=false;vi.mocked(api.metricsEnrichment).mockResolvedValue({movies:{}});local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-2';UPDATE sessions SET date_precision='exact' WHERE id='demo-2'");repo=new Repository(local.db);product=new ProductRepository(local.db);env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'};
  vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,tmdbConfigured:false,mdblistConfigured:false,omdbConfigured:false,demo:true});
  vi.mocked(api.me).mockResolvedValue({viewer:{id:'member-2',display_name:'Troy',sort_order:2,avatar:2,role:'admin'}});
  vi.mocked(api.catalog).mockImplementation(()=>repo.catalog());vi.mocked(api.rotation).mockImplementation(()=>product.rotation());
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  await act(async()=>root.render(h(Probe)));await act(async()=>data.load());
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();local.sqlite.close();});
it('Event create applies authoritative History, Seen/ranking, new cycle and rotation with zero follow-up reads',async()=>{
  local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');const turn=(await product.rotation())!;
  const invalidate=vi.spyOn(data.metricsResource,'invalidate');
  const result=await mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle','bicycle'],cycle_slot:1,cycle_id:null,complete_turn:true,turn_version:turn.version});
  expect(result.session?.movies.map(movie=>movie.id)).toEqual(['bicycle','bicycle']);expect(result.cycle?.id).toBe(result.session?.cycle_id);expect(result.rotation?.nominal_slot).toBe(2);
  await apply(result);counts();expect(invalidate).toHaveBeenCalledOnce();expect(data.rotation).toEqual(result.rotation);
  const movie=data.catalog!.movies.find(movie=>movie.id==='bicycle')!;expect(movie.seen.every(answer=>answer.seen===1)).toBe(true);expect(movie.ranking?.eligible).toBe(false);
  expect(data.catalog!.sessions[0].movies[0]).toBe(movie);expect(data.catalog!.cycles.find(cycle=>cycle.id===result.cycle!.id)).toEqual(result.cycle);
});
it('Event edit replaces its session without broad reads; anchor correction patches only affected rough dates',async()=>{
  const before=data.catalog!,untouched=before.sessions.find(session=>session.id==='demo-2')!;
  const result=await mutation('/sessions/demo-1','PUT',{event_date:'2030-02-02',cycle_id:'demo-cycle-a',cycle_slot:1,date_precision:'exact',correct_anchor:true,movie_ids:['arrival']});
  expect(result.cycle?.rough_date).toBe('2030-02-02');expect(result.affectedSessionDates?.some(change=>change.id==='demo-classics')).toBe(true);expect(result.rotation).toBeUndefined();
  await apply(result);counts();expect(data.catalog!.sessions.filter(session=>session.id==='demo-1')).toHaveLength(1);
  expect(data.catalog!.sessions.find(session=>session.id==='demo-classics')).toMatchObject({event_date:'2030-02-02',has_audit:true});expect(data.catalog!.sessions.find(session=>session.id===untouched.id)).toEqual(untouched);
});
it('Builder publication reconciles its new cycle, History, Seen and turn and atomically removes the private Builder',async()=>{
  local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');const turn=(await product.rotation())!;
  const builder=await product.saveBuilder('member-2',{title:'Plan',movie_ids:['bicycle','moon']});
  const result=await mutation(`/builders/${builder.id}/publish`,'POST',{revision:builder.revision,event_date:'2031-01-01',cycle_slot:1,cycle_id:null,complete_turn:true,turn_version:turn.version});
  await apply(result);counts();expect(data.catalog!.sessions.find(session=>session.id===result.session!.id)).toEqual(result.session);expect(data.rotation).toEqual(result.rotation);
  for(const id of ['bicycle','moon']) expect(data.catalog!.movies.find(movie=>movie.id===id)!.seen.filter(answer=>answer.seen===1)).toHaveLength(data.catalog!.members.filter(member=>member.active===1).length);
  expect(data.catalog!.cycles.some(cycle=>cycle.id===result.cycle?.id)).toBe(true);expect(data.catalog!.movies.find(movie=>movie.id==='bicycle')?.ranking?.eligible).toBe(false);
  await expect(product.builder('member-2',builder.id)).rejects.toMatchObject({status:404});
});
it('delete retains unrelated History, all movie/Seen state and rotation, invalidates Metrics once and restore reuses reconciliation',async()=>{
  const before=data.catalog!,turn=data.rotation,resource=data.metricsResource;await resource.load(async()=>({movies:{}}));const invalidate=vi.spyOn(resource,'invalidate');
  const removed=await mutation('/sessions/demo-1','DELETE');expect(removed).toEqual({removedSessionId:'demo-1'});await apply(removed);counts();
  expect(data.catalog!.sessions).toEqual(before.sessions.filter(session=>session.id!=='demo-1'));expect(data.catalog!.movies).toBe(before.movies);expect(data.rotation).toBe(turn);expect(invalidate).toHaveBeenCalledOnce();expect(resource.peek()).toBeNull();
  const restored=await mutation('/sessions/demo-1/restore','POST');expect(restored.session?.id).toBe('demo-1');expect(restored.rotation).toBeUndefined();await apply(restored);counts();expect(invalidate).toHaveBeenCalledTimes(2);
  const film=data.catalog!.movies.find(movie=>movie.id===restored.session!.movies[0].id)!;expect(data.catalog!.sessions.find(session=>session.id==='demo-1')?.movies[0]).toBe(film);expect(film.seen.every(answer=>answer.seen===1)).toBe(true);
});
it('older in-flight catalogue and rotation cannot undo a committed event',async()=>{
  const old=data.catalog!,oldTurn=data.rotation;let finishCatalog!:(value:Catalog)=>void,finishRotation!:(value:Rotation|null)=>void;
  vi.mocked(api.catalog).mockImplementationOnce(()=>new Promise(resolve=>{finishCatalog=resolve;}));vi.mocked(api.rotation).mockImplementationOnce(()=>new Promise(resolve=>{finishRotation=resolve;}));
  let refresh!:Promise<void>;await act(async()=>{refresh=data.refreshData();});
  local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');const turn=(await product.rotation())!;
  const result=await mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle'],cycle_slot:1,complete_turn:true,turn_version:turn.version});await apply(result);
  await act(async()=>{finishCatalog(old);finishRotation(oldTurn);await refresh;});expect(data.catalog!.sessions.some(session=>session.id===result.session!.id)).toBe(true);expect(data.rotation).toEqual(result.rotation);
  expect(api.catalog).toHaveBeenCalledTimes(2);expect(api.rotation).toHaveBeenCalledTimes(2);
});
it('History wins over an in-flight Seen intention and keeps all History references canonical',async()=>{
  let finish!:(movie:MovieDetail)=>void;vi.mocked(api.seen).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const result=await mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle']});
  await act(async()=>data.seenAnswers.answer('bicycle','member-2',false,'Bicycle'));await apply(result);counts();
  const movie=data.catalog!.movies.find(movie=>movie.id==='bicycle')!;expect(movie.seen.find(answer=>answer.member_id==='member-2')?.seen).toBe(1);expect(movie.ranking).toMatchObject({seenCount:4,unseenCount:0,eligible:false});
  for (const session of data.catalog!.sessions) for (const film of session.movies.filter(film=>film.id===movie.id)) expect(film).toBe(movie);
  await act(async()=>finish({...movie,appearances:[]}));expect(data.seenAnswers.pending).toBe(0);
});

it('History wins over a Seen save completed during a mutation lease, and the lease releases for later mutations',async()=>{
  const committed=await mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle']});
  let finishJournal!:(result:JournalMutationResult)=>void,finishSeen!:(movie:MovieDetail)=>void;
  const pending=data.readJournalMutation(()=>new Promise(resolve=>{finishJournal=resolve;}));
  vi.mocked(api.seen).mockImplementationOnce(()=>new Promise(resolve=>{finishSeen=resolve;}));
  await act(async()=>data.seenAnswers.answer('bicycle','member-2',false,'Bicycle'));
  const movie=data.catalog!.movies.find(movie=>movie.id==='bicycle')!;
  await act(async()=>finishSeen({...movie,appearances:[]}));expect(data.seenAnswers.pending).toBe(0);
  finishJournal(committed);await apply(await pending);counts();
  expect(data.catalog!.movies.find(movie=>movie.id==='bicycle')?.seen.find(answer=>answer.member_id==='member-2')?.seen).toBe(1);
  const later=await data.readJournalMutation(()=>mutation('/sessions','POST',{event_date:'2031-01-01',movie_ids:['bicycle']}));await apply(later);counts();
  expect(data.catalog!.movies.find(movie=>movie.id==='bicycle')?.seen.find(answer=>answer.member_id==='member-2')?.seen).toBe(1);
});

it.each(['event','builder','classics','restore'] as const)('%s immediately moves incomplete Classics to Seen and removes all active-member queues',async path=>{
 local.sqlite.exec("UPDATE sessions SET deleted_at='2030-01-01';DELETE FROM seen_states WHERE movie_id IN ('bicycle','moon');INSERT OR IGNORE INTO classics(movie_id,source) VALUES('moon','test')");
 // Establish a client snapshot with incomplete Seen answers before committing.
 const snapshot=await repo.catalog();vi.mocked(api.catalog).mockResolvedValueOnce(snapshot);
 await act(async()=>data.refreshData());
 const before=data.catalog!.movies.find(movie=>movie.id==='bicycle')!;
 expect(before.ranking).toMatchObject({eligible:true,unknownCount:4});
 for(const member of data.catalog!.members.filter(member=>member.active===1)) expect(missingAnswers(data.catalog!.movies,data.catalog!.members,member.id,catalogIndex(data.catalog!).historyMovieIds).some(item=>item.movie.id==='bicycle')).toBe(true);
 let result:JournalMutationResult;
 if(path==='builder') {
   const builder=await product.saveBuilder('member-2',{title:'Plan',movie_ids:['bicycle','moon']});
   result=await data.readJournalMutation(()=>mutation(`/builders/${builder.id}/publish`,'POST',{revision:builder.revision,event_date:'2030-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false}));
 } else if(path==='restore') {
   const created=await mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle','moon']});
   await mutation(`/sessions/${created.session!.id}`,'DELETE');
   local.sqlite.exec("DELETE FROM seen_states WHERE movie_id IN ('bicycle','moon')");
   result=await data.readJournalMutation(()=>mutation(`/sessions/${created.session!.id}/restore`,'POST'));
 } else {
   if(path==='classics')local.sqlite.exec('UPDATE club_rotation SET nominal_slot=5,version=version+1');
   result=await data.readJournalMutation(()=>mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle','moon']}));
 }
 await apply(result);
 for(const id of ['bicycle','moon']) {
   const movie=data.catalog!.movies.find(movie=>movie.id===id)!;
   expect(movie.ranking).toMatchObject({seenCount:4,unknownCount:0,eligible:false});
   expect(data.catalog!.sessions.find(session=>session.id===result.session!.id)!.movies.find(film=>film.id===id)).toBe(movie);
   for(const member of data.catalog!.members.filter(member=>member.active===1)) expect(missingAnswers(data.catalog!.movies,data.catalog!.members,member.id,catalogIndex(data.catalog!).historyMovieIds).some(item=>item.movie.id===id)).toBe(false);
 }
 // The only extra reads were the explicit pre-commit snapshot above.
 expect(api.catalog).toHaveBeenCalledTimes(2);expect(api.rotation).toHaveBeenCalledTimes(2);
});
it('a stale No response completing after History publication cannot resurrect eligibility, while unrelated queued answers survive',async()=>{
 let finish!:(movie:MovieDetail)=>void;
 vi.mocked(api.seen).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockImplementationOnce(async()=>({...data.catalog!.movies.find(movie=>movie.id==='tokyo')!,appearances:[]}));
 await act(async()=>data.seenAnswers.answer('bicycle','member-2',false,'Bicycle'));
 const stale={...data.catalog!.movies.find(movie=>movie.id==='bicycle')!,appearances:[]};
 await act(async()=>data.seenAnswers.answer('tokyo','member-2',false,'Tokyo'));
 const result=await data.readJournalMutation(()=>mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['bicycle']}));
 await apply(result);
 await act(async()=>finish(stale));
 expect(data.catalog!.movies.find(movie=>movie.id==='bicycle')?.ranking).toMatchObject({seenCount:4,unknownCount:0,eligible:false});
 expect(api.seen).toHaveBeenCalledTimes(2);counts();
});

it.each([false,true])('Cabinet replaces canonical A with B through History while mounted=%s, preserving active repeats and excluding deleted/catalogue-only films',async mounted=>{
 const A='bicycle',B='stalker';
 // Both canonical records remain; A is the oldest active film, B older still.
 local.sqlite.exec("UPDATE movies SET year=1900 WHERE id='bicycle';UPDATE movies SET year=1890 WHERE id='stalker'");
 await act(async()=>data.refreshData());
 const cabinet=(filter:MetricsFilter={kind:'all'})=>extremesCabinet(selectedAppearances(metricsCatalog(data.catalog!),filter));
 const open=async()=>{showMetrics=true;await act(async()=>root.render(h(Probe)));await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent==='Records')!.click());};
 const visible=()=>[...container.querySelectorAll('.metrics-film-extreme a')].map(a=>a.getAttribute('href'));
 expect(cabinet().oldest?.items.map(r=>r.movie.id)).toEqual([A]);
 if(mounted){await open();expect(visible()).toContain('#/movie/'+A);}
 // An older broad read and enrichment result must not restore the replaced lineup.
 const old=data.catalog!;let finish!:(catalog:Catalog)=>void;
 vi.mocked(api.catalog).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 let refresh!:Promise<void>;await act(async()=>{refresh=data.refreshData();});
 const result=await data.readJournalMutation(()=>mutation('/sessions/demo-3','PUT',{event_date:'2026-09-12',movie_ids:[B,'paris','alien']}));
 await apply(result);
 expect(cabinet().oldest?.items.map(r=>r.movie.id)).toEqual([B]);
 expect(data.catalog!.movies.some(m=>m.id===A)).toBe(true);
 expect(selectedAppearances(data.catalog!).some(r=>r.movie.id===A)).toBe(false);
 if(!mounted)await open();
 expect(visible()).not.toContain('#/movie/'+A);expect(visible()).toContain('#/movie/'+B);
 await act(async()=>{finish(old);await refresh;});
 expect(visible()).not.toContain('#/movie/'+A);
 for(const filter of [{kind:'all' as const},{kind:'classics' as const},...data.catalog!.members.map(m=>({kind:'member' as const,memberId:m.id}))])
   expect(cabinet(filter)).toEqual(extremesCabinet(selectedAppearances(await repo.catalog(),filter)));
 await act(async()=>data.refreshData());expect(visible()).not.toContain('#/movie/'+A);
 // A second qualifying appearance legitimately keeps A eligible until deletion.
 const repeat=await data.readJournalMutation(()=>mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:[A]}));await apply(repeat);
 expect(selectedAppearances(data.catalog!).some(r=>r.movie.id===A)).toBe(true);expect(visible()).toContain('#/movie/'+A);
 await apply(await mutation('/sessions/'+repeat.session!.id,'DELETE'));
 expect(visible()).not.toContain('#/movie/'+A);
 const deleted={...repeat.session!,deleted_at:'2030-01-02'};
 expect(selectedAppearances({...data.catalog!,sessions:[...data.catalog!.sessions,deleted]}).some(r=>r.movie.id===A)).toBe(false);
});

it('replacing one A appearance retains A in Cabinet only for identities with another qualifying active appearance',async()=>{
 const A='bicycle',B='stalker';
 const repeat=await data.readJournalMutation(()=>mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:[A]}));await apply(repeat);
 await apply(await data.readJournalMutation(()=>mutation('/sessions/demo-3','PUT',{event_date:'2026-09-12',movie_ids:[B,'paris','alien']})));
 const ids=(filter:MetricsFilter)=>new Set(Object.values(extremesCabinet(selectedAppearances(metricsCatalog(data.catalog!),filter))).flatMap(r=>r?.items.map(a=>a.movie.id)??[]));
 expect(ids({kind:'all'}).has(A)).toBe(true);expect(ids(repeat.session!.kind==='classics'?{kind:'classics'}:{kind:'member',memberId:repeat.session!.host_member_id!}).has(A)).toBe(true);
 expect(ids({kind:'member',memberId:'member-3'}).has(A)).toBe(false);expect(ids({kind:'member',memberId:'member-3'}).has(B)).toBe(true);
});

it('current relationships govern every Metrics category despite retained scores, Seen and provider caches',async()=>{
 // Five synthetic canonical identities, independent of titles and provider identity.
 local.sqlite.exec("UPDATE sessions SET deleted_at='2030-01-01';UPDATE club_rotation SET nominal_slot=2,version=version+1");
 for(const [i,id] of ['A','B','C','D','E'].entries()) {
   local.sqlite.prepare('INSERT INTO movies(id,title,year,runtime,director,overview) VALUES(?,?,?,?,?,?)').run(id,id==='A'?'Lost in London':`Replacement fixture ${id}`,2000+i,100+i,`Director ${id}`,'Retained overview');
   local.sqlite.prepare("INSERT INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,'tmdb',?)").run(id,String(100+i));
   local.sqlite.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').run(id,['Horror','Comedy','Drama','Crime','Action'][i]);
   for(const [provider,metric,value,scale] of [['imdb','rating',i===0?10:8,10],['metacritic','critic',i===0?100:80,100]] as const)
     local.sqlite.prepare("INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,fetched_at,retrieved_via) VALUES(?,?,?,?,?,?,'2030','tmdb')").run(`${id}-${provider}`,id,provider,metric,value,scale);
   local.sqlite.prepare("INSERT INTO movie_provider_metadata(movie_id,provider,original_language,budget,revenue,fetched_at) VALUES(?,'tmdb','ja',100,?,'2030')").run(id,i===0?999999:1000);
   local.sqlite.prepare("INSERT INTO movie_provider_keywords(movie_id,provider,item_key,name,fetched_at) VALUES(?,'tmdb','k',?,'2030')").run(id,i===0?'time travel':'space');
   local.sqlite.prepare("INSERT INTO movie_provider_credits(movie_id,provider,item_key,kind,role,person_id,name,ordinal,fetched_at) VALUES(?,'tmdb','cast','cast','cast',?,?,0,'2030')").run(id,id,`Actor ${id}`);
   local.sqlite.prepare("INSERT INTO movie_provider_countries(movie_id,provider,item_key,code,name,fetched_at) VALUES(?,'tmdb','JP','JP','Japan','2030')").run(id);
 }
 local.sqlite.exec("INSERT INTO classics(movie_id,source) VALUES('D','test');INSERT INTO seen_states(movie_id,member_id,seen) SELECT 'D',id,0 FROM members");
 const first=await mutation('/sessions','POST',{event_date:'2030-01-01',movie_ids:['A','C','C']});await apply(first);
 const second=await mutation('/sessions','POST',{event_date:'2030-01-02',movie_ids:['C']});await apply(second);
 const deleted=await mutation('/sessions','POST',{event_date:'2030-01-03',movie_ids:['E']});await apply(deleted);
 await apply(await mutation(`/sessions/${deleted.session!.id}`,'DELETE'));
 await act(async()=>data.refreshData());
 const enrichment=new MetricsRepository(local.db),retained=await enrichment.enrichment();
 expect(filmEconomics(selectedAppearances(data.catalog!),retained).points.find(p=>p.movie.id==='A')?.revenue).toBe(999999);
 await data.metricsResource.load(()=>Promise.resolve(retained));
 await apply(await data.readJournalMutation(()=>mutation(`/sessions/${first.session!.id}`,'PUT',{event_date:'2030-01-01',movie_ids:['B','C','C']})));
 expect(data.metricsResource.peek()).toBeNull();
 expect(local.sqlite.prepare('SELECT movie_id FROM session_movies WHERE session_id=? ORDER BY position').all(first.session!.id).map(r=>r.movie_id)).toEqual(['B','C','C']);
 const A=data.catalog!.movies.find(m=>m.id==='A')!;
 expect(A).toMatchObject({title:'Lost in London',genres:['Horror'],external_ids:[{provider:'tmdb',external_id:'100'}]});
 expect(A.scores).toHaveLength(2);expect(A.seen).toHaveLength(4);
 expect(local.sqlite.prepare("SELECT revenue FROM movie_provider_metadata WHERE movie_id='A'").get()!.revenue).toBe(999999);
 const current=await enrichment.enrichment();expect(Object.keys(current.movies).sort()).toEqual(['B','C']);
 // Deliberately over-broad provider payload: facts alone must never create appearances.
 Object.assign(retained.movies,current.movies,{D:retained.movies.A,E:retained.movies.A});
 const report=(catalog:Catalog,facts=retained)=>{
   const all=selectedAppearances(metricsCatalog(catalog)),dashboard=metricsDashboard(all,all);
   return {top:calculateMetrics(catalog).top.map(r=>r.movie.id),tastes:dashboard.fingerprint,
     breakdowns:calculateMetrics(catalog).genres,records:dashboard.extremes,
     genreGross:genreRevenue(all,facts),economics:filmEconomics(all,facts),themes:themeFingerprint(all,all,facts),
     cast:recurringTalent(all,facts,'Cast'),contributors:contributorMetrics(catalog),ratings:dashboard.ratings};
 };
 const result=report(data.catalog!);
 expect(result.top).toEqual(['B','C','C','C']);
 expect(calculateMetrics(data.catalog!)).toMatchObject({appearances:4,uniqueFilms:2,imdbAverage:8});
 expect(result.breakdowns.map(g=>[g.genre,g.appearances])).toEqual([['Drama',3],['Comedy',1]]);
 expect(result.economics.points.map(p=>p.movie.id).sort()).toEqual(['B','C']);expect(result.economics.revenue.median).toBe(1000);
 expect(JSON.stringify(result)).not.toMatch(/Lost in London|Horror|Actor A|time travel|999999/);
 expect(selectedAppearances(data.catalog!,{kind:'member',memberId:'member-2'})).toHaveLength(4);
 expect(selectedAppearances(data.catalog!,{kind:'member',memberId:'member-1'})).toHaveLength(0);
 expect(selectedAppearances(data.catalog!,{kind:'classics'})).toHaveLength(0);
 expect(result.contributors.find(r=>r.filter.kind==='member'&&r.filter.memberId==='member-2')?.count).toBe(4);
 expect(result.ratings.find(r=>r.id==='imdb')).toMatchObject({coverage:4,mean:80});
 expect(classicsViewed(data.catalog!).pool).toBeGreaterThanOrEqual(1); // D remains an intentional candidate population.
 expect(report(await repo.catalog(),current)).toEqual(result);
 expect(report(hydrateCatalog(await repo.compactCatalog()),current)).toEqual(result);
 // Explicit reload and immediate mutation produce the same populations and reports.
 await act(async()=>data.refreshData());expect(report(data.catalog!,current)).toEqual(result);
 await apply(await data.readJournalMutation(()=>mutation(`/sessions/${first.session!.id}`,'PUT',{event_date:'2030-01-01',movie_ids:['B']})));
 expect(selectedAppearances(data.catalog!).map(r=>r.movie.id).sort()).toEqual(['B','C']);
 await apply(await mutation(`/sessions/${second.session!.id}`,'DELETE'));
 expect(selectedAppearances(data.catalog!).map(r=>r.movie.id)).toEqual(['B']);expect(Object.keys((await enrichment.enrichment()).movies)).toEqual(['B']);
 await apply(await mutation(`/sessions/${second.session!.id}/restore`,'POST'));
 expect(selectedAppearances(data.catalog!).map(r=>r.movie.id).sort()).toEqual(['B','C']);
 // Retained released roster parts are supplementary information, not appearances.
 // Known upcoming parts are excluded from the required/missing population.
 for(const id of ['B','C'])retained.movies[id].collection={status:'checked_present',external_id:id==='B'?'101':'102',checked_at:'2030',collection_id:1,collection_name:'Fixture collection'};
 retained.collections={'1':{status:'checked',attempted_at:'2030',roster:{id:1,name:'Fixture collection',checked_at:'2030',parts:[{id:101,title:'B',release_date:'2000-01-01'},{id:102,title:'C',release_date:'2000-01-01'},{id:100,title:'Lost in London',release_date:'2000-01-01'},{id:999,title:'Upcoming',release_date:'2099-01-01'}]}}};
 const completion=collectionCompletion(selectedAppearances(data.catalog!),retained,'2030-01-01').unrequited[0];
 expect(completion.films.map(r=>r.movie.id).sort()).toEqual(['B','C']);expect(completion.missing.map(p=>p.id).sort()).toEqual([100]);
 expect(report(await repo.catalog())).toEqual(report(data.catalog!));
});
