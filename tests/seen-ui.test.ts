// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SeenScreen } from '../frontend/SeenScreen';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import type { Catalog, Movie, MovieDetail } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{detail:vi.fn()}}));
const member={id:'m',display_name:'Member',active:1,sort_order:1,avatar:1};
const films:Movie[]=Array.from({length:25},(_,i)=>({id:'f'+i,title:'Film '+String(i).padStart(2,'0'),year:2001,runtime:100,director:null,original_title:null,release_date:null,overview:null,genres:[],assets:[],external_ids:[],classic:true,scores:[],seen:[],ranking:null}));
const catalog:Catalog={members:[member],movies:films,cycles:[],sessions:[]};
const detail=(id:string):MovieDetail=>({...films.find(m=>m.id===id)!,director:'Loaded '+id,appearances:[]});
let container:HTMLDivElement,root:Root;
const answer=vi.fn();
function Harness(){
 const [data,setData]=useState(catalog);
 return createElement(SeenScreen,{catalog:data,viewerId:'m',writesEnabled:true,answer:async(id,memberId,value)=>{
   answer(id,memberId,value);const movie={...detail(id),seen:value===null?[]:[{member_id:memberId,seen:Number(value),updated_at:''}]};
   setData(current=>({...current,movies:current.movies.map(m=>m.id===id?movie:m)}));return movie;
 }});
}
beforeEach(()=>{vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.mocked(api.detail).mockImplementation(async id=>detail(id));container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const mount=async()=>act(async()=>root.render(createElement(Harness)));
const click=async(label:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
it('preloads only the current and next three, refills in order, and keeps cached future items on Undo',async()=>{
 await mount();expect(vi.mocked(api.detail).mock.calls.map(c=>c[0])).toEqual(['f0','f1','f2','f3']);
 expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f0');expect(container.querySelector('.answer-card')?.textContent).not.toContain('Loaded f1');
 await click('Yes, seen it');expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f1');expect(api.detail).toHaveBeenLastCalledWith('f4');
 await click('Undo last answer');expect(container.querySelector('.answer-card')?.textContent).toContain('Film 00');expect(api.detail).toHaveBeenCalledTimes(5);
 await click('No, not yet');expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f1');expect(api.detail).toHaveBeenCalledTimes(5);
});
it('shares in-flight requests and retries failed prefetch when the film becomes current',async()=>{
 let release!:(m:MovieDetail)=>void;
 vi.mocked(api.detail).mockImplementation(id=>id==='f1'?new Promise(resolve=>{release=resolve;}):id==='f2'?Promise.reject(new Error('Unavailable')):Promise.resolve(detail(id)));
 await mount();await click('Yes, seen it');expect(vi.mocked(api.detail).mock.calls.filter(c=>c[0]==='f1')).toHaveLength(1);
 await act(async()=>release(detail('f1')));expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f1');
 vi.mocked(api.detail).mockImplementation(async id=>detail(id));await click('Yes, seen it');expect(vi.mocked(api.detail).mock.calls.filter(c=>c[0]==='f2')).toHaveLength(2);expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f2');
});
it('advances to cached details while saving and restores the unanswered film on failure',async()=>{
 let reject!:(e:Error)=>void;
 const save=vi.fn(()=>new Promise<MovieDetail>((_resolve,fail)=>{reject=fail;}));
 await act(async()=>root.render(createElement(SeenScreen,{catalog,viewerId:'m',writesEnabled:true,answer:save})));
 await click('Yes, seen it');expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f1');
 expect(container.querySelector('.recent-answer')).toBeNull();
 await act(async()=>reject(new Error('Save failed')));expect(container.querySelector('.answer-card')?.textContent).toContain('Loaded f0');expect(container.querySelector('[role="alert"]')?.textContent).toBe('Save failed');
 expect(vi.mocked(api.detail).mock.calls.filter(c=>c[0]==='f1')).toHaveLength(1);
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
