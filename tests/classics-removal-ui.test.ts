// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ClassicsScreen } from '../frontend/ClassicsScreen';
import { api } from '../frontend/api';
import { rankMovie } from '../shared/ranking';
import type { Movie, MovieDetail } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{removeClassic:vi.fn()}}));
const members=[1,2,3,4].map(i=>({id:`m${i}`,display_name:`Member ${i}`,sort_order:i,active:1}));
const film=(state:string):Movie=>{
 const seen=state==='Seen'?members.map(m=>({member_id:m.id,seen:1,updated_at:''})):members.slice(0,3).map(m=>({member_id:m.id,seen:0,updated_at:''}));
 if(state==='Ranked')seen.push({member_id:'m4',seen:0,updated_at:''});
 const scores=[{provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:null,fetched_at:''}];
 return {id:state,title:`Film ${state}`,year:2001,original_title:null,release_date:null,runtime:100,director:null,overview:null,genres:[],assets:[],external_ids:[],scores,seen,classic:true,ranking:rankMovie(scores,seen,members)};
};
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const click=async(name:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name||b.getAttribute('aria-label')?.startsWith(name+':'))!.click();});
it.each(['Ranked','Unranked','Seen'])('admin confirms correct film and counts in %s; cancellation is inert and success removes candidate',async state=>{
 const movie=film(state);
 function Screen(){const [movies,setMovies]=useState([movie]);return createElement(ClassicsScreen,{movies:movies.filter(m=>m.classic),catalog:{movies,members,sessions:[],cycles:[]},viewer:{...members[0],avatar:1,role:'admin'},writesEnabled:true,onMovie:m=>setMovies([m])});}
 await act(async()=>root.render(createElement(Screen)));await click(state);
 await click(`Remove Film ${state} from Classics`);expect(container.querySelector('dialog')?.textContent).toContain(`Film ${state}`);expect(container.querySelector('dialog')?.textContent).toContain('2001');expect(container.querySelector('dialog')?.textContent).toContain(state==='Seen'?'4 Seen · 0 No · 0 Unknown':state==='Ranked'?'0 Seen · 4 No · 0 Unknown':'0 Seen · 3 No · 1 Unknown');
 await click('Cancel');expect(api.removeClassic).not.toHaveBeenCalled();expect(container.querySelector('.ranking-row')).toBeTruthy();
 vi.mocked(api.removeClassic).mockResolvedValue({...movie,classic:false,ranking:null,seen:[],appearances:[]} as MovieDetail);
 await click(`Remove Film ${state} from Classics`);await click('Remove from Classics');expect(api.removeClassic).toHaveBeenCalledExactlyOnceWith(state);expect(container.querySelector('.ranking-row')).toBeNull();expect(container.querySelector('dialog')).toBeNull();
});
it.each([['member',true],['admin',false]] as const)('hides removal for role %s with writes %s',async(role,writesEnabled)=>{
 await act(async()=>root.render(createElement(ClassicsScreen,{movies:[film('Ranked')],viewer:{...members[0],avatar:1,role},writesEnabled,onMovie:vi.fn()})));expect(container.querySelector('.classic-remove')).toBeNull();
});
