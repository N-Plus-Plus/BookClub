// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SeenScreen } from '../frontend/SeenScreen';
import { useSeenAnswers } from '../frontend/seen-answers';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import type { Catalog, Movie, MovieDetail } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{detail:vi.fn()}}));
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
let beginRead:ReturnType<typeof useSeenAnswers>['beginCatalogRead'];
function Harness(){
 const [data,setData]=useState<Catalog | null>(catalog); observed = data!;
 const saves=useSeenAnswers('m',setData,answer);
 refreshCatalog=next=>setData(saves.reconcileCatalog(next)); beginRead=saves.beginCatalogRead;
 return createElement(SeenScreen,{catalog:data!,viewerId:'m',writesEnabled:true,answer:saves.answer,pending:saves.pending,failures:saves.failures,retry:saves.retry});
}

beforeEach(()=>{vi.clearAllMocks();answer.mockReset();answer.mockImplementation(async(id,memberId,value)=>({...detail(id),seen:value===null?[]:[{member_id:memberId,seen:Number(value),updated_at:'saved'}]}));preloads=[];vi.stubGlobal('Image',class { constructor(){const image=document.createElement('img');preloads.push(image);return image;} });Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.mocked(api.detail).mockImplementation(async id=>detail(id));container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const mount=async()=>act(async()=>root.render(createElement(Harness)));
const click=async(label:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
it('uses catalogue metadata, preloads the next three posters, refills and retains images through Yes, No and Undo',async()=>{
 await mount();expect(api.detail).not.toHaveBeenCalled();
 expect(sources()).toEqual([1,2,3].map(i=>`https://image.tmdb.org/t/p/w342/f${i}.jpg`));
 expect(container.querySelector('.answer-card')?.textContent).toContain('Catalogue Director 0');
 await click('Yes, seen it');expect(container.querySelector('.answer-card')?.textContent).toContain('Catalogue Director 1');
 expect(sources()).toHaveLength(4);expect(sources().at(-1)).toContain('/f4.jpg');
 await click('Undo last answer');expect(container.querySelector('.answer-card')?.textContent).toContain('Film 00');
 expect(sources()).toHaveLength(4);
 await click('No, not yet');expect(sources()).toHaveLength(4);expect(api.detail).not.toHaveBeenCalled();
 expect(answer.mock.calls).toEqual([['f0','m',true],['f0','m',null],['f0','m',false]]);
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
it('orders answer, correction, Undo and a new answer without stale responses overwriting local intent',async()=>{
 const requests:((movie:MovieDetail)=>void)[]=[];
 answer.mockImplementation(()=>new Promise<MovieDetail>(resolve=>requests.push(resolve)));
 await mount();await click('Yes, seen it');await click('Change to No');await click('Undo last answer');await click('No, not yet');
 expect(answer).toHaveBeenCalledTimes(1);expect(observed.movies[0].seen[0].seen).toBe(0);
 for(const value of [true,false,null,false]) {
   const index=requests.length-1;
   await act(async()=>requests[index]({...detail('f0'),seen:value===null?[]:[{member_id:'m',seen:Number(value),updated_at:'saved'}]}));
   expect(observed.movies[0].seen[0].seen).toBe(0);
 }
 expect(answer.mock.calls).toEqual([['f0','m',true],['f0','m',false],['f0','m',null],['f0','m',false]]);
 expect(container.querySelector('.answer-card')?.textContent).toContain('Film 01');expect(container.querySelectorAll('.recent-answer')).toHaveLength(1);
});
it('paginates recent-first session activity only above 20 and handles new answers and Undo',async()=>{
 await mount();for(let i=0;i<20;i++)await click('Yes, seen it');
 expect(container.querySelectorAll('.recent-answer')).toHaveLength(20);expect(container.querySelector('.recent-pagination')).toBeNull();
 await click('No, not yet');expect(container.querySelectorAll('.recent-answer')).toHaveLength(20);expect(container.querySelector('.recent-list strong')?.textContent).toBe('Film 20');
 const controls=container.querySelector('.recent-pagination')!;expect(controls.parentElement?.lastElementChild).toBe(controls);
 await click('Next');expect(container.querySelectorAll('.recent-answer')).toHaveLength(1);expect(container.querySelector('.recent-list strong')?.textContent).toBe('Film 00');
 await click('Yes, seen it');expect(container.textContent).toContain('Page 1 of 2');expect(container.querySelector('.recent-list strong')?.textContent).toBe('Film 21');
 await click('Next');await click('Undo last answer');await click('Undo last answer');expect(container.querySelector('.recent-pagination')).toBeNull();expect(container.querySelectorAll('.recent-answer')).toHaveLength(20);
 expect(answer).toHaveBeenLastCalledWith('f20','m',null);
});
it('shows only Films brought contribution bars with alternating palette classes',()=>{
 container.innerHTML=renderToStaticMarkup(createElement(MetricsScreen,{catalog:{...catalog,members:[member,{...member,id:'m2',display_name:'Other',sort_order:2}]},viewer:null,onUpdated:async()=>{}}));
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

it('overlays saving, queued, corrected and failed latest Seen intentions onto fresh catalogue and History references',async()=>{
 const requests:{resolve:(movie:MovieDetail)=>void;reject:(error:Error)=>void}[]=[];
 answer.mockImplementation(()=>new Promise<MovieDetail>((resolve,reject)=>requests.push({resolve,reject})));
 await mount();await click('Yes, seen it');await click('No, not yet');
 const fresh={...catalog,movies:films.map(f=>({...f,title:'Fresh '+f.title})),sessions:[{id:'event',movies:[films[0],films[1]],event_date:'2000-01-01',host_member_id:null,kind:'classics' as const,date_precision:'exact' as const,cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]};
 await act(async()=>refreshCatalog(fresh));
 expect(observed.movies[0].seen[0].seen).toBe(1);expect(observed.movies[1].seen[0].seen).toBe(0);
 expect(observed.sessions[0].movies[0]).toBe(observed.movies[0]);expect(observed.movies[0].title).toBe('Fresh Film 00');
 await act(async()=>requests[0].reject(new Error('Failed')));
 await act(async()=>refreshCatalog(fresh));
 expect(observed.movies[0].seen[0].seen).toBe(1);expect(observed.movies[1].seen[0].seen).toBe(0);expect(answer).toHaveBeenCalledTimes(2);
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
