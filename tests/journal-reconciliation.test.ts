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
import { disposableD1 } from './d1';
import { api } from '../frontend/api';
import { useBookClubData } from '../frontend/useBookClubData';
import type { Catalog, JournalMutationResult, MovieDetail, Rotation } from '../shared/types';
import type { Env } from '../worker/src/http';
vi.mock('../frontend/api',()=>({api:{health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(),seen:vi.fn()},hasSession:()=>true,ApiClientError:class extends Error {}}));
let local:ReturnType<typeof disposableD1>,repo:Repository,product:ProductRepository,env:Env,root:Root,container:HTMLDivElement,data:ReturnType<typeof useBookClubData>;
function Probe(){data=useBookClubData(false);return null;}
async function mutation(path:string,method:string,input?:unknown):Promise<JournalMutationResult> {
  const response=await worker.fetch(new Request(`http://local/api/v1${path}`,{method,headers:{'X-BookClub-Dev-Member':'member-2'},...(input?{body:JSON.stringify(input)}:{})}),env);
  expect(response.ok,await response.clone().text()).toBe(true);return (await response.json() as {data:JournalMutationResult}).data;
}
async function apply(result:JournalMutationResult){await act(async()=>data.applyJournalMutation(result));}
const counts=()=>{expect(api.catalog).toHaveBeenCalledOnce();expect(api.rotation).toHaveBeenCalledOnce();};
beforeEach(async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.resetAllMocks();local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
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
