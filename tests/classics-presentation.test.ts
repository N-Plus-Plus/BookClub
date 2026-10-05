// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClassicsScreen } from '../frontend/ClassicsScreen';
import { DetailScreen } from '../frontend/DetailScreen';
import { api } from '../frontend/api';
import { rankMovie } from '../shared/ranking';
import type { Movie, MovieDetail } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{detail:vi.fn(),seen:vi.fn(),maintainMovies:vi.fn()}}));
const members=[1,2,3,4,5].map(n=>({id:'m'+n,display_name:'Member '+n,sort_order:n,active:n===5?0:1,avatar:n}));
const scores=[['imdb','rating',80],['rottentomatoes','audience',90],['rottentomatoes','critic',85]].map(([provider,metric,value])=>({provider:String(provider),metric:String(metric),raw_value:Number(value),raw_scale:100,normalized_value:Number(value),vote_count:null,fetched_at:'2026-01-01'}));
const film=(i:number,group='ranked'):Movie=>{
 const seen=members.filter(m=>m.active).map(m=>({member_id:m.id,seen:group==='seen'?1:0,updated_at:''}));
 const inputs=group==='missing'?[]:scores;
 return {id:'f'+i,title:'Film '+i,year:2001,runtime:100,director:i===1?'A Director':null,original_title:null,release_date:null,overview:null,genres:[],assets:[],external_ids:[],classic:true,scores:inputs,seen,ranking:rankMovie(inputs,seen,members)};
};
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const click=async(label:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
it('paginates each Classics view, retains global ranks, resets tabs and clamps shrinking lists',async()=>{
 const movies=[...Array.from({length:42},(_,i)=>film(i+1)),...Array.from({length:11},(_,i)=>film(i+100,'missing')),...Array.from({length:11},(_,i)=>film(i+200,'seen'))];
 const render=async(list=movies)=>act(async()=>root.render(createElement(ClassicsScreen,{movies:list,viewer:null,writesEnabled:false,onMovie:vi.fn()})));
 await render();expect(container.querySelectorAll('.ranking-row')).toHaveLength(20);
 expect(container.querySelector('.rank-number')?.textContent).toBe('#1');expect(container.querySelectorAll('.candidate-director')).toHaveLength(1);
 expect(container.querySelector('.ranking-row .score,.ranking-row .badge,.ranking-row details')).toBeNull();expect(container.querySelector('.ranking-row')?.textContent).toContain('IMDb 80');
 expect(container.querySelector('.lucide-list-sort-descending')).toBeTruthy();expect(container.querySelector('.lucide-rows-3')).toBeTruthy();
 await click('Next');expect(container.querySelector('.rank-number')?.textContent).toBe('#21');
 await click('Needs Data (11)');expect(container.querySelectorAll('.ranking-row')).toHaveLength(10);expect(container.textContent).toContain('Page 1 of 2');expect(container.textContent).toContain('Missing:');
 await click('Next');expect(container.querySelectorAll('.ranking-row')).toHaveLength(1);
 await click('Already Seen (11)');expect(container.querySelectorAll('.ranking-row')).toHaveLength(10);expect(container.textContent).toContain('Page 1 of 2');
 await click('Ranked (42)');await click('Next');await click('Next');expect(container.querySelector('.rank-number')?.textContent).toBe('#41');
 await render(movies.slice(0,5));expect(container.querySelectorAll('.ranking-row')).toHaveLength(5);expect(container.textContent).toContain('Page 1 of 1');expect(container.querySelector('.rank-number')?.textContent).toBe('#1');
});
it.each([true,false])('infers all active members from History, regardless of Classics membership (%s), without writes',async(classic)=>{
 const movie:MovieDetail={...film(1),classic,appearances:[{id:'event',event_date:'2026-01-01',date_precision:'exact',kind:'hosted',host_member_id:'m3',position:1}]};
 const original=JSON.stringify(movie.seen);vi.mocked(api.detail).mockResolvedValue(movie);
 await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members,writesEnabled:true,isAdmin:false,onMovie:vi.fn()})));
 const columns=container.querySelectorAll('.detail-seen-column');expect(columns[0].querySelectorAll('.club-identity')).toHaveLength(0);expect([...columns[1].querySelectorAll('.club-identity')].map(e=>e.textContent)).toEqual(['MEMBER 1','MEMBER 2','MEMBER 3','MEMBER 4']);
 expect(JSON.stringify(movie.seen)).toBe(original);expect(api.seen).not.toHaveBeenCalled();
});
it('suppresses Seen for films outside Classics without History appearances',async()=>{
 const movie={...film(1),classic:false,appearances:[]};vi.mocked(api.detail).mockResolvedValue(movie);
 await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members,writesEnabled:true,isAdmin:false,onMovie:vi.fn()})));
 expect(container.querySelector('.detail-seen-summary')).toBeNull();expect(container.textContent).not.toContain('Seen It?');expect(api.seen).not.toHaveBeenCalled();
});

it('shows one bottom maintenance disclosure on all tabs for admins only and includes History in bulk work',async()=>{
 const movies=[film(1),film(2,'missing'),film(3,'seen')].map((m,i)=>({...m,external_ids:[{provider:'imdb',external_id:`tt${String(i+1).padStart(7,'0')}`}]}));
 const history={...film(99),classic:false,external_ids:[{provider:'imdb',external_id:'tt0000099'}]};
 const catalog={movies:[...movies,history],members,cycles:[],sessions:[{id:'history',event_date:'2026-01-01',host_member_id:'m1',legacy_cycle_label:null,cycle_id:null,kind:'hosted' as const,date_precision:'exact' as const,cycle_slot:null,movies:[history,movies[0]]}]};
 const viewer={id:'m1',display_name:'Member 1',sort_order:1,avatar:1,role:'admin' as const};const onMovie=vi.fn();
 const render=async(role:'member'|'admin'='admin')=>act(async()=>root.render(createElement(ClassicsScreen,{movies,catalog,viewer:{...viewer,role},writesEnabled:true,onMovie})));
 await render();
 for (const tab of ['Ranked (1)','Needs Data (1)','Already Seen (1)']) {
  await click(tab);expect(container.querySelectorAll('.utility-disclosure')).toHaveLength(1);
  expect(container.querySelector('.ranking-list details')).toBeNull();expect(container.lastElementChild?.lastElementChild?.classList.contains('classics-maintenance')).toBe(true);
 }
 const disclosure=container.querySelector('details')!;disclosure.open=true;
 vi.mocked(api.maintainMovies).mockImplementation(async(_mode,ids)=>({results:ids.map(id=>({movie:{...catalog.movies.find(m=>m.id===id)!,appearances:[]},providers:[{provider:'mdblist',status:'success',count:3,message:'Saved'}]}))}));
 await click('Refresh Scores');expect(api.maintainMovies).toHaveBeenCalledWith('refresh',['f1','f2','f3','f99']);expect(onMovie).toHaveBeenCalled();expect(container.textContent).toContain('4 / 4 films processed');
 await click('Populate Missing Scores');expect(api.maintainMovies).toHaveBeenLastCalledWith('missing',['f1','f2','f3','f99']);
 await render('member');expect(container.querySelector('.classics-maintenance')).toBeNull();
});
