// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuilderSet, Catalog, Movie, Rotation, SearchResponse, TmdbPreview } from '../shared/types';
import { rankMovie, sortClassics } from '../shared/ranking';
import { api, setDevMember } from '../frontend/api';
import { App } from '../frontend/App';
import { BuilderSetPicker } from '../frontend/BuilderSetPicker';
import { HistoryScreen } from '../frontend/HistoryScreen';
import { SessionCard } from '../frontend/components';

vi.mock('../frontend/api',() => ({
  api:{metricsEnrichment:vi.fn(async()=>({movies:{}})),swapRotation:vi.fn(),scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:['f1','f2','f3','f99','saved-7'],eligibleDimensions:30,unavailableDimensions:0,unavailableFilms:0})),maintainMovies:vi.fn(),enrichMetadataSelected:vi.fn(),audit:vi.fn(),deleteSession:vi.fn(),health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(),search:vi.fn(),preview:vi.fn(),detail:vi.fn(),seen:vi.fn(),importMovie:vi.fn(),saveSession:vi.fn(),builders:vi.fn(),saveBuilder:vi.fn(),publishBuilder:vi.fn()},
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
  vi.mocked(api.builders).mockResolvedValue([]);
  vi.mocked(api.saveBuilder).mockImplementation(async (body,id) => ({...body,id:id ?? 'new-set',owner_member_id:'member-2',title:body.title ?? null,notes:body.notes ?? null,revision:1,created_at:'2026-01-01',updated_at:''}));
  window.location.hash = '/event';
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => { root.render(createElement(App)); }); await flush();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('preserved Event film inspection',() => {
  it('Nope and browser Back preserve the exact editor, query, page, manual fields and selected order',async () => {
    expect(container.textContent).not.toContain('Review event');
    expect(container.textContent).not.toContain('films in viewing order');
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
    expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe(''); expect(container.querySelector('.search-row')).toBeNull();
    await search(); await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 0','Film 0']);
    await navigate('movie/saved-0'); expect(button('Yes, this one!')).toBeUndefined();
  });
  it('loads preview only on inspection, caches on Previous/Next and imports external only on Yes with retry',async () => {
    await search(); expect(api.preview).not.toHaveBeenCalled();
    await click(button('Next')); expect(api.preview).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.search-row')[2].textContent).toBe('External film2001');
    await click(button('Previous')); await click(button('Next')); expect(api.preview).not.toHaveBeenCalled();
    const editor = container.querySelector('.event-workflow');
    await click(container.querySelectorAll<HTMLAnchorElement>('.search-row a')[2]);
    expect(api.preview).toHaveBeenCalledTimes(1); expect(api.importMovie).not.toHaveBeenCalled();
    expect(container.querySelector('.detail-header')?.textContent).toContain('Preview only');
    expect(container.querySelector('.detail-grid')).toBeNull();
    vi.mocked(api.importMovie).mockRejectedValueOnce(new Error('Import temporarily unavailable.'));
    await click(button('Yes, this one!')); expect(window.location.hash).toBe('#/preview/tmdb/42');
    expect(container.textContent).toContain('Import temporarily unavailable.'); expect(lineup()).toEqual([]);
    await click(button('Yes, this one!')); await flush();
    expect(api.importMovie).toHaveBeenCalledTimes(2); expect(container.querySelector('.event-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Imported film']); expect(api.saveSession).not.toHaveBeenCalled();
  });
  it('director failures preserve valid search rows without an unknown placeholder',async () => {
    vi.mocked(api.preview).mockRejectedValue(new Error('TMDB unavailable.'));
    await search(); await click(button('Next'));
    expect(container.querySelectorAll('.search-row')).toHaveLength(3);
    expect(container.querySelectorAll('.search-row')[2].textContent).not.toContain('Director: Unknown');
    await click(button('Previous')); await click(button('Next')); expect(api.preview).not.toHaveBeenCalled();
  });
  it('never prefetches visible external rows and deduplicates actual inspections',async () => {
    vi.mocked(api.search).mockResolvedValue({local:[],external:Array.from({length:14},(_,i) => ({provider:'tmdb',externalId:String(i+1),title:`Candidate ${i+1}`,year:null,poster:null})),lookup:{available:true,message:null}});
    await search(); await flush();
    expect(api.preview).not.toHaveBeenCalled(); expect(container.querySelectorAll('.search-row')).toHaveLength(6);
    await click(button('Next')); await click(button('Previous')); expect(api.preview).not.toHaveBeenCalled();
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); expect(api.preview).toHaveBeenCalledTimes(1);
    await click(button("Nope, this isn't it"));
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); expect(api.preview).toHaveBeenCalledTimes(1);
  });
  it('shares an in-flight preview across repeated inspections',async () => {
    vi.mocked(api.search).mockResolvedValue({local:[],external:[{provider:'tmdb',externalId:'1',title:'Candidate',year:null,poster:null}],lookup:{available:true,message:null}});
    let resolve!: (value: TmdbPreview) => void;
    vi.mocked(api.preview).mockImplementation(() => new Promise(done => { resolve = done; }));
    await search(); expect(api.preview).not.toHaveBeenCalled();
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);
    await click(button("Nope, this isn't it"));
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);
    expect(api.preview).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({...preview,externalId:'1'}); }); await flush();
    expect(container.querySelector('.detail-header')?.textContent).toContain('Preview only');
    expect(api.importMovie).not.toHaveBeenCalled();
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

it('Seen queue, Home count, corrections and Detail context belong to the viewer',async()=>{
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
  expect(columns[0].textContent).toBe("Haven't"); expect(columns[1].textContent).toContain('OTHER'); expect(columns[1].textContent).not.toContain('MEMBER 2');
  expect(container.querySelector('.member-state')).toBeNull();
  await click(button('Back')); expect(window.location.hash).toBe('#/seen');
  vi.mocked(api.seen).mockImplementation(async (_id,memberId,value)=>({...personal,appearances:[],seen:value === null ? personal.seen : [...personal.seen,{member_id:memberId,seen:Number(value),updated_at:''}]}));
  await click(button('Yes, seen it')); expect(api.seen).toHaveBeenLastCalledWith(personal.id,'member-2',true);
  expect(container.textContent).toContain('0 remaining');
  expect(button('Undo last answer')).toBeUndefined();
  await click(button('Change to No')); expect(api.seen).toHaveBeenLastCalledWith(personal.id,'member-2',false);
  expect(container.textContent).toContain('0 remaining');
  await navigate('home'); await navigate('movie/saved-0'); expect(button('Back')).toBeUndefined();
});

it('Detail groups explicit answers in member order and omits unanswered members',async()=>{
  const members=[4,2,1,3].map(n=>({id:`m${n}`,display_name:`Person ${n}`,sort_order:n,active:1,avatar:n}));
  vi.mocked(api.catalog).mockResolvedValue({...catalog,members});
  vi.mocked(api.detail).mockResolvedValue({...movies[0],classic:true,appearances:[],seen:[{member_id:'m4',seen:0,updated_at:''},{member_id:'m1',seen:0,updated_at:''},{member_id:'m3',seen:1,updated_at:''}]});
  await act(async()=>root.unmount()); root=createRoot(container); window.location.hash='/movie/saved-0';
  await act(async()=>root.render(createElement(App))); await flush();
  const groups=[...container.querySelectorAll('.detail-seen-column')].map(column=>[...column.querySelectorAll('.club-identity')].map(member=>member.textContent));
  expect(groups).toEqual([['PERSON 1','PERSON 4'],['PERSON 3']]);
});


describe('History cycle archive',() => {
  const archive = (): Catalog => {
    const cycles = Array.from({length:11},(_,i) => ({id:`cycle-${11-i}`,ordinal:11-i,rough_date:'2026-08-30',title:null,import_source:null,import_key:null,created_at:'',updated_at:''}));
    const sessions: Catalog['sessions'] = cycles.flatMap((cycle,i) => [1,2].map(slot => ({id:`event-${i}-${slot}`,event_date:slot === 1 ? '2026-08-30' : '2026-09-01',host_member_id:i === 10 ? null : 'member-2',legacy_cycle_label:null,movies:movies.slice(0,3),cycle_id:cycle.id,kind:i === 10 ? 'classics' as const : 'hosted' as const,date_precision:slot === 1 ? 'cycle_rough' as const : 'exact' as const,cycle_slot:slot,has_audit:true})));
    sessions.push({...sessions[0],id:'ungrouped',cycle_id:null});
    return {...catalog,cycles,sessions};
  };
  const mountHistory = async (data = archive(), onChanged = vi.fn()) => {
    await act(async () => { root.render(createElement(HistoryScreen,{catalog:data,onChanged,viewer:{id:'member-2',display_name:'Member 2',sort_order:2,avatar:2,role:'admin'}})); }); return onChanged;
  };
  const select = async (index: number,value: string) => {
    await act(async () => { const element = container.querySelectorAll('select')[index]; element.value = value; element.dispatchEvent(new Event('change',{bubbles:true})); });
  };
  it('pages five cycles in existing order with matching controls, jumps after mounting and resets on host filtering',async () => {
    await mountHistory();
    expect([...container.querySelectorAll('section[id^="cycle-"]')].map(node => node.id)).toEqual(['cycle-cycle-11','cycle-cycle-10','cycle-cycle-9','cycle-cycle-8','cycle-cycle-7']);
    expect(container.querySelectorAll('.session-card')).toHaveLength(10);
    expect(container.querySelectorAll('.history-pagination')).toHaveLength(2);
    expect([...container.querySelectorAll('.history-pagination')].map(node => node.textContent)).toEqual(['PreviousPage 1 of 3Next','PreviousPage 1 of 3Next']);
    expect(button('Previous').disabled).toBe(true);
    expect(container.textContent).not.toContain('Ungrouped events');
    expect(container.querySelector('a[href="#/event"]')).toBeNull();
    await click(button('Next')); expect(container.textContent).toContain('Page 2 of 3');
    let scrolledId = '';
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) { scrolledId = this.id; });
    await select(0,'cycle-1');
    expect(container.textContent).toContain('Page 3 of 3'); expect(scrolledId).toBe('cycle-cycle-1');
    expect(button('Next').disabled).toBe(true); expect(container.textContent).toContain('Ungrouped events');
    await select(1,'member-2');
    expect(container.textContent).toContain('Page 1 of 2'); expect(button('Previous').disabled).toBe(true);
    expect(container.querySelector('option[value="cycle-1"]')).toBeNull();
    await select(1,'classics'); expect(container.textContent).toContain('Page 1 of 1');
    expect(button('Previous').disabled).toBe(true); expect(button('Next').disabled).toBe(true);
  });
  it('keeps icon actions inside their card, audit evidence below that card, cached audit and delete behaviour',async () => {
    vi.mocked(api.audit).mockResolvedValue([]); vi.mocked(api.deleteSession).mockResolvedValue({ok:true} as Awaited<ReturnType<typeof api.deleteSession>>);
    const onChanged = await mountHistory();
    const event = container.querySelector<HTMLElement>('.history-event')!;
    const actions = event.querySelectorAll<HTMLElement>('.session-card .history-event-actions > .button');
    expect([...actions].map(node => node.getAttribute('aria-label'))).toEqual(['Edit event','Audit event','Delete event']);
    expect([...actions].every(node => node.title && !node.textContent)).toBe(true);
    expect(actions[0].getAttribute('href')).toBe('#/event/event-0-1');
    expect(actions[2].getAttribute('data-variant')).toBe('danger');
    await click(actions[1]); expect(api.audit).toHaveBeenCalledWith('event-0-1');
    expect(event.querySelector('.audit-inline')?.previousElementSibling?.classList.contains('session-card')).toBe(true);
    expect(container.querySelectorAll('.audit-inline')).toHaveLength(1);
    await click(actions[1]); await click(actions[1]); expect(api.audit).toHaveBeenCalledTimes(1);
    vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await click(actions[2]); expect(api.deleteSession).not.toHaveBeenCalled();
    await click(actions[2]); expect(api.deleteSession).toHaveBeenCalledWith('event-0-1'); expect(onChanged).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
  it('uses concise History dates and ordered Film Detail links alongside compact Home headings',async () => {
    const data = archive(); await mountHistory(data);
    const cards = container.querySelectorAll('.session-card');
    expect(cards[0].querySelector('.eyebrow')?.textContent).toBe('Cycle started 30 August 2026');
    expect(cards[1].querySelector('.eyebrow')?.textContent).toBe('1 September 2026');
    expect(cards[0].querySelector('h3')?.textContent).toBe("Member 2's week");
    expect(cards[0].querySelector('.film-list a .position')?.textContent).toBe('#1');
    const context = container.querySelector('.history-cycle-context')!;
    expect(context.textContent).toBe('Cycle starting: 30 August 2026SeanTroyMattJessClassics');
    expect(context.querySelectorAll('svg.lucide-arrow-right')).toHaveLength(4);
    expect([...cards[0].querySelectorAll('.position')].map(node => node.textContent)).toEqual(['#1','#2','#3']);
    expect([...cards[0].querySelectorAll('.film-list a')].map(node => node.getAttribute('href'))).toEqual(movies.slice(0,3).map(movie => `#/movie/${movie.id}`));
    await act(async () => { root.render(createElement(SessionCard,{variant:'home',session:data.sessions[0],members:data.members})); });
    expect(container.querySelector('h3')?.textContent).toBe("Member 2's turn");
    expect(container.querySelector('.position')?.textContent).toBe('#1');
    expect(container.querySelector('.eyebrow')?.textContent).toBe('Cycle started 30 August 2026');
    await mountHistory({...data,sessions:[{...data.sessions[0],kind:'classics',host_member_id:null}]});
    expect(container.querySelector('.session-card h3')?.textContent).toBe('Classics week');
    await mountHistory({...data,cycles:[],sessions:[{...data.sessions[0],cycle_id:null}]});
    expect(container.textContent).toContain('Ungrouped events'); expect(container.querySelector('.history-pagination')).toBeNull();
  });
});

it('Home shows only the top two eligible rankable Classics with summary scores',async()=>{
  const scores=[{provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:null,fetched_at:'2026-01-01'},{provider:'rottentomatoes',metric:'audience',raw_value:90,raw_scale:100,normalized_value:90,vote_count:null,fetched_at:'2026-01-01'},{provider:'rottentomatoes',metric:'critic',raw_value:85,raw_scale:100,normalized_value:85,vote_count:null,fetched_at:'2026-01-01'}];
  const pool=movies.slice(0,5).map((m,i)=>({...m,classic:true,scores:i===3?[]:scores,seen:[{member_id:'member-2',seen:i===4?1:0,updated_at:'2026-01-01'}],ranking:rankMovie(i===3?[]:scores,[{member_id:'member-2',seen:i===4?1:0,updated_at:'2026-01-01'}],catalog.members)}));
  await act(async()=>root.unmount());root=createRoot(container);
  vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:pool,sessions:[{id:'last',event_date:'2026-01-01',date_precision:'exact',host_member_id:'member-2',kind:'hosted',cycle_id:null,cycle_slot:2,legacy_cycle_label:null,movies:pool.slice(0,2)}]});
  window.location.hash='/home';await act(async()=>root.render(createElement(App)));await flush();
  expect([...container.querySelectorAll('.section-title h2')].map(e=>e.textContent)).toEqual(['Last turn','Next Classics','Classics Snapshot']);
  const home=container.querySelector('.home-dashboard')!;
  expect([...home.children].map(e=>e.className)).toEqual(['turn-card-area turn-card-area-personal','dashboard-grid','stack']);
  const snapshot=home.lastElementChild!;
  expect(snapshot.querySelector('.section-title a')?.getAttribute('href')).toBe('#/classics');
  expect([...snapshot.querySelectorAll('.stat strong')].map(e=>e.textContent)).toEqual(['3','1','0']);
  expect([...snapshot.querySelectorAll('.stat > span')].map(e=>e.textContent)).toEqual(['Eligible Classics','Already seen by all','Missing answers']);
  expect(snapshot.querySelector('.stat-link')?.getAttribute('href')).toBe('#/seen');
  const cards=container.querySelectorAll('.home-rank-card');expect(cards).toHaveLength(2);
  const top=sortClassics(pool).filter(m=>m.ranking?.eligible&&m.ranking.rankable).slice(0,2);
  expect([...cards].map(e=>e.querySelector('a')?.getAttribute('href'))).toEqual(top.map(m=>'#/movie/'+m.id));
  expect([...cards].map(e=>e.querySelector('.rank-number')?.textContent)).toEqual(['#1','#2']);
  for(const card of cards){expect(card.textContent).toContain('0 Seen · 1 No');expect([...card.querySelectorAll('.ranking-source-scores > span')].map(node=>node.textContent)).toEqual(['IMDb 80','RT-A 90','RT-C 85']);expect(card.textContent).not.toMatch(/Ranked|Unknown|residual score|Score breakdown/);expect(card.querySelector('details,.score,.badge')).toBeNull();}
  expect(container.querySelector('.home-session-card .eyebrow')?.textContent).toBe('1 January 2026');
  await navigate('classics');expect(container.querySelector('.ranking-row .score, .ranking-row details')).toBeNull();expect(container.querySelector('.ranking-row')?.textContent).toContain('IMDb 80');
});

it('History hides other-host edits and member admin actions without fetching audits',async()=>{
 const own={id:'own',event_date:'2026-01-01',date_precision:'exact' as const,host_member_id:'member-2',kind:'hosted' as const,cycle_id:null,cycle_slot:2,legacy_cycle_label:null,has_audit:true,movies:[{...movies[0],director:'A Director'},movies[1]]};
 const data={...catalog,sessions:[own,{...own,id:'other',host_member_id:'former'},{...own,id:'classics',kind:'classics' as const,host_member_id:null}]};
 const render=async(role:'admin'|'member',hasAudit=true)=>act(async()=>root.render(createElement(HistoryScreen,{catalog:{...data,sessions:data.sessions.map(s=>({...s,has_audit:hasAudit}))},viewer:{id:'member-2',display_name:'Member 2',sort_order:2,avatar:2,role},onChanged:vi.fn()})));
 await render('member');const cards=container.querySelectorAll('.session-card');
 expect(cards[0].querySelector('[aria-label="Edit event"]')).toBeTruthy();expect(cards[1].querySelector('[aria-label="Edit event"]')).toBeNull();expect(cards[2].querySelector('[aria-label="Edit event"]')).toBeNull();expect(container.querySelector('[aria-label="Audit event"],[aria-label="Delete event"]')).toBeNull();
 expect(cards[0].querySelector('.history-event-actions')?.lastElementChild?.className).toBe('history-event-identity');expect(cards[0].querySelector('.session-meta')).toBeNull();expect(cards[0].querySelectorAll('.history-film-director')).toHaveLength(1);expect(cards[0].querySelector('.history-film-director')?.textContent).toBe('A Director');
 await render('admin',false);expect(container.querySelectorAll('[aria-label="Edit event"]')).toHaveLength(3);expect(container.querySelectorAll('[aria-label="Delete event"]')).toHaveLength(3);expect(container.querySelector('[aria-label="Audit event"]')).toBeNull();expect(api.audit).not.toHaveBeenCalled();
});


describe('URL-only Admin screen',() => {
  const asAdmin = async () => {
    vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
    await act(async()=>root.unmount()); root=createRoot(container);
    await act(async()=>root.render(createElement(App))); await flush();
  };
  it('uses ordinary not-found treatment for a member',async()=>{
    await navigate('admin');
    expect(container.querySelector('h1')?.textContent).toBe('Page not found');
    expect(button('Fill missing metadata')).toBeUndefined();
    expect(button('Populate Missing Scores')).toBeUndefined();
    expect(container.textContent).not.toContain('Scores and OMDb metadata');
  });
  it('renders all four maintenance sections only on Admin and keeps them out of navigation and member screens',async()=>{
    await asAdmin(); await navigate('admin');
    expect(container.querySelector('h1')?.textContent).toBe('Admin');
    expect(container.querySelectorAll('main section.card h2')).toHaveLength(4);
    for(const label of ['Populate Missing Scores','Refresh Scores','Enrich/Refresh Metadata','Fill missing metadata']) expect(button(label)).toBeTruthy();
    expect(container.textContent).toContain('Scores and OMDb metadata');
    expect(container.textContent).toContain('TMDB metadata and artwork');
    expect(container.textContent).toContain('TMDB enrichment cache');
    expect(container.textContent).toContain('MDBList enrichment cache');
    await click(container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect(container.querySelector('.account-menu-dropdown')?.textContent).toBe('Logout');
    expect(container.querySelector('a[href="#/admin"]')).toBeNull();
    for(const nav of container.querySelectorAll('nav')) expect(nav.textContent).not.toContain('Admin');
    await navigate('classics');
    for(const tab of ['Ranked0','Unranked0','Seen0']) {
      await click(button(tab)); expect(button('Populate Missing Scores')).toBeUndefined();
      expect(container.querySelector('.classics-maintenance')).toBeNull();
    }
    await navigate('metrics'); expect(button('Fill missing metadata')).toBeUndefined();
    await navigate('home'); expect(container.textContent).toContain('Admin · swap current turn');
    await navigate('movie/saved-7'); expect(container.textContent).not.toContain('Admin · score maintenance');
    expect(button('Refresh scores')).toBeUndefined();
  });
  it('runs both moved maintenance actions and retains their live feedback',async()=>{
    const movie=movies[7];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,sessions:[{id:'event',movies:[movie],event_date:'2030-01-01',date_precision:'exact',host_member_id:'member-2',kind:'hosted',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]});
    vi.mocked(api.maintainMovies).mockResolvedValue({results:[{movie:{...movie,appearances:[]},providers:[{provider:'tmdb',status:'success',count:1,message:'Saved'}]}]} as Awaited<ReturnType<typeof api.maintainMovies>>);
    vi.mocked(api.enrichMetadataSelected).mockResolvedValue({results:[{movieId:movie.id,title:movie.title,provider:'tmdb',status:'success',message:'Updated.'}]});
    await asAdmin(); await navigate('admin');
    const bootstrapCalls=[vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length],catalogCalls=vi.mocked(api.catalog).mock.calls.length;
    await click(button('Refresh Scores'));
    expect(api.maintainMovies).toHaveBeenCalledWith('refresh',[movie.id]);
    expect(container.querySelector('progress')?.value).toBe(1);
    vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:catalog.movies.map(m=>m.id===movie.id ? {...m,director:'Director',tmdb_metadata_checked_at:new Date().toISOString(),tmdb_artwork_checked_at:new Date().toISOString()} : m)});
    await click(button('Fill missing metadata'));
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('1 successfully updated');
    expect(container.textContent).toContain('0 identified films remaining');
    expect([vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length]).toEqual(bootstrapCalls);
    expect(api.catalog).toHaveBeenCalledTimes(catalogCalls+2);
  });
  it('does not render admin controls without an authenticated viewer',async()=>{
    vi.mocked(api.me).mockResolvedValue({viewer:null});
    await act(async()=>root.unmount()); root=createRoot(container);
    window.location.hash='/admin'; await act(async()=>root.render(createElement(App))); await flush();
    expect(button('Populate Missing Scores')).toBeUndefined(); expect(button('Fill missing metadata')).toBeUndefined();
    expect(container.querySelector('h1')?.textContent).not.toBe('Admin');
  });
  it('stops TMDB work after the pending batch and preserves partial counts on Admin',async()=>{
    let release!: (value: Awaited<ReturnType<typeof api.enrichMetadataSelected>>) => void;
    const queue=[...catalog.movies,{...movies[7],id:'second',external_ids:[{provider:'tmdb',external_id:'108'}]},{...movies[7],id:'third',external_ids:[{provider:'tmdb',external_id:'109'}]}];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:queue});
    vi.mocked(api.enrichMetadataSelected).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    await asAdmin(); await navigate('admin');
    await click(button('Fill missing metadata'));
    expect(button('Fill missing metadata').disabled).toBe(true);
    await click(button('Stop after this batch'));
    const sent=vi.mocked(api.enrichMetadataSelected).mock.calls[0][0];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:queue.map(m=>sent.includes(m.id) ? {...m,director:'Director',tmdb_metadata_checked_at:new Date().toISOString(),tmdb_artwork_checked_at:new Date().toISOString()} : m)});
    await act(async()=>release({results:sent.map(movieId=>({movieId,title:'Film',provider:'tmdb',status:'success',message:'Updated.'}))}));
    await flush();
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('1 identified films remaining');
    expect(container.textContent).toContain('2 successfully updated');
    expect(container.textContent).toContain('Stopped. Completed updates are saved');
    expect(button('Stop after this batch')).toBeUndefined();
  });
  it('keeps provider failures and cooldown feedback beside both Admin maintenance sections',async()=>{
    const movie=movies[7];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,sessions:[{id:'event',movies:[movie],event_date:'2030-01-01',date_precision:'exact',host_member_id:'member-2',kind:'hosted',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]});
    vi.mocked(api.maintainMovies).mockResolvedValue({results:[{movie:{...movie,appearances:[]},providers:[{provider:'tmdb',status:'failed',count:0,message:'Score quota reached.',retryAfter:120}]}]});
    vi.mocked(api.enrichMetadataSelected).mockResolvedValue({results:[{movieId:movie.id,title:movie.title,provider:'tmdb',status:'failed',message:'Artwork quota reached.',retryAfter:60}]});
    await asAdmin(); await navigate('admin');
    await click(button('Refresh Scores'));
    expect(container.querySelector('.classics-maintenance')?.textContent).toContain('Score quota reached. Wait 120s before retrying.');
    await click(button('Fill missing metadata'));
    const tmdbSection=container.querySelector('[aria-labelledby="tmdb-maintenance-heading"]');
    expect(tmdbSection?.textContent).toContain('1 failures');
    expect(tmdbSection?.textContent).toContain('Artwork quota reached. Retry after at least 60 seconds.');
    expect(tmdbSection?.textContent).toContain('Completed updates are saved');
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();
  });
});

it('keeps App-owned Seen saves serial through navigation and exposes failures for retry on return',async()=>{
 const pool=movies.slice(0,3).map(m=>({...m,classic:true}));
 vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:pool});
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(createElement(App)));await flush();
 const requests:{resolve:(movie:Movie)=>void;reject:(error:Error)=>void}[]=[];
 vi.mocked(api.seen).mockImplementation(()=>new Promise((resolve,reject)=>requests.push({resolve:movie=>resolve({...movie,appearances:[]}),reject})));
 await navigate('seen');await click(button('Yes, seen it'));expect(container.querySelector('.answer-card')?.textContent).toContain('Film 1');
 await click(button('No, not yet'));expect(api.seen).toHaveBeenCalledTimes(1);expect(container.querySelectorAll('.recent-answer')).toHaveLength(2);
 await navigate('home');await act(async()=>requests[0].reject(new Error('Offline')));await flush();
 expect(api.seen).toHaveBeenCalledTimes(2);expect(container.textContent).toContain('Seen answers are unsaved');
 await act(async()=>requests[1].resolve({...pool[1],seen:[{member_id:'member-2',seen:0,updated_at:'saved'}]}));await flush();
 await navigate('seen');expect(container.textContent).toContain('Film 0: Seen');expect(container.querySelector('.answer-card')?.textContent).toContain('Film 2');
 await click(button('Retry saving Film 0'));expect(api.seen).toHaveBeenLastCalledWith('saved-0','member-2',true);
 await act(async()=>requests[2].resolve({...pool[0],seen:[{member_id:'member-2',seen:1,updated_at:'saved'}]}));await flush();
 expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('Event save performs one shared-data reconciliation without repeating bootstrap health or auth',async()=>{
 await search();await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);await click(button('Yes, this one!'));
 await input(container.querySelector<HTMLInputElement>('input[name="event_date"]')!,'2030-01-01');
 await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
 vi.mocked(api.saveSession).mockResolvedValue({id:'new-event',movies:[movies[0]],event_date:'2030-01-01',host_member_id:'member-2',kind:'hosted',date_precision:'exact',cycle_id:null,cycle_slot:null,legacy_cycle_label:null});
 await click(button('Save event'));await flush();
 expect(api.saveSession).toHaveBeenCalledOnce();expect(api.catalog).toHaveBeenCalledTimes(2);expect(api.rotation).toHaveBeenCalledTimes(2);
 expect(api.health).toHaveBeenCalledOnce();expect(api.me).toHaveBeenCalledOnce();
});
it('App applies the returned rotation swap without catalogue, rotation, health or auth reloads',async()=>{
 vi.mocked(api.catalog).mockResolvedValue({...catalog,members:[...catalog.members,{id:'member-3',display_name:'Member 3',sort_order:3,active:1,avatar:3}]});
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>root.unmount());root=createRoot(container);window.location.hash='/home';await act(async()=>root.render(createElement(App)));await flush();
 vi.clearAllMocks();
 const turn={id:1,nominal_slot:2,cycle_id:null,version:1,updated_at:'saved',human_order:{'2':'member-3','3':'member-2'}};
 vi.mocked(api.swapRotation).mockResolvedValue(turn);
 await act(async()=>{const select=container.querySelector('.turn-card')!.querySelector('select')!;select.value='member-3';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>container.querySelector('.turn-card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 expect(api.swapRotation).toHaveBeenCalledOnce();expect(container.querySelector('.turn-identity')?.textContent).toContain('MEMBER 3');
 expect(api.catalog).not.toHaveBeenCalled();expect(api.rotation).not.toHaveBeenCalled();expect(api.health).not.toHaveBeenCalled();expect(api.me).not.toHaveBeenCalled();
});

it('a returned swap does not discard an in-flight broad catalogue refresh or get overwritten by its older Rotation',async()=>{
 const club={...catalog,members:[...catalog.members,{id:'member-3',display_name:'Member 3',sort_order:3,active:1,avatar:3}]};
 vi.mocked(api.catalog).mockResolvedValue(club);vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>root.unmount());root=createRoot(container);window.location.hash='/admin';await act(async()=>root.render(createElement(App)));await flush();vi.clearAllMocks();
 let release!:(catalog:Catalog)=>void;vi.mocked(api.catalog).mockReturnValueOnce(new Promise(resolve=>{release=resolve;}));
 vi.mocked(api.enrichMetadataSelected).mockResolvedValue({results:[{movieId:'saved-7',title:'Fixture',provider:'tmdb',status:'success',message:'Saved'}]});
 await click(button('Fill missing metadata'));expect(api.catalog).toHaveBeenCalledOnce();
 await navigate('home');vi.mocked(api.swapRotation).mockResolvedValue({id:1,nominal_slot:2,cycle_id:null,version:1,updated_at:'saved',human_order:{'2':'member-3','3':'member-2'}});
 await act(async()=>{const select=container.querySelector('.turn-card')!.querySelector('select')!;select.value='member-3';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>container.querySelector('.turn-card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 const fresh={...movies[0],title:'Metadata reconciled'};
 await act(async()=>release({...club,movies:[fresh,...movies.slice(1)],sessions:[{id:'fresh',movies:[fresh],event_date:'2030-01-01',host_member_id:'member-2',kind:'hosted',date_precision:'exact',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]}));await flush();
 expect(container.querySelector('.turn-identity')?.textContent).toContain('MEMBER 3');expect(container.textContent).toContain('Metadata reconciled');
 expect(api.catalog).toHaveBeenCalledOnce();expect(api.health).not.toHaveBeenCalled();expect(api.me).not.toHaveBeenCalled();
});

it('shows dev tools only on local Admin and reloads identity through bootstrap',async()=>{
 vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,tmdbConfigured:false,mdblistConfigured:false,omdbConfigured:false,demo:true});
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(createElement(App)));await flush();
 await navigate('classics');expect(container.querySelector('.developer-tools')).toBeNull();
 expect(container.querySelector('.app-layout > .demo-label')?.textContent).toBe('Local disposable database');
 expect(container.querySelector('main .demo-label,.page-heading .demo-label')).toBeNull();
 await navigate('admin');await vi.waitFor(async () => { await flush(); expect(container.querySelector('.developer-tools')).toBeTruthy(); });
 expect(button('Refresh Dev DB from Production')).toBeTruthy();expect(button('Confirm local replacement')).toBeUndefined();
 await click(button('Refresh Dev DB from Production'));expect(button('Confirm local replacement')).toBeTruthy();await click(button('Cancel'));
 const before=[vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length];
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'member'}});
 await act(async()=>{const select=container.querySelector('.developer-tools select')!;Object.assign(select,{value:catalog.members[0].id});select.dispatchEvent(new Event('change',{bubbles:true}));});await flush();
 expect(setDevMember).toHaveBeenCalledWith(catalog.members[0].id);
 expect([vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length]).toEqual(before.map(n=>n+1));
 expect(container.querySelector('h1')?.textContent).toBe('Page not found');expect(container.querySelector('.developer-tools')).toBeNull();
});
it.each(['production','import-preview'])('hides the local indicator and dev tools for %s even with demo set',async(environment)=>{
 vi.mocked(api.health).mockResolvedValue({status:'ok',environment,authenticationRequired:true,googleAuthConfigured:false,tmdbConfigured:false,mdblistConfigured:false,omdbConfigured:false,demo:true});
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(createElement(App)));await flush();await navigate('admin');
 expect(container.querySelector('.demo-label,.developer-tools')).toBeNull();expect(button('Populate Missing Scores')).toBeTruthy();
});

describe('Builder inspection and Use Set',() => {
  const openBuilder = async () => { await navigate('builder'); await click(button('New set')); };
  const builderSearch = async () => {
    await input(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,'film');
    await act(async () => { container.querySelector('.builder-workflow .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }); await flush();
  };
  it('preserves the mounted draft and search on route return and browser Back without inclusion',async () => {
    await openBuilder();
    const editor = container.querySelector('.builder-workflow');
    await input(container.querySelector<HTMLInputElement>('input[maxlength="300"]')!,'Private draft');
    const note = container.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(note,'Private notes'); note.dispatchEvent(new Event('input',{bubbles:true})); });
    await builderSearch(); await click(button('Next'));
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);
    expect(lineup()).toEqual([]); expect(button('Add to Set')).toBeTruthy(); expect(button('Yes, this one!')).toBeUndefined();
    expect(container.querySelector('.builder-workflow')).toBe(editor); expect(editor?.parentElement?.hidden).toBe(true);
    await navigate('builder');
    expect(container.querySelector('.builder-workflow')).toBe(editor); expect(note.value).toBe('Private notes');
    expect(container.querySelector<HTMLInputElement>('input[maxlength="300"]')!.value).toBe('Private draft');
    expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('film');
    expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!);
    await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve,20)); }); await flush();
    expect(window.location.hash).toBe('#/builder'); expect(container.querySelector('.builder-workflow')).toBe(editor);
    expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    expect(api.saveBuilder).not.toHaveBeenCalled();
  });
  it('canonical local confirmation matches direct Plus reset, focus, repeats, reorder and removal',async () => {
    await openBuilder(); await builderSearch();
    await click(container.querySelector<HTMLElement>('button[aria-label="Add Film 0"]')!);
    const editor=container.querySelector('.builder-workflow');
    await builderSearch(); await click(button('Next'));
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); await act(async () => { button('Add to Set').click(); button('Add to Set').click(); }); await flush();
    expect(window.location.hash).toBe('#/builder'); expect(container.querySelector('.builder-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Film 0','Film 6']);
    expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe(''); expect(container.querySelector('.search-row')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('input[maxlength="150"]'));
    await builderSearch(); expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 1 of 2');
    await click(container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Add to Set'));
    expect(lineup()).toEqual(['Film 0','Film 6','Film 0']); expect(api.importMovie).not.toHaveBeenCalled();
    await click(container.querySelector<HTMLElement>('button[aria-label="Move Film 6 earlier"]')!); expect(lineup()).toEqual(['Film 6','Film 0','Film 0']);
    await click(container.querySelector<HTMLElement>('button[aria-label="Remove Film 6"]')!); expect(lineup()).toEqual(['Film 0','Film 0']);
    await navigate('home'); await navigate('movie/saved-0'); expect(button('Add to Set')).toBeUndefined();
  });
  it('imports only on confirmation, locks repeated submissions, preserves failure for retry and patches catalogue',async () => {
    await openBuilder(); await builderSearch(); await click(button('Next'));
    const editor=container.querySelector('.builder-workflow');
    await click(container.querySelectorAll<HTMLAnchorElement>('.search-row a')[2]); expect(api.importMovie).not.toHaveBeenCalled();
    let reject!: (error: Error) => void;
    vi.mocked(api.importMovie).mockImplementationOnce(() => new Promise((_resolve,fail) => { reject=fail; }));
    const add=button('Add to Set'); await act(async () => { add.click(); add.click(); });
    expect(api.importMovie).toHaveBeenCalledTimes(1); expect(button('Adding…').disabled).toBe(true);
    await act(async () => reject(new Error('Please retry import.'))); await flush();
    expect(window.location.hash).toBe('#/preview/tmdb/42'); expect(container.textContent).toContain('Please retry import.');
    expect(container.querySelector('.builder-workflow')).toBe(editor); expect(lineup()).toEqual([]);
    expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('film');
    expect(container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    await click(button('Add to Set')); expect(api.importMovie).toHaveBeenLastCalledWith('42'); expect(lineup()).toEqual(['Imported film']);
    expect(window.location.hash).toBe('#/builder'); expect(container.querySelector('.search-row')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('input[maxlength="150"]'));
    vi.mocked(api.builders).mockResolvedValue([{id:'new-set',owner_member_id:'member-2',title:'',notes:'',movie_ids:['canonical-import'],revision:1,created_at:'2026-01-01',updated_at:''}]);
    await click(button('Save set')); await click(button('Open set')); expect(lineup()).toEqual(['Imported film']);
  });
  it.each([false,true])('successful Save returns to the reconciled list (existing=%s)',async existing => {
    const set={id:'existing',owner_member_id:'member-2',title:'Old',notes:'Old note',movie_ids:['saved-2','saved-0','saved-2'],revision:3,created_at:'2026-01-01',updated_at:''};
    vi.mocked(api.builders).mockResolvedValue(existing ? [set] : []);
    await navigate('builder'); await click(button(existing ? 'Open set' : 'New set'));
    await input(container.querySelector<HTMLInputElement>('input[maxlength="300"]')!,'Saved title');
    const note=container.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(note,'Saved note'); note.dispatchEvent(new Event('input',{bubbles:true})); });
    vi.mocked(api.builders).mockResolvedValue([{...set,id:existing ? 'existing':'new-set',title:'Saved title',notes:'Saved note',movie_ids:existing ? set.movie_ids : []}]);
    await click(button('Save set'));
    expect(button('Save set')).toBeUndefined(); expect(button('New set')).toBeTruthy(); expect(container.textContent).toContain('Saved title'); expect(container.textContent).toContain('Saved note');
    expect(container.textContent).not.toContain('Private set saved.');
    expect(api.saveBuilder).toHaveBeenCalledWith({title:'Saved title',notes:'Saved note',movie_ids:existing ? set.movie_ids:[],...(existing ? {revision:3}: {})},existing ? 'existing':undefined);
    await click(button('Open set')); expect(lineup()).toEqual(existing ? ['Film 2','Film 0','Film 2']:[]);
  });
  it('save rejection preserves editor and draft for retry',async () => {
    await openBuilder(); await input(container.querySelector<HTMLInputElement>('input[maxlength="300"]')!,'Unsaved');
    await builderSearch();
    vi.mocked(api.saveBuilder).mockRejectedValueOnce(new Error('Save unavailable.')); await click(container.querySelector<HTMLElement>('button[aria-label="Add Film 0"]')!);
    vi.mocked(api.saveBuilder).mockRejectedValueOnce(new Error('Save unavailable.')); await click(button('Save set'));
    expect(button('Save set')).toBeTruthy(); expect(container.querySelector<HTMLInputElement>('input[maxlength="300"]')!.value).toBe('Unsaved'); expect(lineup()).toEqual(['Film 0']); expect(container.textContent).toContain('Save unavailable.');
    await click(button('Save set')); expect(button('New set')).toBeTruthy();
  });
  it.each(['own','swapped-own','other','swapped-other','classics','historical'])('uses effective current-turn identity (%s)',async kind => {
    const other={id:'sean',display_name:'Sean',sort_order:1,active:1,avatar:1};
    const turn: Rotation={id:1,nominal_slot:kind==='classics'?5:kind.startsWith('swapped')?1:2,cycle_id:null,version:9,updated_at:'',human_order:kind==='swapped-own'?{'1':'member-2'}:kind==='swapped-other'?{'1':'sean'}:kind==='other'||kind==='historical'?{'2':'sean'}:undefined};
    vi.mocked(api.catalog).mockResolvedValue({...catalog,members:[...catalog.members,other]}); vi.mocked(api.rotation).mockResolvedValue(turn);
    await act(async () => root.unmount()); root=createRoot(container); window.location.hash='/builder'; await act(async () => root.render(createElement(App))); await flush();
    await click(button('New set')); await builderSearch(); await click(container.querySelector<HTMLElement>('button[aria-label="Add Film 0"]')!); await click(button('Use Set'));
    expect(container.querySelector('h2#publish-heading')?.textContent).toBe('Use this set?');
    expect(container.textContent).toContain('1 film in the saved order. This will move this film into a Book Club event as the one you brought.');
    expect(button('Use Set')).toBeTruthy(); expect(container.textContent).not.toMatch(/Review publication|Confirm publication|Publishing…/);
    if (kind==='historical') await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    const warning=container.querySelector('.builder-turn-warning');
    if (kind==='other'||kind==='swapped-other') expect(warning?.textContent).toBe("Current turn: Sean. You're not Sean. If you need to swap turns, ask the Troy of your household.");
    else { expect(warning).toBeNull(); expect(container.textContent).toContain(kind==='classics'?'Actual host: CLSC · hostless':'Actual host: MEMBER 2'); }
    expect(api.swapRotation).not.toHaveBeenCalled();
  });
  it('Use Set keeps the ordered repeated IDs and original publish API payload',async () => {
    await openBuilder(); for (const index of [2,0,2]) { await builderSearch(); await click(container.querySelector<HTMLElement>(`button[aria-label="Add Film ${index}"]`)!); }
    await click(button('Use Set')); expect(container.textContent).toContain('3 films in the saved order. This will move these films into a Book Club event as the ones you brought.');
    let resolve!: (value: Awaited<ReturnType<typeof api.publishBuilder>>) => void;
    vi.mocked(api.publishBuilder).mockImplementationOnce(() => new Promise(done => { resolve=done; }));
    await click(button('Use Set')); expect(button('Using Set…').disabled).toBe(true); expect(container.textContent).not.toContain('Publishing');
    expect(api.saveBuilder).toHaveBeenLastCalledWith({title:'',notes:'',movie_ids:['saved-2','saved-0','saved-2'],revision:1},'new-set');
    expect(api.publishBuilder).toHaveBeenCalledWith('new-set',expect.objectContaining({revision:1,cycle_slot:2,complete_turn:true,turn_version:0}));
    await act(async () => resolve({} as Awaited<ReturnType<typeof api.publishBuilder>>)); await flush(); expect(window.location.hash).toBe('#/history');
  });
});

it('canonical provider title is shared by Home, History, all Classics tabs, Seen, Detail, Builder, Event, search, Metrics and confirmation',async()=>{
 const title='Correct Provider Name';
 const members=catalog.members;
 const score={provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:100,fetched_at:'2026-01-01',retrieved_via:'omdb'};
 const fixture=['ranked','unranked','seen'].map((id,i)=>{
   const seen=i===1?[]:[{member_id:members[0].id,seen:i===2?1:0,updated_at:''}];
   return {...movies[0],id,title,classic:true,scores:[score],seen,ranking:rankMovie([score],seen,members),legacy_title:'Wrong Legacy Name'};
 });
 const session={id:'canonical-event',movies:[fixture[0]],host_member_id:members[0].id,event_date:'2026-01-01',cycle_id:null,cycle_slot:2,kind:'hosted' as const,date_precision:'exact' as const,legacy_cycle_label:null};
 const canonical={...catalog,movies:fixture,sessions:[session]};
 vi.mocked(api.catalog).mockResolvedValue(canonical);
 vi.mocked(api.me).mockResolvedValue({viewer:{...members[0],avatar:2,role:'admin'}});
 vi.mocked(api.detail).mockImplementation(async id=>({...fixture.find(m=>m.id===id)!,appearances:[]}));
 vi.mocked(api.search).mockResolvedValue({local:[{id:'ranked',title,year:1998,poster:null,tmdbId:null}],external:[],lookup:{available:true,message:null}});
 vi.mocked(api.builders).mockResolvedValue([{id:'canonical-set',owner_member_id:members[0].id,title:'Private set',notes:null,movie_ids:['ranked'],revision:1,created_at:'2026-01-01',updated_at:''}]);
 await act(async()=>root.render(createElement(App,{key:'canonical-fixture'})));await flush();
 const visible=()=>[...container.querySelectorAll('main')].map(e=>e.textContent).join('');
 for(const route of ['home','history','classics','seen','movie/ranked','metrics','event/canonical-event']) {
   await navigate(route);
   if(route==='metrics')await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent==='Top / Bottom')!.click());
   expect(visible(),route).toContain(title);expect(visible(),route).not.toContain('Wrong Legacy Name');
   if(route==='metrics') {
     for(const [tab,selectors] of [['Top / Bottom',['.metrics-rankings','.metrics-popularity-list']],['Extremes',['.metrics-extremes']]] as const) {
       await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===tab)!.click());
       for(const selector of selectors)expect(container.querySelector(selector)?.textContent).toContain(title);
     }
   }
 }
 await navigate('classics');
 for(const tab of ['Ranked','Unranked','Seen']) {
   await click([...container.querySelectorAll<HTMLButtonElement>('.classics-filters button')].find(b=>b.textContent?.startsWith(tab))!);
   expect(container.querySelector('.ranking-list')?.textContent).toContain(title);
 }
 await click(container.querySelector<HTMLButtonElement>('.classic-remove')!);expect(container.querySelector('dialog')?.textContent).toContain(title);await click(button('Cancel'));
 await click(button('Add Classic'));await input(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,title);
 await act(async()=>container.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 expect(container.querySelector('dialog .search-row')?.textContent).toContain(title);await click(container.querySelector<HTMLButtonElement>('button[aria-label="Close Add Classic"]')!);
 await navigate('builder');await click(button('Open set'));expect(lineup()).toEqual([title]);
 await input(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,title);
 await act(async()=>container.querySelector('.builder-workflow .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();expect(container.querySelector('.search-row')?.textContent).toContain(title);
 await navigate('home');await click(button('Use from Builder'));expect(container.querySelector('dialog')?.textContent).toContain(title);await click(button('Cancel'));
 expect(api.importMovie).not.toHaveBeenCalled();
});

const historyFixture = (): Catalog => ({...catalog,movies:[{...movies[0],au_classification:'MA15+'},movies[1]],cycles:Array.from({length:12},(_,i)=>({id:`c${12-i}`,ordinal:12-i,title:null,rough_date:'2026-01-01',import_source:null,import_key:null,created_at:'',updated_at:''})),sessions:Array.from({length:12},(_,i)=>[1,2].map(slot=>({id:`e${12-i}-${slot}`,cycle_id:`c${12-i}`,cycle_slot:slot,event_date:'2026-01-01',date_precision:'exact' as const,host_member_id:'member-2',kind:'hosted' as const,legacy_cycle_label:null,movies:[{...movies[0],au_classification:'MA15+'},movies[1]]}))).flat()});
it('History reverses cycles, events, films, jump and pagination together and keeps sort only within History detail context',async()=>{
 await act(async()=>root.unmount());root=createRoot(container);vi.mocked(api.catalog).mockResolvedValue(historyFixture());window.location.hash='/history';await act(async()=>root.render(createElement(App)));await flush();
 const cycles=()=>[...container.querySelectorAll('section[id^="cycle-"]')].map(e=>e.id);
 expect(cycles()).toEqual(['cycle-c12','cycle-c11','cycle-c10','cycle-c9','cycle-c8']);
 const metas=container.querySelectorAll('.history-event .film-list .movie-copy > .meta:first-of-type');expect(metas[0].textContent).toBe('1998 · 100 min · MA15+');expect(metas[1].textContent).toBe('1998 · 100 min');
 await click(button('Resort'));expect(cycles()).toEqual(['cycle-c1','cycle-c2','cycle-c3','cycle-c4','cycle-c5']);
 expect(container.querySelectorAll('#cycle-c1 .film-list .movie-title')[0].textContent).toBe('Film 1');
 expect(container.querySelectorAll('#cycle-c1 .session-card [href^="#/event/"]')[0].getAttribute('href')).toBe('#/event/e1-2');
 const jump=container.querySelector('.archive-tools select') as unknown as HTMLSelectElement;
 expect([...jump.options].slice(1).map(o=>o.value)).toEqual(Array.from({length:12},(_,i)=>`c${i+1}`));
 await act(async()=>{jump.value='c11';jump.dispatchEvent(new Event('change',{bubbles:true}));});expect(cycles()).toEqual(['cycle-c11','cycle-c12']);
 await click(button('Previous'));expect(cycles()).toEqual(['cycle-c6','cycle-c7','cycle-c8','cycle-c9','cycle-c10']);
 const host=container.querySelectorAll('.archive-tools select')[1] as unknown as HTMLSelectElement;await act(async()=>{host.value='member-2';host.dispatchEvent(new Event('change',{bubbles:true}));});expect(cycles()[0]).toBe('cycle-c1');
 await click(container.querySelector<HTMLAnchorElement>('.film-list .movie-link')!);await navigate('history');expect(cycles()[0]).toBe('cycle-c1');
 await navigate('home');await navigate('history');expect(cycles()[0]).toBe('cycle-c12');
 await click(button('Resort'));await click(button('Resort'));expect(cycles()[0]).toBe('cycle-c12');
 await click(button('Resort'));await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(createElement(App)));await flush();expect(cycles()[0]).toBe('cycle-c12');
});
it('Builder queues optimistic changes, preserves newest text and draft on failure, and never reloads the list per save',async()=>{
 await navigate('builder');expect(container.querySelector('.page-heading-actions button')?.textContent).toBe('New set');expect(container.querySelector('.builder-workflow button')?.textContent).not.toBe('New set');await click(button('New set'));expect(api.saveBuilder).not.toHaveBeenCalled();
 const title=container.querySelector<HTMLInputElement>('input[maxlength="300"]')!;await input(title,'Local typing');expect(api.saveBuilder).not.toHaveBeenCalled();
 let resolve!:(set:BuilderSet)=>void;vi.mocked(api.saveBuilder).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await input(title,'Newer title');await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await act(async()=>resolve({id:'auto',owner_member_id:'member-2',title:'Local typing',notes:null,movie_ids:[],revision:8,created_at:'2026-01-01',updated_at:''}));await flush();
 expect(title.value).toBe('Newer title');expect(api.saveBuilder).toHaveBeenLastCalledWith({title:'Newer title',notes:'',movie_ids:[],revision:8},'auto');
 expect(api.builders).toHaveBeenCalledTimes(1);expect(container.querySelector('summary')?.textContent).not.toContain('Add a film manually');
 vi.mocked(api.search).mockResolvedValue(results);await input(container.querySelector('input[maxlength="150"]')!,'film');await act(async()=>container.querySelector('.builder-workflow form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 expect(container.querySelector('button[aria-label="Add Film 0"]')?.classList.contains('builder-result-add')).toBe(true);
 vi.mocked(api.saveBuilder).mockRejectedValueOnce(new Error('Autosave unavailable'));await click(container.querySelector('button[aria-label="Add Film 0"]')!);
 expect(lineup()).toEqual(['Film 0']);expect(container.textContent).toContain('Set changes are unsaved');expect(container.querySelector('.builder-lineup-identity')?.firstElementChild?.textContent).toBe('#1');expect(container.querySelector('.builder-lineup')?.textContent).not.toContain('Viewing position');
 await click(button('Save set'));expect(button('Save set')).toBeUndefined();expect(api.builders).toHaveBeenCalledTimes(1);expect(container.querySelectorAll('.builder-poster-strip .poster')).toHaveLength(1);
});
it('All sets stays in the list when a newly queued draft finishes, and can reopen the optimistic draft',async()=>{
 await navigate('builder');await click(button('New set'));let resolve!:(set:BuilderSet)=>void;vi.mocked(api.saveBuilder).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const title=container.querySelector<HTMLInputElement>('input[maxlength="300"]')!;await input(title,'Queued set');await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();await click(button('All sets'));expect(button('Open set')).toBeTruthy();expect(button('Save set')).toBeUndefined();
 await act(async()=>resolve({id:'queued',owner_member_id:'member-2',title:'Queued set',notes:null,movie_ids:[],revision:1,created_at:'2026-01-01',updated_at:''}));await flush();expect(button('Save set')).toBeUndefined();await click(button('Open set'));expect(title.isConnected).toBe(false);expect(container.querySelector<HTMLInputElement>('input[maxlength="300"]')!.value).toBe('Queued set');
});
it.each([1,2,3,9])('Builder displays only the first four shared poster previews (%i films)',async count=>{
 vi.mocked(api.builders).mockResolvedValue([{id:'posters',owner_member_id:'member-2',title:'Posters',notes:null,movie_ids:Array.from({length:count},(_,i)=>movies[i%movies.length].id),revision:1,created_at:'2026-01-01',updated_at:''}]);await navigate('builder');expect(container.querySelectorAll('.builder-poster-strip .poster')).toHaveLength(Math.min(4,count));expect(container.querySelector('.builder-poster-strip a')).toBeNull();expect(container.querySelector('.poster-empty')).toBeTruthy();
});
it.each(['title','note'])('Builder %s blur creates a new draft while typing stays local',async field=>{
 await navigate('builder');await click(button('New set'));const control=field==='title'?container.querySelector('input[maxlength="300"]')!:container.querySelector('textarea')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(field==='title'?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value')!.set!.call(control,'Blur value');control.dispatchEvent(new Event('input',{bubbles:true}));});expect(api.saveBuilder).not.toHaveBeenCalled();
 await act(async()=>control.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();expect(api.saveBuilder).toHaveBeenCalledExactlyOnceWith({title:field==='title'?'Blur value':'',notes:field==='note'?'Blur value':'',movie_ids:[]},undefined);
});

it('Builder applies additions, move and removal before saving and Use Set publishes the final revision',async()=>{
 await navigate('builder');await click(button('New set'));
 let first!:(set:BuilderSet)=>void,second!:(set:BuilderSet)=>void;
 vi.mocked(api.saveBuilder).mockImplementationOnce(()=>new Promise(done=>{first=done;})).mockImplementationOnce(()=>new Promise(done=>{second=done;}));
 const searchBuilder=async()=>{await input(container.querySelector('input[maxlength="150"]')!,'film');await act(async()=>container.querySelector('.builder-workflow form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();};
 await searchBuilder();await click(container.querySelector('button[aria-label="Add Film 0"]')!);expect(lineup()).toEqual(['Film 0']);expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await searchBuilder();await click(container.querySelector('button[aria-label="Add Film 1"]')!);await click(container.querySelector('button[aria-label="Move Film 1 earlier"]')!);expect(lineup()).toEqual(['Film 1','Film 0']);await click(container.querySelector('button[aria-label="Remove Film 0"]')!);expect(lineup()).toEqual(['Film 1']);expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await act(async()=>button('Use Set').click());expect(button('Use Set').disabled).toBe(true);expect(api.publishBuilder).not.toHaveBeenCalled();
 const set:BuilderSet={id:'race',owner_member_id:'member-2',title:null,notes:null,movie_ids:['saved-0'],revision:9,created_at:'2026-01-01',updated_at:''};
 await act(async()=>first(set));await flush();expect(api.saveBuilder).toHaveBeenLastCalledWith({title:'',notes:'',movie_ids:['saved-1'],revision:9},'race');expect(container.querySelector('#publish-heading')).toBeNull();expect(lineup()).toEqual(['Film 1']);
 await act(async()=>second({...set,movie_ids:['saved-1'],revision:10}));await flush();expect(container.querySelector('#publish-heading')).toBeTruthy();
 vi.mocked(api.publishBuilder).mockResolvedValue({} as Awaited<ReturnType<typeof api.publishBuilder>>);await click(button('Use Set'));expect(api.publishBuilder).toHaveBeenCalledWith('race',expect.objectContaining({revision:10}));expect(api.builders).toHaveBeenCalledTimes(1);
});
