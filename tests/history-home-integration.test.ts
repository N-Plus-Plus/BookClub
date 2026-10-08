// @vitest-environment jsdom
import { harness, movies, catalog, flush, navigate, button, click } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { Catalog } from '../shared/types';
import { rankMovie, sortClassics } from '../shared/ranking';
import { api } from '../frontend/api';
import { App } from '../frontend/App';

import { HistoryScreen } from '../frontend/HistoryScreen';
import { SessionCard } from '../frontend/components';

describe('History cycle archive',() => {
  const archive = (): Catalog => {
    const cycles = Array.from({length:11},(_,i) => ({id:`cycle-${11-i}`,ordinal:11-i,rough_date:'2026-08-30',title:null,import_source:null,import_key:null,created_at:'',updated_at:''}));
    const sessions: Catalog['sessions'] = cycles.flatMap((cycle,i) => [1,2].map(slot => ({id:`event-${i}-${slot}`,event_date:slot === 1 ? '2026-08-30' : '2026-09-01',host_member_id:i === 10 ? null : 'member-2',legacy_cycle_label:null,movies:movies.slice(0,3),cycle_id:cycle.id,kind:i === 10 ? 'classics' as const : 'hosted' as const,date_precision:slot === 1 ? 'cycle_rough' as const : 'exact' as const,cycle_slot:slot,has_audit:true})));
    sessions.push({...sessions[0],id:'ungrouped',cycle_id:null});
    return {...catalog,cycles,sessions};
  };
  const mountHistory = async (data = archive(), onChanged = vi.fn()) => {
    await act(async () => { harness.root.render(createElement(HistoryScreen,{catalog:data,onChanged,viewer:{id:'member-2',display_name:'Member 2',sort_order:2,avatar:2,role:'admin'}})); }); return onChanged;
  };
  const select = async (index: number,value: string) => {
    await act(async () => { const element = harness.container.querySelectorAll('select')[index]; element.value = value; element.dispatchEvent(new Event('change',{bubbles:true})); });
  };
  it('pages five cycles in existing order with matching controls, jumps after mounting and resets on host filtering',async () => {
    await mountHistory();
    expect([...harness.container.querySelectorAll('section[id^="cycle-"]')].map(node => node.id)).toEqual(['cycle-cycle-11','cycle-cycle-10','cycle-cycle-9','cycle-cycle-8','cycle-cycle-7']);
    expect(harness.container.querySelectorAll('.session-card')).toHaveLength(10);
    expect(harness.container.querySelectorAll('.history-pagination')).toHaveLength(2);
    expect([...harness.container.querySelectorAll('.history-pagination')].map(node => node.textContent)).toEqual(['PreviousPage 1 of 3Next','PreviousPage 1 of 3Next']);
    expect(button('Previous').disabled).toBe(true);
    expect(harness.container.textContent).not.toContain('Ungrouped events');
    expect(harness.container.querySelector('a[href="#/event"]')).toBeNull();
    await click(button('Next')); expect(harness.container.textContent).toContain('Page 2 of 3');
    let scrolledId = '';
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) { scrolledId = this.id; });
    await select(0,'cycle-1');
    expect(harness.container.textContent).toContain('Page 3 of 3'); expect(scrolledId).toBe('cycle-cycle-1');
    expect(button('Next').disabled).toBe(true); expect(harness.container.textContent).toContain('Ungrouped events');
    await select(1,'member-2');
    expect(harness.container.textContent).toContain('Page 1 of 2'); expect(button('Previous').disabled).toBe(true);
    expect(harness.container.querySelector('option[value="cycle-1"]')).toBeNull();
    await select(1,'classics'); expect(harness.container.textContent).toContain('Page 1 of 1');
    expect(button('Previous').disabled).toBe(true); expect(button('Next').disabled).toBe(true);
  });
  it('keeps icon actions inside their card, audit evidence below that card, cached audit and delete behaviour',async () => {
    vi.mocked(api.audit).mockResolvedValue([]); vi.mocked(api.deleteSession).mockResolvedValue({removedSessionId:'event-0-1'});
    const onChanged = await mountHistory();
    const event = harness.container.querySelector<HTMLElement>('.history-event')!;
    const actions = event.querySelectorAll<HTMLElement>('.session-card .history-event-actions > .button');
    expect([...actions].map(node => node.getAttribute('aria-label'))).toEqual(['Edit event','Audit event','Delete event']);
    expect([...actions].every(node => node.title && !node.textContent)).toBe(true);
    expect(actions[0].getAttribute('href')).toBe('#/event/event-0-1');
    expect(actions[2].getAttribute('data-variant')).toBe('danger');
    await click(actions[1]); expect(api.audit).toHaveBeenCalledWith('event-0-1');
    expect(event.querySelector('.audit-inline')?.previousElementSibling?.classList.contains('session-card')).toBe(true);
    expect(harness.container.querySelectorAll('.audit-inline')).toHaveLength(1);
    await click(actions[1]); await click(actions[1]); expect(api.audit).toHaveBeenCalledTimes(1);
    const confirm=vi.spyOn(window,'confirm');
    await click(actions[2]); expect(api.deleteSession).not.toHaveBeenCalled();
    await click(button('Cancel'));expect(api.deleteSession).not.toHaveBeenCalled();
    await click(actions[2]);await click(button('Remove event'));expect(confirm).not.toHaveBeenCalled(); expect(api.deleteSession).toHaveBeenCalledWith('event-0-1'); expect(onChanged).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
  it('uses concise History dates and ordered Film Detail links alongside compact Home headings',async () => {
    const data = archive(); await mountHistory(data);
    const cards = harness.container.querySelectorAll('.session-card');
    expect(cards[0].querySelector('.eyebrow')?.textContent).toBe('Cycle started 30 August 2026');
    expect(cards[1].querySelector('.eyebrow')?.textContent).toBe('1 September 2026');
    expect(cards[0].querySelector('h3')?.textContent).toBe("Member 2's week");
    expect(cards[0].querySelector('.film-list a .position')?.textContent).toBe('#1');
    const context = harness.container.querySelector('.history-cycle-context')!;
    expect(context.textContent).toBe('Cycle starting: 30 August 2026SeanTroyMattJessClassics');
    expect(context.querySelectorAll('svg.lucide-arrow-right')).toHaveLength(4);
    expect([...cards[0].querySelectorAll('.position')].map(node => node.textContent)).toEqual(['#1','#2','#3']);
    expect([...cards[0].querySelectorAll('.film-list a')].map(node => node.getAttribute('href'))).toEqual(movies.slice(0,3).map(movie => `#/movie/${movie.id}`));
    await act(async () => { harness.root.render(createElement(SessionCard,{variant:'home',session:data.sessions[0],members:data.members})); });
    expect(harness.container.querySelector('h3')?.textContent).toBe("Member 2's turn");
    expect(harness.container.querySelector('.position')?.textContent).toBe('#1');
    expect(harness.container.querySelector('.eyebrow')?.textContent).toBe('Cycle started 30 August 2026');
    await mountHistory({...data,sessions:[{...data.sessions[0],kind:'classics',host_member_id:null}]});
    expect(harness.container.querySelector('.session-card h3')?.textContent).toBe('Classics week');
    await mountHistory({...data,cycles:[],sessions:[{...data.sessions[0],cycle_id:null}]});
    expect(harness.container.textContent).toContain('Ungrouped events'); expect(harness.container.querySelector('.history-pagination')).toBeNull();
  });
});

it('Home shows only the top two eligible rankable Classics with summary scores',async()=>{
  const scores=[{provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:null,fetched_at:'2026-01-01'},{provider:'rottentomatoes',metric:'audience',raw_value:90,raw_scale:100,normalized_value:90,vote_count:null,fetched_at:'2026-01-01'},{provider:'rottentomatoes',metric:'critic',raw_value:85,raw_scale:100,normalized_value:85,vote_count:null,fetched_at:'2026-01-01'}];
  const pool=movies.slice(0,5).map((m,i)=>({...m,classic:true,scores:i===3?[]:scores,seen:[{member_id:'member-2',seen:i===4?1:0,updated_at:'2026-01-01'}],ranking:rankMovie(i===3?[]:scores,[{member_id:'member-2',seen:i===4?1:0,updated_at:'2026-01-01'}],catalog.members)}));
  await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);
  vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:pool,sessions:[{id:'last',event_date:'2026-01-01',date_precision:'exact',host_member_id:'member-2',kind:'hosted',cycle_id:null,cycle_slot:2,legacy_cycle_label:null,movies:pool.slice(0,2)}]});
  window.location.hash='/home';await act(async()=>harness.root.render(createElement(App)));await flush();
  expect([...harness.container.querySelectorAll('.section-title h2')].map(e=>e.textContent)).toEqual(['Last turn','Next Classics','Classics Snapshot','Quick Facts']);
  const home=harness.container.querySelector('.home-dashboard')!;
  expect([...home.children].map(e=>e.className)).toEqual(['turn-card-area turn-card-area-personal','dashboard-grid','stack','stack home-quick-facts']);
  const snapshot=home.children[2];
  expect(snapshot.querySelector('.stat-link svg')).toBeNull();
  expect([...home.querySelectorAll('.home-quick-facts .stat strong')].map(e=>e.textContent)).toEqual(['1','2','8.00']);
  expect(snapshot.querySelector('.section-title a')?.getAttribute('href')).toBe('#/classics');
  expect([...snapshot.querySelectorAll('.stat strong')].map(e=>e.textContent)).toEqual(['3','1','0']);
  expect([...snapshot.querySelectorAll('.stat > span')].map(e=>e.textContent)).toEqual(['Eligible Classics','Already seen by all','Missing answers']);
  expect(snapshot.querySelector('.stat-link')?.getAttribute('href')).toBe('#/seen');
  const cards=harness.container.querySelectorAll('.home-rank-card');expect(cards).toHaveLength(2);
  const top=sortClassics(pool).filter(m=>m.ranking?.eligible&&m.ranking.rankable).slice(0,2);
  expect([...cards].map(e=>e.querySelector('a')?.getAttribute('href'))).toEqual(top.map(m=>'#/movie/'+m.id));
  expect([...cards].map(e=>e.querySelector('.rank-number')?.textContent)).toEqual(['#1','#2']);
  for(const card of cards){expect(card.textContent).toContain('0 Seen · 1 No');expect([...card.querySelectorAll('.ranking-source-scores > span')].map(node=>node.textContent)).toEqual(['IMDb 80','RT-A 90','RT-C 85']);expect(card.textContent).not.toMatch(/Ranked|Unknown|residual score|Score breakdown/);expect(card.querySelector('details,.score,.badge')).toBeNull();}
  expect(harness.container.querySelector('.home-session-card .eyebrow')?.textContent).toBe('1 January 2026');
  await navigate('classics');expect(harness.container.querySelector('.ranking-row .score, .ranking-row details')).toBeNull();expect(harness.container.querySelector('.ranking-row')?.textContent).toContain('IMDb 80');
});

it('History hides other-host edits and member admin actions without fetching audits',async()=>{
 const own={id:'own',event_date:'2026-01-01',date_precision:'exact' as const,host_member_id:'member-2',kind:'hosted' as const,cycle_id:null,cycle_slot:2,legacy_cycle_label:null,has_audit:true,movies:[{...movies[0],director:'A Director'},movies[1]]};
 const data={...catalog,sessions:[own,{...own,id:'other',host_member_id:'former'},{...own,id:'classics',kind:'classics' as const,host_member_id:null}]};
 const render=async(role:'admin'|'member',hasAudit=true)=>act(async()=>harness.root.render(createElement(HistoryScreen,{catalog:{...data,sessions:data.sessions.map(s=>({...s,has_audit:hasAudit}))},viewer:{id:'member-2',display_name:'Member 2',sort_order:2,avatar:2,role},onChanged:vi.fn()})));
 await render('member');const cards=harness.container.querySelectorAll('.session-card');
 expect(cards[0].querySelector('[aria-label="Edit event"]')).toBeTruthy();expect(cards[1].querySelector('[aria-label="Edit event"]')).toBeNull();expect(cards[2].querySelector('[aria-label="Edit event"]')).toBeNull();expect(harness.container.querySelector('[aria-label="Audit event"],[aria-label="Delete event"]')).toBeNull();
 expect(cards[0].querySelector('.history-event-actions')?.lastElementChild?.className).toBe('history-event-identity');expect(cards[0].querySelector('.session-meta')).toBeNull();expect(cards[0].querySelectorAll('.history-film-director')).toHaveLength(1);expect(cards[0].querySelector('.history-film-director')?.textContent).toBe('A Director');
 await render('admin',false);expect(harness.container.querySelectorAll('[aria-label="Edit event"]')).toHaveLength(3);expect(harness.container.querySelectorAll('[aria-label="Delete event"]')).toHaveLength(3);expect(harness.container.querySelector('[aria-label="Audit event"]')).toBeNull();expect(api.audit).not.toHaveBeenCalled();
});

const historyFixture = (): Catalog => ({...catalog,movies:[{...movies[0],au_classification:'MA15+'},movies[1]],cycles:Array.from({length:12},(_,i)=>({id:`c${12-i}`,ordinal:12-i,title:null,rough_date:'2026-01-01',import_source:null,import_key:null,created_at:'',updated_at:''})),sessions:Array.from({length:12},(_,i)=>[1,2].map(slot=>({id:`e${12-i}-${slot}`,cycle_id:`c${12-i}`,cycle_slot:slot,event_date:'2026-01-01',date_precision:'exact' as const,host_member_id:'member-2',kind:'hosted' as const,legacy_cycle_label:null,movies:[{...movies[0],au_classification:'MA15+'},movies[1]]}))).flat()});

it('History preserves stored film order while reversing cycles, events, jump and pagination and keeps sort only within History detail context',async()=>{
 await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);vi.mocked(api.catalog).mockResolvedValue(historyFixture());window.location.hash='/history';await act(async()=>harness.root.render(createElement(App)));await flush();
 const cycles=()=>[...harness.container.querySelectorAll('section[id^="cycle-"]')].map(e=>e.id);
 expect(cycles()).toEqual(['cycle-c12','cycle-c11','cycle-c10','cycle-c9','cycle-c8']);
 const filmOrder=(cycle:string)=>[...harness.container.querySelectorAll(`#${cycle} .history-event`)].map(event=>[...event.querySelectorAll('.film-list .movie-link')].map(link=>[link.querySelector('.position')?.textContent,link.querySelector('.movie-title')?.textContent]));
 const storedFilms=[[['#1','Film 0'],['#2','Film 1']],[['#1','Film 0'],['#2','Film 1']]];expect(filmOrder('cycle-c12')).toEqual(storedFilms);
 expect(harness.container.querySelector('#cycle-c12 .session-card [href^="#/event/"]')?.getAttribute('href')).toBe('#/event/e12-1');
 const metas=harness.container.querySelectorAll('.history-event .film-list .movie-copy > .meta:first-of-type');expect(metas[0].textContent).toBe('1998 · 100 min · MA15+');expect(metas[1].textContent).toBe('1998 · 100 min');
 await click(button('Re-sort'));expect(cycles()).toEqual(['cycle-c1','cycle-c2','cycle-c3','cycle-c4','cycle-c5']);
 expect(filmOrder('cycle-c1')).toEqual(storedFilms);
 expect(harness.container.querySelectorAll('#cycle-c1 .film-list .movie-title')[0].textContent).toBe('Film 0');
 expect(harness.container.querySelectorAll('#cycle-c1 .session-card [href^="#/event/"]')[0].getAttribute('href')).toBe('#/event/e1-2');
 const jump=harness.container.querySelector('.archive-tools select') as unknown as HTMLSelectElement;
 expect([...jump.options].slice(1).map(o=>o.value)).toEqual(Array.from({length:12},(_,i)=>`c${i+1}`));
 await act(async()=>{jump.value='c11';jump.dispatchEvent(new Event('change',{bubbles:true}));});expect(cycles()).toEqual(['cycle-c11','cycle-c12']);expect(filmOrder('cycle-c12')).toEqual(storedFilms);
 await click(button('Previous'));expect(cycles()).toEqual(['cycle-c6','cycle-c7','cycle-c8','cycle-c9','cycle-c10']);
 const host=harness.container.querySelectorAll('.archive-tools select')[1] as unknown as HTMLSelectElement;await act(async()=>{host.value='member-2';host.dispatchEvent(new Event('change',{bubbles:true}));});expect(cycles()[0]).toBe('cycle-c1');
 await click(harness.container.querySelector<HTMLAnchorElement>('.film-list .movie-link')!);await navigate('history');expect(cycles()[0]).toBe('cycle-c1');
 await navigate('home');await navigate('history');expect(cycles()[0]).toBe('cycle-c12');
 await click(button('Re-sort'));await click(button('Re-sort'));expect(cycles()[0]).toBe('cycle-c12');
 await click(button('Re-sort'));await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);await act(async()=>harness.root.render(createElement(App)));await flush();expect(cycles()[0]).toBe('cycle-c12');
});
