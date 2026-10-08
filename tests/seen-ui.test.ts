// @vitest-environment jsdom
import { applicationCss } from './helpers/application-css';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';


import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { rankMovie } from '../shared/ranking';
import { SeenScreen } from '../frontend/SeenScreen';
import { useSeenAnswers } from '../frontend/seen-answers';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import type { Catalog, Movie, MovieDetail } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{detail:vi.fn(),metricsEnrichment:vi.fn().mockResolvedValue({movies:{}})}}));
const member={id:'m',display_name:'Member',active:1,sort_order:1,avatar:1};
const films:Movie[]=Array.from({length:25},(_,i)=>({id:'f'+i,title:'Film '+String(i).padStart(2,'0'),year:2001,runtime:100,director:'Catalogue Director '+i,original_title:null,release_date:null,overview:null,genres:[],assets:[{provider:'tmdb',asset_type:'poster',reference:'https://image.tmdb.org/t/p/w500/f'+i+'.jpg',width:null,height:null,preferred:1}],external_ids:[],classic:true,scores:[],seen:[],ranking:null}));
const catalog:Catalog={members:[member],movies:films,cycles:[],sessions:[]};
const detail=(id:string):MovieDetail=>({...films.find(m=>m.id===id)!,appearances:[]});
let container:HTMLDivElement,root:Root;
const answer=vi.fn();
let preloads:HTMLImageElement[];
const sources=()=>preloads.map(image=>image.src);
let observed: Catalog;
let refreshCatalog:(next:Catalog)=>void;
let writeAnswer:ReturnType<typeof useSeenAnswers>['answer'];
let beginRead:ReturnType<typeof useSeenAnswers>['beginCatalogRead'];
function Harness(){
 const [data,setData]=useState<Catalog | null>(catalog); observed = data!;
 const saves=useSeenAnswers('m',setData,answer);
 writeAnswer=saves.answer;
 refreshCatalog=next=>setData(saves.reconcileCatalog(next)); beginRead=saves.beginCatalogRead;
 return createElement(SeenScreen,{catalog:data!,viewerId:'m',writesEnabled:true,answer:saves.answer,pending:saves.pending,failures:saves.failures,retry:saves.retry});
}

beforeEach(()=>{vi.clearAllMocks();answer.mockReset();answer.mockImplementation(async(id,memberId,value)=>({...detail(id),seen:value===null?[]:[{member_id:memberId,seen:Number(value),updated_at:'saved'}]}));preloads=[];vi.stubGlobal('Image',class { constructor(){const image=document.createElement('img');preloads.push(image);return image;} });Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.mocked(api.detail).mockImplementation(async id=>detail(id));container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const mount=async()=>act(async()=>root.render(createElement(Harness)));
const click=async(label:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
it('uses catalogue metadata, preloads the next three posters, refills and retains images through Yes, No and corrections',async()=>{
 await mount();expect(api.detail).not.toHaveBeenCalled();
 expect(sources()).toEqual([1,2,3].map(i=>`https://image.tmdb.org/t/p/w342/f${i}.jpg`));
 expect(container.querySelector('.answer-card')?.textContent).toContain('Catalogue Director 0');
 await click('Yes, seen it');expect(container.querySelector('.answer-card')?.textContent).toContain('Catalogue Director 1');
 expect(sources()).toHaveLength(4);expect(sources().at(-1)).toContain('/f4.jpg');
 await click('Change to No');expect(sources()).toHaveLength(4);
 await click('No, not yet');expect(sources()).toHaveLength(5);expect(api.detail).not.toHaveBeenCalled();
 expect(answer.mock.calls).toEqual([['f0','m',true],['f0','m',false],['f1','m',false]]);
});
it('deduplicates shared URLs, skips missing posters and keeps normal fallback after preload failure',async()=>{
 const data={...catalog,movies:films.map((movie,i)=>i===2?{...movie,assets:films[1].assets}:i===3?{...movie,assets:[]}:movie)};
 await act(async()=>root.render(createElement(SeenScreen,{catalog:data!,viewerId:'m',writesEnabled:true,answer:vi.fn()})));
 expect(preloads).toHaveLength(1);preloads[0].dispatchEvent(new Event('error'));
 await act(async()=>root.render(createElement(SeenScreen,{catalog:{...data,movies:data.movies.slice(1)},viewerId:'m',writesEnabled:true,answer:vi.fn()})));
 expect(container.querySelector('.answer-card')?.textContent).toContain('Film 01');
 await act(async()=>container.querySelector('.answer-card img')!.dispatchEvent(new Event('error')));
 expect(container.querySelector('.answer-card .poster-empty')?.textContent).toContain('No poster');
 expect(sources().filter(source=>source.endsWith('/f1.jpg'))).toHaveLength(1);expect(api.detail).not.toHaveBeenCalled();
});
it('answers optimistically, serialises rapid taps, retains failed answers and offers an explicit retry',async()=>{
 const requests:{resolve:(movie:MovieDetail)=>void;reject:(error:Error)=>void}[]=[];
 answer.mockImplementation(()=>new Promise<MovieDetail>((resolve,reject)=>requests.push({resolve,reject})));
 await mount();await click('Yes, seen it');
 expect(container.querySelector('.answer-card')?.textContent).toContain('Film 01');expect(container.querySelector('.recent-answer')?.textContent).toContain('Film 00');
 await click('No, not yet');expect(container.querySelector('.answer-card')?.textContent).toContain('Film 02');expect(answer).toHaveBeenCalledTimes(1);
 expect(container.querySelector('button.seen-yes')?.hasAttribute('disabled')).toBe(false);
 await act(async()=>requests[0].reject(new Error('Save failed')));
 expect(answer).toHaveBeenCalledTimes(2);expect(container.querySelector('[role="alert"]')?.textContent).toContain('Film 00: Seen');
 expect(container.querySelector('.answer-card')?.textContent).toContain('Film 02');expect(container.querySelectorAll('.recent-answer')).toHaveLength(2);
 await act(async()=>requests[1].resolve({...detail('f1'),title:'Authoritative title',seen:[{member_id:'m',seen:0,updated_at:'saved'}]}));
 expect(observed.movies.find(m=>m.id==='f1')?.title).toBe('Authoritative title');
 await click('Retry saving Film 00');expect(answer).toHaveBeenLastCalledWith('f0','m',true);
 await act(async()=>requests[2].resolve({...detail('f0'),seen:[{member_id:'m',seen:1,updated_at:'saved'}]}));
 expect(container.querySelector('[role="alert"]')).toBeNull();expect(observed.movies[0].seen[0].updated_at).toBe('saved');expect(api.detail).not.toHaveBeenCalled();
});
it('orders answer, correction, application-layer null write and a new answer without stale responses overwriting local intent',async()=>{
 const requests:((movie:MovieDetail)=>void)[]=[];
 answer.mockImplementation(()=>new Promise<MovieDetail>(resolve=>requests.push(resolve)));
 await mount();await click('Yes, seen it');await click('Change to No');await act(async()=>writeAnswer('f0','m',null,'Film 00'));await click('No, not yet');
 expect(answer).toHaveBeenCalledTimes(1);expect(observed.movies[0].seen[0].seen).toBe(0);
 for(const value of [true,false,null,false]) {
   const index=requests.length-1;
   await act(async()=>requests[index]({...detail('f0'),seen:value===null?[]:[{member_id:'m',seen:Number(value),updated_at:'saved'}]}));
   expect(observed.movies[0].seen[0].seen).toBe(0);
 }
 expect(answer.mock.calls).toEqual([['f0','m',true],['f0','m',false],['f0','m',null],['f0','m',false]]);
 expect(container.querySelector('.answer-card')?.textContent).toContain('Film 01');expect(container.querySelectorAll('.recent-answer')).toHaveLength(1);
});
it('paginates five newest-first answers with Previous/Next and returns to page one for new answers',async()=>{
 await mount();for(let i=0;i<5;i++)await click('Yes, seen it');
 expect(container.querySelectorAll('.recent-answer')).toHaveLength(5);expect(container.querySelector('.recent-pagination')).toBeNull();
 await click('No, not yet');expect(container.querySelectorAll('.recent-answer')).toHaveLength(5);
 expect([...container.querySelectorAll('.recent-list strong')].map(e=>e.textContent)).toEqual(['Film 05','Film 04','Film 03','Film 02','Film 01']);
 const controls=container.querySelector('.recent-pagination')!;expect(controls.parentElement?.lastElementChild).toBe(controls);
 expect(container.textContent).toContain('Page 1 of 2');expect([...controls.querySelectorAll('button')].map(b=>b.disabled)).toEqual([true,false]);
 await click('Next');expect(container.querySelectorAll('.recent-answer')).toHaveLength(1);expect(container.querySelector('.recent-list strong')?.textContent).toBe('Film 00');
 expect(container.textContent).toContain('Page 2 of 2');expect([...controls.querySelectorAll('button')].map(b=>b.disabled)).toEqual([false,true]);
 await click('Change to No');expect(answer).toHaveBeenLastCalledWith('f0','m',false);expect(container.textContent).toContain('Page 2 of 2');
 await click('Previous');expect(container.querySelector('.recent-list strong')?.textContent).toBe('Film 05');
 await click('Next');await click('Yes, seen it');expect(container.textContent).toContain('Page 1 of 2');expect(container.querySelector('.recent-list strong')?.textContent).toBe('Film 06');
});
it('omits Undo and the transient pending-save label while answers are saving',async()=>{
 answer.mockImplementation(()=>new Promise(()=>{}));
 await mount();await click('Yes, seen it');
 expect(container.textContent).not.toContain('pending save');expect(container.querySelector('[role="status"]')).toBeNull();
 expect(container.textContent).not.toContain('Undo');expect(container.querySelector('.recent-answer')).not.toBeNull();
});
it('clamps the plot to three fixed lines and toggles More/Less outside the film link, preserving preference across films',async()=>{
 await mount();
 const overview='A long plot summary. '.repeat(60);
 await act(async()=>refreshCatalog({...catalog,movies:films.map(f=>({...f,overview}))}));
 const summary=()=>container.querySelector('.seen-plot-summary')!;
 expect(summary().textContent).toBe(overview);expect(summary().classList.contains('seen-plot-collapsed')).toBe(true);
 const css=applicationCss();
 const rules=css.match(/\.seen-plot-collapsed\s*\{([^}]+)\}/)![1];
 expect(rules).toMatch(/-webkit-line-clamp:\s*3/);expect(rules).toMatch(/height:\s*4\.8em/);expect(rules).toMatch(/overflow:\s*hidden/);
 const toggle=()=>container.querySelector<HTMLButtonElement>('.seen-plot-toggle')!;
 expect(toggle().closest('a')).toBeNull();expect(toggle().getAttribute('aria-expanded')).toBe('false');
 expect(toggle().getAttribute('aria-controls')).toBe(summary().id);
 expect(container.querySelector('.answer-card')!.compareDocumentPosition(summary()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(summary().compareDocumentPosition(container.querySelector('.answer-actions')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 await click('More');expect(toggle().getAttribute('aria-expanded')).toBe('true');expect(summary().classList.contains('seen-plot-collapsed')).toBe(false);
 await click('Yes, seen it');expect(container.querySelector('.answer-card')?.textContent).toContain('Film 01');expect(toggle().textContent).toBe('Less');
 await click('Less');expect(summary().classList.contains('seen-plot-collapsed')).toBe(true);
 await click('No, not yet');expect(toggle().textContent).toBe('More');expect(summary().classList.contains('seen-plot-collapsed')).toBe(true);
});
it('omits the summary block and disclosure when overview is absent',async()=>{
 await mount();expect(container.querySelector('.seen-plot')).toBeNull();expect(container.querySelector('.seen-plot-toggle')).toBeNull();
});
it('shows only Films brought contribution bars with alternating palette classes',async()=>{
 await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,members:[member,{...member,id:'m2',display_name:'Other',sort_order:2}]},viewer:null,onUpdated:async()=>{}})));
 await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent==='Breakdowns')!.click());
 expect([...container.querySelectorAll('figcaption')].map(e=>e.textContent)).toEqual(['Films brought']);
 expect([...container.querySelectorAll('.chart-track > span')].map(e=>e.className)).toEqual(['chart-bar-jeans','chart-bar-lavender','chart-bar-jeans']);
 expect(container.textContent).not.toContain('Film appearances');
});

it('retries only the latest failed intention after a correction supersedes an earlier failure',async()=>{
 const requests:{resolve:(movie:MovieDetail)=>void;reject:(error:Error)=>void}[]=[];
 answer.mockImplementation(()=>new Promise<MovieDetail>((resolve,reject)=>requests.push({resolve,reject})));
 await mount();await click('Yes, seen it');await click('Change to No');
 await act(async()=>requests[0].reject(new Error('Earlier save failed')));expect(answer).toHaveBeenLastCalledWith('f0','m',false);
 expect(container.querySelector('[role="alert"]')).toBeNull();
 await act(async()=>requests[1].reject(new Error('Correction failed')));expect(container.querySelector('[role="alert"]')?.textContent).toContain('Film 00: Not seen');
 await click('Retry saving Film 00');expect(answer.mock.calls).toEqual([['f0','m',true],['f0','m',false],['f0','m',false]]);
 await act(async()=>requests[2].resolve({...detail('f0'),seen:[{member_id:'m',seen:0,updated_at:'saved'}]}));expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('active History takes precedence over saving, queued and failed Seen intentions in fresh catalogue references',async()=>{
 const requests:{resolve:(movie:MovieDetail)=>void;reject:(error:Error)=>void}[]=[];
 answer.mockImplementation(()=>new Promise<MovieDetail>((resolve,reject)=>requests.push({resolve,reject})));
 await mount();await click('Yes, seen it');await click('No, not yet');
 const fresh={...catalog,movies:films.map(f=>({...f,title:'Fresh '+f.title})),sessions:[{id:'event',movies:[films[0],films[1]],event_date:'2000-01-01',host_member_id:null,kind:'classics' as const,date_precision:'exact' as const,cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]};
 await act(async()=>refreshCatalog(fresh));
 expect(observed.movies[0].seen[0].seen).toBe(1);expect(observed.movies[1].seen[0].seen).toBe(1);
 expect(observed.sessions[0].movies[0]).toBe(observed.movies[0]);expect(observed.movies[0].title).toBe('Fresh Film 00');
 await act(async()=>requests[0].reject(new Error('Failed')));
 await act(async()=>refreshCatalog(fresh));
 expect(observed.movies[0].seen[0].seen).toBe(1);expect(observed.movies[1].seen[0].seen).toBe(1);expect(answer).toHaveBeenCalledTimes(2);
 await act(async()=>requests[1].resolve({...detail('f1'),seen:[{member_id:'m',seen:0,updated_at:'saved'}]}));
});

it('retains intentions confirmed while an older catalogue snapshot is still in flight',async()=>{
 let resolve!:(movie:MovieDetail)=>void;answer.mockImplementation(()=>new Promise<MovieDetail>(done=>{resolve=done;}));
 await mount();const read=beginRead();await click('Yes, seen it');
 await act(async()=>resolve({...detail('f0'),seen:[{member_id:'m',seen:1,updated_at:'saved'}]}));
 const reconciled=read.apply(catalog);read.release();expect(reconciled.movies[0].seen[0].seen).toBe(1);
 // Completed intentions stop overlaying subsequent, genuinely newer reads.
 expect(beginRead().apply(catalog).movies[0].seen).toEqual([]);
});

it('places genuine scores immediately before plot and updates them as the queue advances',async()=>{
 await mount();
 const scored=films.slice(0,3).map((film,i)=>({...film,overview:'Plot '+i,ranking:rankMovie(i===2?[]:[{provider:'imdb',metric:'rating',raw_value:80+i,raw_scale:100,normalized_value:80+i,vote_count:null,fetched_at:''}],[],[member])}));
 await act(async()=>refreshCatalog({...catalog,movies:scored}));
 const row=()=>container.querySelector('.ranking-source-scores');
 expect(row()?.textContent).toBe('IMDb 81');expect(row()?.parentElement?.nextElementSibling?.className).toBe('seen-plot');
 await click('Yes, seen it');expect(row()?.textContent).toBe('IMDb 80');expect(row()?.parentElement?.nextElementSibling?.className).toBe('seen-plot');
 await click('No, not yet');expect(row()).toBeNull();expect(container.querySelector('.seen-plot')).toBeTruthy();
});
