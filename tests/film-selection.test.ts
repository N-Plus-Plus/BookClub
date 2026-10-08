// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { Catalog, Movie, MovieDetail, Session } from '../shared/types';
import { rankMovie, missingAnswers } from '../shared/ranking';
import { AddClassicModal } from '../frontend/AddClassicModal';
import { ClassicsScreen } from '../frontend/ClassicsScreen';
import { catalogIndex } from '../shared/catalog-index';
import { EventScreen } from '../frontend/EventScreen';
import { BuilderScreen } from '../frontend/BuilderScreen';
import { FilmPicker } from '../frontend/FilmPicker';
import { api } from '../frontend/api';
vi.mock('../frontend/api',() => ({api:{search:vi.fn(),detail:vi.fn(),preview:vi.fn(),importMovie:vi.fn(),classic:vi.fn(),builders:vi.fn()}}));
const members = [{id:'member',display_name:'Member',sort_order:1,active:1}];
const film = (id: string, extra: Partial<MovieDetail> = {}): MovieDetail => ({id,title:`Film ${id}`,original_title:null,year:2001,runtime:111,director:`Director ${id}`,overview:`Plot ${id}`,release_date:null,genres:[],assets:[],external_ids:[],scores:[],seen:[],classic:false,ranking:null,appearances:[],...extra});
let root: Root, container: HTMLDivElement;
const click = async (element: HTMLElement) => { expect(element).toBeTruthy(); await act(async()=>element.click()); };
const button = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === name)!;
const search = async (id: string) => {
  vi.mocked(api.search).mockResolvedValue({local:[{id,title:`Film ${id}`,year:2001,tmdbId:null,poster:null}],external:[],lookup:{available:true,message:null}});
  const input = container.querySelector<HTMLInputElement>('input[maxlength="150"]')!;
  await act(async()=>{ Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,id); input.dispatchEvent(new Event('input',{bubbles:true})); });
  await act(async()=>input.closest('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
};
const select = async (id: string) => {
  await search(id);
  await click(container.querySelector<HTMLElement>(`button[aria-label="Select Film ${id}"]`)!);
  expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('');
  expect(container.querySelector('.search-row')).toBeNull();
  expect(document.activeElement).toBe(container.querySelector('input[maxlength="150"]'));
  expect(container.querySelector('[aria-activedescendant]')).toBeNull();
};
beforeEach(()=>{
  vi.resetAllMocks(); Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container);
  vi.mocked(api.detail).mockImplementation(async id=>film(id));
  vi.mocked(api.builders).mockResolvedValue([]);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
async function open(movies: Movie[] = []) {
  function Screen() {
    const [list,setList] = useState(movies);
    const [adding,setAdding] = useState(false);
    const catalog: Catalog = {movies:list,members,sessions:[],cycles:[]};
    return createElement('div',{},createElement('button',{onClick:()=>setAdding(true)},'Add Classic'),adding ? createElement(AddClassicModal,{catalog,onMovie:m=>setList(current=>[...current.filter(f=>f.id!==m.id),m]),onClose:()=>setAdding(false)}) : null,createElement(ClassicsScreen,{catalog,movies:list.filter(m=>m.classic),viewer:{id:'member',display_name:'Member',sort_order:1,avatar:1,role:'member'},writesEnabled:true,onMovie:m=>setList(current=>[...current.filter(f=>f.id!==m.id),m])}));
  }
  await act(async()=>root.render(createElement(Screen)));
  await click(button('Add Classic'));
}
it('replaces identity, overview and eligibility; commits once and immediately shows the new unranked Classic',async()=>{
  vi.mocked(api.detail).mockImplementation(async id=>film(id,{classic:id==='A'}));
  await open([film('A',{classic:true,ranking:rankMovie([],[],members)})]);
  await select('A');
  expect(container.querySelector('[aria-label="Selected film"]')?.textContent).toContain('Already listed!');
  expect(container.querySelector('[aria-label="Selected film"] button')).toBeNull();
  await select('B');
  const selected = container.querySelector('[aria-label="Selected film"]')!;
  for (const text of ['Film B','2001','111 min','Director B','Plot B']) expect(selected.textContent).toContain(text);
  expect(selected.textContent).not.toMatch(/Film A|Plot A|Already listed!/);
  expect(api.classic).not.toHaveBeenCalled();
  const saved=film('B',{classic:true,ranking:rankMovie([],[],members)});
  vi.mocked(api.classic).mockResolvedValue(saved);
  const add=selected.querySelector<HTMLButtonElement>('button')!;
  await act(async()=>{add.click();add.click();});
  expect(api.classic).toHaveBeenCalledExactlyOnceWith('B',true);
  expect(container.querySelector('dialog')).toBeNull();
  await click([...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.getAttribute('aria-label')?.startsWith('Unranked:'))!);
  expect(container.querySelector('.ranking-list')?.textContent).toContain('Film B');
  expect(missingAnswers([saved],members,'member')).toHaveLength(1);
  expect(saved.seen).toEqual([]); expect(saved.scores).toEqual([]); expect(saved.ranking?.rankable).toBe(false);
});
it.each(['history','all-seen'])('blocks %s and replaces that status with an eligible selection',async reason=>{
  vi.mocked(api.detail).mockImplementation(async id=>film(id,id==='A' ? reason==='history' ? {appearances:[{id:'event',event_date:'2000-01-01',date_precision:'exact',kind:'hosted',host_member_id:'member',position:1}]} : {seen:[{member_id:'member',seen:1,updated_at:''}]} : {}));
  await open(); await select('A');
  expect(container.querySelector('[aria-label="Selected film"]')?.textContent).toContain("We've seen it!");
  expect(container.querySelector('[aria-label="Selected film"] button')).toBeNull();
  await select('B'); expect(container.querySelector('[aria-label="Selected film"]')?.textContent).not.toContain("We've seen it!");
  expect(container.querySelector('[aria-label="Selected film"] button')?.textContent).toBe('Add Classic');
});
it('previews without import, then reuses the canonical import result; preserves selection on failure',async()=>{
  await open();
  vi.mocked(api.search).mockResolvedValue({local:[],external:[{provider:'tmdb',externalId:'42',title:'External',year:null,poster:null}],lookup:{available:true,message:null}});
  vi.mocked(api.preview).mockResolvedValue({provider:'tmdb',externalId:'42',title:'External',original_title:null,year:null,runtime:null,director:null,overview:null,release_date:null,genres:[],assets:[]});
  await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await click(container.querySelector<HTMLElement>('button[aria-label="Select External"]')!);
  expect(api.importMovie).not.toHaveBeenCalled();
  expect(container.querySelector('[aria-label="Selected film"]')?.textContent).toContain('Year unknown · Runtime unknownDirector: Unknown');
  expect(container.querySelector('.detail-overview')).toBeNull();
  vi.mocked(api.importMovie).mockResolvedValue(film('canonical'));
  vi.mocked(api.classic).mockRejectedValueOnce(new Error('Try later.'));
  await click(container.querySelector<HTMLElement>('[aria-label="Selected film"] button')!);
  expect(container.querySelector('dialog')).not.toBeNull(); expect(container.textContent).toContain('Try later.');
  expect(api.classic).toHaveBeenCalledWith('canonical',true);
  vi.mocked(api.importMovie).mockResolvedValue(film('canonical',{classic:true}));
  await click(container.querySelector<HTMLElement>('[aria-label="Selected film"] button')!);
  expect(container.querySelector('[aria-label="Selected film"]')?.textContent).toContain('Already listed!');
  expect(api.classic).toHaveBeenCalledTimes(1);
});
it('keeps Builder direct additions, ordering, repeated appearances, removal and navigation links',async()=>{
  function Picker() { const [selected,setSelected]=useState<Movie[]>([]); return createElement(FilmPicker,{selected,onSelected:setSelected,onMovie:vi.fn(),historyMovieIds:new Set(['A'])}); }
  await act(async()=>root.render(createElement(Picker)));
  for (const id of ['A','B','A']) {
    await search(id); expect(container.querySelector('.search-row .badge')?.textContent ?? null).toBe(id==='A'?'Seen it':null); await click(container.querySelector<HTMLElement>(`button[aria-label="Add Film ${id}"]`)!);
    expect(container.querySelector('.search-row')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('');
  }
  expect([...container.querySelectorAll('.lineup-list .movie-title')].map(e=>e.textContent)).toEqual(['Film A','Film B','Film A']);
  expect(container.querySelector('.lineup-list a')?.getAttribute('href')).toBe('#/movie/A');
  expect(container.querySelector('.lineup-list')?.textContent).toContain('Director A');
  await click(container.querySelector<HTMLElement>('button[aria-label="Move Film B earlier"]')!);
  expect([...container.querySelectorAll('.lineup-list .movie-title')].map(e=>e.textContent)).toEqual(['Film B','Film A','Film A']);
  await click(container.querySelector<HTMLElement>('button[aria-label="Remove Film B"]')!);
  expect(container.querySelectorAll('.lineup-list li')).toHaveLength(2);
});
it('shared search displays only known director metadata without dangling separators',async()=>{
  await act(async()=>root.render(createElement(FilmPicker,{movies:[film('A'),film('B',{director:null}),film('C',{director:'Unknown'})],selected:[],onSelected:vi.fn(),onMovie:vi.fn()})));
  for (const [id,metadata] of [['A','Director A'],['B',null],['C',null]] as const) {
    await search(id); expect(container.querySelector('.search-row .film-director')?.textContent ?? null).toBe(metadata);
    expect(container.querySelector('.search-row .meta')?.textContent).toBe('2001 · 111 min');
  }
});

const historySession=(movie:Movie,deleted=false):Session=>({id:'event',event_date:'2001-01-01',date_precision:'exact',kind:'hosted',host_member_id:'member',cycle_id:null,cycle_slot:null,legacy_cycle_label:null,movies:[movie],deleted_at:deleted?'2002-01-01':null});
it('labels only canonical saved active-History results and reflects replaced catalogue evidence',async()=>{
 const watched=film('A'),unwatched=film('B',{seen:[{member_id:'member',seen:1,updated_at:''}]}),deleted=film('C');
 let catalog:Catalog={movies:[watched,unwatched,deleted],members,sessions:[historySession(watched),{...historySession(deleted,true),id:'deleted'}],cycles:[]};
 const render=()=>act(async()=>root.render(createElement(FilmPicker,{selected:[],onSelected:vi.fn(),onMovie:vi.fn(),historyMovieIds:catalogIndex(catalog).historyMovieIds})));
 await render();
 vi.mocked(api.search).mockResolvedValue({local:catalog.movies.map(movie=>({id:movie.id,title:movie.title,year:movie.year,tmdbId:null,poster:null})),external:[{provider:'tmdb',externalId:'A',title:'External A',year:2001,poster:null}],lookup:{available:true,message:null}});
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const rows=[...container.querySelectorAll('.search-row')];
 expect(rows).toHaveLength(4);expect(rows[0].querySelector('.badge')?.textContent).toBe('Seen it');
 for(const row of rows.slice(1)) expect(row.querySelector('.badge')).toBeNull();
 expect(container.textContent).not.toMatch(/Not Seen|Unseen/);expect(api.preview).not.toHaveBeenCalled();
 catalog={...catalog,sessions:[historySession(unwatched)]};await render();
 expect(rows[0].querySelector('.badge')).toBeNull();expect(rows[1].querySelector('.badge')?.textContent).toBe('Seen it');
 expect(api.search).toHaveBeenCalledOnce();
});
it.each(['builder','event','classics-event','add-classic'])('passes active History context through %s search',async consumer=>{
 const movie=film('A');const catalog:Catalog={movies:[movie],members,sessions:[historySession(movie)],cycles:[]};
 if(consumer==='builder') {
  await act(async()=>root.render(createElement(BuilderScreen,{catalog,viewer:{id:'member',display_name:'Member',sort_order:1,avatar:1,role:'member'},rotation:null,onMovie:vi.fn(),onPublished:vi.fn()})));
  await act(async()=>root.render(createElement(BuilderScreen,{catalog,viewer:{id:'member',display_name:'Member',sort_order:1,avatar:1,role:'member'},rotation:null,onMovie:vi.fn(),onPublished:vi.fn(),newSetRequest:1})));
 } else if(consumer==='add-classic') {
  await act(async()=>root.render(createElement(AddClassicModal,{catalog,onMovie:vi.fn(),onClose:vi.fn()})));
 } else {
  await act(async()=>root.render(createElement(EventScreen,{catalog,viewer:null,rotation:consumer==='classics-event'?{id:1,nominal_slot:5,cycle_id:null,version:1,updated_at:''}:null,writesEnabled:true,onMovie:vi.fn(),onSaved:vi.fn()})));
 }
 await search('A');expect(container.querySelector('.search-row .badge')?.textContent).toBe('Seen it');
 expect(api.preview).not.toHaveBeenCalled();expect(api.importMovie).not.toHaveBeenCalled();
});
