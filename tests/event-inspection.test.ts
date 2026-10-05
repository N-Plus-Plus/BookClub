// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuilderSet, Catalog, Movie, SearchResponse, TmdbPreview } from '../shared/types';
import { api } from '../frontend/api';
import { App } from '../frontend/App';
import { BuilderSetPicker } from '../frontend/BuilderSetPicker';

vi.mock('../frontend/api',() => ({
  api:{health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(),search:vi.fn(),preview:vi.fn(),detail:vi.fn(),seen:vi.fn(),importMovie:vi.fn(),saveSession:vi.fn(),builders:vi.fn()},
  ApiClientError:class extends Error {},hasSession:() => true,setUnauthorizedHandler:vi.fn(),setDevMember:vi.fn(),clearSession:vi.fn(),storeSession:vi.fn(),
}));
const movies: Movie[] = Array.from({length:8},(_,i) => ({id:`saved-${i}`,title:`Film ${i}`,year:1998,original_title:null,release_date:null,runtime:100,overview:'Overview',genres:[],assets:[],external_ids:i === 7 ? [{provider:'tmdb',external_id:'107'}] : [],scores:[],seen:[],classic:false,ranking:null}));
const catalog: Catalog = {movies,members:[{id:'member-2',display_name:'Member 2',sort_order:2,active:1,avatar:2}],sessions:[],cycles:[]};
const results: SearchResponse = {local:movies.map(movie => ({id:movie.id,title:movie.title,year:movie.year,poster:null,tmdbId:movie.external_ids[0]?.external_id ?? null})),external:[{provider:'tmdb',externalId:'42',title:'External film',year:2001,poster:'/poster.jpg'}],lookup:{available:true,message:null}};
const preview: TmdbPreview = {provider:'tmdb',externalId:'42',title:'External film',original_title:null,year:2001,release_date:null,runtime:110,overview:'Preview only',genres:['Drama'],assets:[],director:'Director Name'};
let root: Root, container: HTMLDivElement;
const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve,0)); }); };
const navigate = async (route: string) => {
  await act(async () => { window.location.hash = `/${route}`; window.dispatchEvent(new HashChangeEvent('hashchange')); }); await flush();
};
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text)!;
const click = async (element: HTMLElement) => { expect(element).toBeTruthy(); await act(async () => { element.click(); }); await flush(); };
const input = async (element: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})); });
};
const search = async () => {
  await input(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,'film');
  await act(async () => { container.querySelector('.event-workflow .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }); await flush();
};
const lineup = () => [...container.querySelectorAll('.lineup-list .movie-title')].map(element => element.textContent);
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('scrollTo',vi.fn()); vi.stubGlobal('requestAnimationFrame',(callback: FrameRequestCallback) => { callback(0); return 0; });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'test',authenticationRequired:true,googleAuthConfigured:false,demo:false} as Awaited<ReturnType<typeof api.health>>);
  vi.mocked(api.me).mockResolvedValue({viewer:{id:'member-2',display_name:'Member 2',sort_order:2,avatar:2,role:'member'}});
  vi.mocked(api.catalog).mockResolvedValue(catalog);
  vi.mocked(api.rotation).mockResolvedValue({id:1,nominal_slot:2,cycle_id:null,version:0,updated_at:''});
  vi.mocked(api.search).mockResolvedValue(results);
  vi.mocked(api.preview).mockImplementation(async id => ({...preview,externalId:id}));
  vi.mocked(api.detail).mockImplementation(async id => ({...movies.find(movie => movie.id === id)!,appearances:[]}));
  vi.mocked(api.importMovie).mockResolvedValue({...movies[0],id:'canonical-import',title:'Imported film',appearances:[]});
  window.location.hash = '/event';
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => { root.render(createElement(App)); }); await flush();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('preserved Event film inspection',() => {
  it('Nope and browser Back preserve the exact editor, query, page, manual fields and selected order',async () => {
    const editor = container.querySelector('.event-workflow');
    await input(container.querySelector('input[name="event_date"]')!,'2030-04-05');
    const complete = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!; await click(complete);
    await input(container.querySelector<HTMLInputElement>('.manual-form input[maxlength="300"]')!,'Unfinished manual title');
    await click(button('Save event')); expect(container.textContent).toContain('Add at least one film.');
    await search();
    expect(container.querySelectorAll('.search-row')).toHaveLength(6); expect(button('Previous').disabled).toBe(true);
    await click(button('Next')); expect(container.querySelectorAll('.search-row')).toHaveLength(3); expect(button('Next').disabled).toBe(true);
    await click(container.querySelectorAll<HTMLAnchorElement>('.search-row a')[0]);
    expect(container.querySelector('.event-workflow')).toBe(editor); expect(editor?.parentElement?.hidden).toBe(true);
    expect(button("Nope, this isn't it")).toBeTruthy(); expect(api.importMovie).not.toHaveBeenCalled();
    await click(button("Nope, this isn't it")); await flush();
    expect(container.querySelector('.event-workflow')).toBe(editor); expect(editor?.parentElement?.hidden).toBe(false);
    expect(container.querySelector<HTMLInputElement>('input[name="event_date"]')!.value).toBe('2030-04-05');
    expect(complete.checked).toBe(false); expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('film');
    expect(container.querySelector<HTMLInputElement>('.manual-form input[maxlength="300"]')!.value).toBe('Unfinished manual title');
    expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    expect(container.textContent).toContain('Add at least one film.');
    expect(lineup()).toEqual([]); expect(container.querySelector('.search-row .movie-title')?.textContent).toBe('Film 6');
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);
    await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve,20)); }); await flush();
    expect(window.location.hash).toBe('#/event'); expect(button('Yes, this one!')).toBeUndefined();
    expect(container.querySelector('.event-workflow')).toBe(editor); expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    await search(); expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 1 of 2');
    expect(api.saveSession).not.toHaveBeenCalled(); expect(api.importMovie).not.toHaveBeenCalled();
  });
  it('Yes local appends the canonical movie and ordinary detail has no confirmation actions',async () => {
    await search(); await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);
    expect(api.detail).toHaveBeenCalledWith('saved-0'); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 0']); expect(api.importMovie).not.toHaveBeenCalled();
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 0','Film 0']);
    await navigate('movie/saved-0'); expect(button('Yes, this one!')).toBeUndefined();
  });
  it('enriches only the visible page, caches on Previous/Next and imports external only on Yes with retry',async () => {
    await search(); expect(api.preview).not.toHaveBeenCalled();
    await click(button('Next')); expect(api.preview).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('.search-row')[2].textContent).toContain('2001 · Director: Director Name');
    await click(button('Previous')); await click(button('Next')); expect(api.preview).toHaveBeenCalledTimes(2);
    const editor = container.querySelector('.event-workflow');
    await click(container.querySelectorAll<HTMLAnchorElement>('.search-row a')[2]);
    expect(api.preview).toHaveBeenCalledTimes(2); expect(api.importMovie).not.toHaveBeenCalled();
    expect(container.querySelector('.detail-header')?.textContent).toContain('Preview only');
    expect(container.querySelector('.detail-grid')).toBeNull();
    vi.mocked(api.importMovie).mockRejectedValueOnce(new Error('Import temporarily unavailable.'));
    await click(button('Yes, this one!')); expect(window.location.hash).toBe('#/preview/tmdb/42');
    expect(container.textContent).toContain('Import temporarily unavailable.'); expect(lineup()).toEqual([]);
    await click(button('Yes, this one!')); await flush();
    expect(api.importMovie).toHaveBeenCalledTimes(2); expect(container.querySelector('.event-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Imported film']); expect(api.saveSession).not.toHaveBeenCalled();
  });
  it('director failures preserve valid search rows and show Unknown',async () => {
    vi.mocked(api.preview).mockRejectedValue(new Error('TMDB unavailable.'));
    await search(); await click(button('Next'));
    expect(container.querySelectorAll('.search-row')).toHaveLength(3);
    expect(container.querySelectorAll('.search-row')[2].textContent).toContain('Director: Unknown');
    await click(button('Previous')); await click(button('Next')); expect(api.preview).toHaveBeenCalledTimes(2);
  });
  it('bounds enrichment to six visible external candidates and reuses all previews on return',async () => {
    vi.mocked(api.search).mockResolvedValue({local:[],external:Array.from({length:14},(_,i) => ({provider:'tmdb',externalId:String(i+1),title:`Candidate ${i+1}`,year:null,poster:null})),lookup:{available:true,message:null}});
    await search(); await flush();
    expect(api.preview).toHaveBeenCalledTimes(6); expect(container.querySelectorAll('.search-row')).toHaveLength(6);
    expect(vi.mocked(api.preview).mock.calls.map(call => call[0])).toEqual(['1','2','3','4','5','6']);
    await click(button('Next')); await flush(); expect(api.preview).toHaveBeenCalledTimes(12);
    await click(button('Previous')); expect(api.preview).toHaveBeenCalledTimes(12);
  });
  it('shares an inspection request for a candidate whose sequential enrichment has not started',async () => {
    vi.mocked(api.search).mockResolvedValue({local:[],external:Array.from({length:6},(_,i) => ({provider:'tmdb',externalId:String(i+1),title:`Candidate ${i+1}`,year:null,poster:null})),lookup:{available:true,message:null}});
    let resolveFirst!: (value: TmdbPreview) => void;
    vi.mocked(api.preview).mockImplementation(id => id === '1' ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({...preview,externalId:id}));
    await search(); expect(api.preview).toHaveBeenCalledTimes(1);
    await click(container.querySelectorAll<HTMLAnchorElement>('.search-row a')[5]);
    expect(api.preview).toHaveBeenCalledTimes(2); expect(api.importMovie).not.toHaveBeenCalled();
    await act(async () => { resolveFirst({...preview,externalId:'1'}); }); await flush();
    expect(vi.mocked(api.preview).mock.calls.filter(call => call[0] === '6')).toHaveLength(1);
    expect(api.preview).toHaveBeenCalledTimes(6);
    await click(button("Nope, this isn't it")); await flush(); expect(lineup()).toEqual([]);
  });
  it('Builder prefill seeds once in exact order and survives Nope and Yes',async () => {
    await navigate('home');
    vi.mocked(api.builders).mockResolvedValue([{id:'set',owner_member_id:'member-2',title:'Saved set',movie_ids:['saved-2','saved-0','saved-2']} as BuilderSet]);
    await click(button('Use from Builder')); await click(button('Use this set')); await flush();
    expect(lineup()).toEqual(['Film 2','Film 0','Film 2']); const editor = container.querySelector('.event-workflow');
    await search(); await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button("Nope, this isn't it")); await flush();
    expect(lineup()).toEqual(['Film 2','Film 0','Film 2']); expect(container.querySelector('.event-workflow')).toBe(editor);
    await click(container.querySelectorAll<HTMLAnchorElement>('.search-row a')[1]); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 2','Film 0','Film 2','Film 1']);
    await navigate('home'); await navigate('event'); expect(lineup()).toEqual([]);
  });
  it('existing Event corrections also retain the editor during inspection',async () => {
    vi.mocked(api.catalog).mockResolvedValue({...catalog,sessions:[{id:'historic',event_date:'2000-01-01',kind:'hosted',host_member_id:'former',movies:[movies[2]],cycle_id:null,cycle_slot:null,date_precision:'exact',legacy_cycle_label:null}]});
    await act(async () => root.unmount()); root = createRoot(container);
    window.location.hash = '/event/historic'; await act(async () => root.render(createElement(App))); await flush();
    const editor = container.querySelector('.event-workflow'); await search();
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Yes, this one!')); await flush();
    expect(window.location.hash).toBe('#/event/historic'); expect(container.querySelector('.event-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Film 2','Film 0']); expect(container.textContent).not.toContain('Actual host');
  });
});

it('unresolvable and empty Builder sets are disabled without truncating their saved order',async () => {
  const choose = vi.fn();
  vi.mocked(api.builders).mockResolvedValue([
    {id:'bad',owner_member_id:'member-2',title:'Incomplete',movie_ids:['saved-2','missing','saved-0']},
    {id:'empty',owner_member_id:'member-2',title:'Empty',movie_ids:[]},
    {id:'good',owner_member_id:'member-2',title:'Complete',movie_ids:['saved-2','saved-0','saved-2']},
  ] as BuilderSet[]);
  await act(async () => root.render(createElement(BuilderSetPicker,{catalog,viewer:{id:'member-2',display_name:'Member',avatar:2,sort_order:2,role:'member'},onClose:vi.fn(),onChoose:choose}))); await flush();
  const actions = [...container.querySelectorAll<HTMLButtonElement>('button')].filter(button => button.textContent === 'Use this set');
  expect(actions.map(button => button.disabled)).toEqual([true,true,false]);
  expect(container.textContent).toContain('This set contains unavailable film data.');
  await click(actions[0]); expect(choose).not.toHaveBeenCalled();
  await click(actions[2]); expect(choose).toHaveBeenCalledWith(['saved-2','saved-0','saved-2']);
});

it('Seen queue, Home count, Undo and Detail context belong to the viewer',async()=>{
  const personal={...movies[0],classic:true,director:'Stored Director',seen:[{member_id:'other',seen:1,updated_at:''}]};
  const other={id:'other',display_name:'Other',sort_order:1,active:1,avatar:1};
  vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:[personal],members:[catalog.members[0],other]});
  vi.mocked(api.detail).mockResolvedValue({...personal,appearances:[]});
  await act(async()=>root.unmount()); root=createRoot(container);
  window.location.hash='/home'; await act(async()=>root.render(createElement(App))); await flush();
  expect(container.querySelector('.stat-link strong')?.textContent).toBe('1');
  await navigate('seen');
  expect(container.textContent).toContain('1 remaining'); expect(container.textContent).toContain('HAVE YOU SEEN...');
  expect(container.textContent).toContain('Director: Stored Director'); expect(container.textContent).not.toContain('Answer unknown');
  expect(container.querySelector<HTMLAnchorElement>('.answer-card')!.getAttribute('href')).toBe('#/movie/saved-0');
  await navigate('movie/saved-0');
  expect(button('Back')).toBeTruthy(); expect(button('Yes, this one!')).toBeUndefined();
  const columns=container.querySelectorAll('.detail-seen-column');
  expect(columns[0].textContent).toBe("Haven't Seen It"); expect(columns[1].textContent).toContain('OTHER'); expect(columns[1].textContent).not.toContain('MEMBER 2');
  expect(container.querySelector('.member-state')).toBeNull();
  await click(button('Back')); expect(window.location.hash).toBe('#/seen');
  vi.mocked(api.seen).mockImplementation(async (_id,memberId,value)=>({...personal,appearances:[],seen:value === null ? personal.seen : [...personal.seen,{member_id:memberId,seen:Number(value),updated_at:''}]}));
  await click(button('Yes, seen it')); expect(api.seen).toHaveBeenLastCalledWith(personal.id,'member-2',true);
  expect(container.textContent).toContain('0 remaining');
  await click(button('Undo last answer')); expect(api.seen).toHaveBeenLastCalledWith(personal.id,'member-2',null);
  expect(container.textContent).toContain('1 remaining');
  await navigate('home'); await navigate('movie/saved-0'); expect(button('Back')).toBeUndefined();
});

it('Detail groups explicit answers in member order and omits unanswered members',async()=>{
  const members=[4,2,1,3].map(n=>({id:`m${n}`,display_name:`Person ${n}`,sort_order:n,active:1,avatar:n}));
  vi.mocked(api.catalog).mockResolvedValue({...catalog,members});
  vi.mocked(api.detail).mockResolvedValue({...movies[0],appearances:[],seen:[{member_id:'m4',seen:0,updated_at:''},{member_id:'m1',seen:0,updated_at:''},{member_id:'m3',seen:1,updated_at:''}]});
  await act(async()=>root.unmount()); root=createRoot(container); window.location.hash='/movie/saved-0';
  await act(async()=>root.render(createElement(App))); await flush();
  const groups=[...container.querySelectorAll('.detail-seen-column')].map(column=>[...column.querySelectorAll('.club-identity')].map(member=>member.textContent));
  expect(groups).toEqual([['PERSON 1','PERSON 4'],['PERSON 3']]);
});
