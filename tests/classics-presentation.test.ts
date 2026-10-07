// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminScreen } from '../frontend/AdminScreen';
import { ClassicsScreen } from '../frontend/ClassicsScreen';
import { DetailScreen } from '../frontend/DetailScreen';
import { api } from '../frontend/api';
import { rankMovie } from '../shared/ranking';
import type { Movie, MovieDetail } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{detail:vi.fn(),seen:vi.fn(),scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:['f1','f2','f3','f99','saved-7'],eligibleDimensions:30,unavailableDimensions:0,unavailableFilms:0})),maintainMovies:vi.fn()}}));
const members=[1,2,3,4,5].map(n=>({id:'m'+n,display_name:'Member '+n,sort_order:n,active:n===5?0:1,avatar:n}));
const scores=[['imdb','rating',80],['rottentomatoes','audience',90],['rottentomatoes','critic',85]].map(([provider,metric,value])=>({provider:String(provider),metric:String(metric),raw_value:Number(value),raw_scale:100,normalized_value:Number(value),vote_count:null,fetched_at:'2026-01-01'}));
const film=(i:number,group='ranked'):Movie=>{
 const seen=members.filter(m=>m.active).map(m=>({member_id:m.id,seen:group==='seen'?1:0,updated_at:''}));
 const inputs=group==='missing'?[]:scores;
 return {id:'f'+i,title:'Film '+i,year:2001,runtime:100,director:i===1?'A Director':null,original_title:null,release_date:null,overview:null,genres:[],assets:[],external_ids:[],classic:true,scores:inputs,seen,ranking:rankMovie(inputs,seen,members)};
};
let root:Root,container:HTMLDivElement;
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
const click=async(label:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label || b.getAttribute('aria-label')?.startsWith(label+':'))!.click();});
it('paginates each Classics view, retains global ranks, resets tabs and clamps shrinking lists',async()=>{
 const movies=[...Array.from({length:42},(_,i)=>film(i+1)),...Array.from({length:11},(_,i)=>film(i+100,'missing')),...Array.from({length:11},(_,i)=>film(i+200,'seen'))];
 const render=async(list=movies)=>act(async()=>root.render(createElement(ClassicsScreen,{movies:list,viewer:null,writesEnabled:false,onMovie:vi.fn()})));
 await render();expect(container.querySelectorAll('.ranking-row')).toHaveLength(20);
 expect(container.querySelector('.rank-number')?.textContent).toBe('#1');expect(container.querySelectorAll('.candidate-director')).toHaveLength(1);
 expect(container.querySelector('.ranking-row .score,.ranking-row .badge,.ranking-row details')).toBeNull();expect(container.querySelector('.ranking-row')?.textContent).toContain('IMDb 80');
 expect([...container.querySelectorAll('.classics-filters img')].map(icon=>icon.getAttribute('src'))).toEqual(['/buttons/ranked.png','/buttons/unranked.png','/buttons/dq.png']);
 await click('Next');expect(container.querySelector('.rank-number')?.textContent).toBe('#21');
 await click('Unranked');expect(container.querySelector('.movie-title')?.textContent).toBe('Film 100');expect(container.querySelectorAll('.ranking-row')).toHaveLength(10);expect(container.textContent).toContain('Page 1 of 2');expect(container.textContent).not.toContain('Missing:');
 await click('Next');expect(container.querySelectorAll('.ranking-row')).toHaveLength(1);
 await click('Seen');expect(container.querySelectorAll('.ranking-row')).toHaveLength(10);expect(container.textContent).toContain('Page 1 of 2');
 await click('Ranked');await click('Next');await click('Next');expect(container.querySelector('.rank-number')?.textContent).toBe('#41');
 await render(movies.slice(0,5));expect(container.querySelectorAll('.ranking-row')).toHaveLength(5);expect(container.textContent).toContain('Page 1 of 1');expect(container.querySelector('.rank-number')?.textContent).toBe('#1');
});
it.each([true,false])('infers all active members from History, regardless of Classics membership (%s), without writes',async(classic)=>{
 const movie:MovieDetail={...film(1),classic,appearances:[{id:'event',event_date:'2026-01-01',date_precision:'exact',kind:'hosted',host_member_id:'m3',position:1}]};
 const original=JSON.stringify(movie.seen);vi.mocked(api.detail).mockResolvedValue(movie);
 await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members})));
 const columns=container.querySelectorAll('.detail-seen-column');expect(columns[0].querySelectorAll('.club-identity')).toHaveLength(0);expect([...columns[1].querySelectorAll('.club-identity')].map(e=>e.textContent)).toEqual(['MEMBER 1','MEMBER 2','MEMBER 3','MEMBER 4']);
 expect(JSON.stringify(movie.seen)).toBe(original);expect(api.seen).not.toHaveBeenCalled();
});
it('suppresses Seen for films outside Classics without History appearances',async()=>{
 const movie={...film(1),classic:false,appearances:[]};vi.mocked(api.detail).mockResolvedValue(movie);
 await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members})));
 expect(container.querySelector('.detail-seen-summary')).toBeNull();expect(container.textContent).not.toContain('Seen It?');expect(api.seen).not.toHaveBeenCalled();
});

it('omits maintenance on all Classics tabs and includes History in Admin bulk work',async()=>{
 const movies=[film(1),film(2,'missing'),film(3,'seen')].map((m,i)=>({...m,external_ids:[{provider:'imdb',external_id:`tt${String(i+1).padStart(7,'0')}`}]}));
 const history={...film(99),classic:false,external_ids:[{provider:'imdb',external_id:'tt0000099'}]};
 const catalog={movies:[...movies,history],members,cycles:[],sessions:[{id:'history',event_date:'2026-01-01',host_member_id:'m1',legacy_cycle_label:null,cycle_id:null,kind:'hosted' as const,date_precision:'exact' as const,cycle_slot:null,movies:[history,movies[0]]}]};
 const viewer={id:'m1',display_name:'Member 1',sort_order:1,avatar:1,role:'admin' as const};const onMovie=vi.fn();
 const render=async(role:'member'|'admin'='admin')=>act(async()=>root.render(createElement(ClassicsScreen,{movies,catalog,viewer:{...viewer,role},writesEnabled:true,onMovie})));
 await render();
 for (const tab of ['Ranked','Unranked','Seen']) {
  await click(tab);expect(container.querySelectorAll('.classics-maintenance')).toHaveLength(0);
  expect(container.querySelector('.ranking-list details')).toBeNull();expect(container.textContent).not.toContain('Populate Missing Scores');
 }
 await act(async()=>root.render(createElement(AdminScreen,{catalog,writesEnabled:true,onMovie,onUpdated:async()=>{}})));
 vi.mocked(api.maintainMovies).mockImplementation(async(_mode,ids)=>({results:ids.map(id=>({movie:{...catalog.movies.find(m=>m.id===id)!,appearances:[]},providers:[{provider:'mdblist',status:'success',count:3,message:'Saved'}]}))}));
 vi.useFakeTimers();
 await click('Refresh Scores');await act(async()=>{ await vi.runAllTimersAsync(); });expect(vi.mocked(api.maintainMovies).mock.calls.filter(([mode])=>mode==='refresh').flatMap(([,ids])=>ids)).toEqual(['f1','f2','f3','f99']);expect(onMovie).toHaveBeenCalled();expect(container.textContent).toContain('4 / 4 films processed');
 await click('Populate Missing Scores');await act(async()=>{ await vi.runAllTimersAsync(); });expect(vi.mocked(api.maintainMovies).mock.calls.filter(([mode])=>mode==='missing').flatMap(([,ids])=>ids)).toEqual(['f1','f2','f3','f99']);
 vi.useRealTimers();
 await render('member');expect(container.querySelector('.classics-maintenance')).toBeNull();
});

it('keeps the Admin DOM compact through a 980-film no-data run',async()=>{
 vi.useFakeTimers();const movies=Array.from({length:980},(_,i)=>({...film(i),external_ids:[{provider:'imdb',external_id:'tt0000001'}]}));
 const onMovie=vi.fn();vi.mocked(api.maintainMovies).mockImplementation(async(_mode,ids)=>({results:ids.map(id=>({movie:{...movies.find(m=>m.id===id)!,appearances:[]},providers:[{provider:'mdblist',status:'success',count:0,message:'No usable ratings supplied.'}]}))}));
 await act(async()=>root.render(createElement(AdminScreen,{catalog:{movies,members,sessions:[],cycles:[]},writesEnabled:true,onMovie,onUpdated:async()=>{}})));
 await click('Refresh Scores');await act(async()=>{await vi.runAllTimersAsync();});
 expect(onMovie).toHaveBeenCalledTimes(980);expect(container.textContent).toContain('980 / 980 films processed');expect(container.textContent).toContain('980 with no new scores');
 expect(container.querySelectorAll('.classics-maintenance li')).toHaveLength(0);expect(container.querySelectorAll('.classics-maintenance strong')).toHaveLength(0);
 expect(container.querySelector('progress')?.value).toBe(980);
});

it('uses exact ordered compact Classics scores, omits missing ratings and explanation copy',async()=>{
 const extra=[['tmdb','rating',70],['metacritic','critic',81.5],['letterboxd','rating',82]].map(([provider,metric,value])=>({...scores[0],provider:String(provider),metric:String(metric),raw_value:Number(value),normalized_value:Number(value)}));
 const inputs=[...extra,...scores];const movie={...film(1),scores:inputs,ranking:rankMovie(inputs,film(1).seen,members)};
 const render=async(m:Movie)=>act(async()=>root.render(createElement(ClassicsScreen,{movies:[m],viewer:null,writesEnabled:false,onMovie:vi.fn()})));
 await render(movie);
 const items=()=>[...container.querySelectorAll('.ranking-source-scores > span')];
 expect(items().map(item=>item.textContent)).toEqual(['IMDb 80','LB 82','RT-A 90','TMDB 70','MC 81.5','RT-C 85']);
 expect(items().map(item=>item.getAttribute('title'))).toEqual(['IMDb Rating','Letterboxd Rating','Rotten Tomatoes Audience Score','TMDB Rating','Metacritic Critic Score','Rotten Tomatoes Critic Score']);
 for(const item of items()) expect(item.getAttribute('aria-label')).toBe(`${item.getAttribute('title')}: ${item.textContent?.split(' ').at(-1)}`);
 expect(container.querySelector('.ranking-source-scores')?.textContent).not.toContain('·');
 const style=document.createElement('style');style.textContent=readFileSync('frontend/app.css','utf8');document.head.appendChild(style);
 try {
  const row=getComputedStyle(container.querySelector('.ranking-source-scores')!);
  expect([row.display,row.width,row.flexWrap,row.justifyContent,row.alignItems]).toEqual(['flex','100%','wrap','space-between','baseline']);
  for(const item of items()) {const css=getComputedStyle(item);expect(css.whiteSpace).toBe('nowrap');expect(css.flex).toBe('0 0 auto');}
 } finally {style.remove();}
 await render(film(1));
 expect(items().map(item=>item.textContent)).toEqual(['IMDb 80','RT-A 90','RT-C 85']);
 await render(film(1,'missing'));expect(items()).toHaveLength(0);
 expect(container.textContent).not.toContain('Missing:');expect(container.textContent).not.toContain('using available-score average');
 expect(container.textContent).not.toContain('Watch Order uses six ratings');
 expect(container.querySelector('.developer-tools')).toBeNull();
});
it.each([0,99,100])('uses small distinct count pills with full accessible counts (%s)',async(count)=>{
 const movies=['ranked','missing','seen'].flatMap((group,g)=>Array.from({length:count},(_,i)=>film(g*1000+i,group)));
 await act(async()=>root.render(createElement(ClassicsScreen,{movies,viewer:null,writesEnabled:false,onMovie:vi.fn()})));
 const filters=[...container.querySelectorAll('.classics-filters button')];
 expect(filters.map(b=>b.querySelector('span')?.textContent)).toEqual(['Ranked','Unranked','Seen']);
 expect(filters.map(b=>b.querySelector('.classics-count')?.textContent)).toEqual(Array(3).fill(count>99?'99+':String(count)));
 expect(filters.map(b=>b.querySelector('.classics-count')?.className)).toEqual(['classics-count classics-count-ranked','classics-count classics-count-needs-data','classics-count classics-count-seen']);
 for(const b of filters) expect(b.getAttribute('type')).toBe('button');
 for(const b of filters) expect(b.getAttribute('aria-label')).toContain(`${count} films`);
 expect(filters.map(b=>b.getAttribute('aria-pressed'))).toEqual(['true','false','false']);
 await click('Seen');expect(filters.map(b=>b.getAttribute('aria-pressed'))).toEqual(['false','false','true']);
 const css=readFileSync('frontend/app.css','utf8');
 for(const [state,token] of [['ranked','grass'],['needs-data','rose'],['seen','mandarin']]) expect(css).toContain(`.classics-count-${state} { background: var(--${token}); }`);
 expect(css).toContain('--mandarin: var(--pumpkin)');expect(css).toContain('font-size: var(--text-eyebrow)');
});

it('scopes smaller mobile titles to Classics and keeps tabs in one flexible touch strip',()=>{
 const css=readFileSync('frontend/app.css','utf8');
 expect(css).toMatch(/@media \(max-width: 719px\)\s*\{\s*\.classics-ranking-row \.movie-title \{ font-size: calc\(var\(--text-movie-title\) \* \.75\); \}\s*\}/);
 expect(css).toContain('.movie-title { display: block; font-weight: 600; font-size: var(--text-movie-title); }');
 expect(css).toContain('.classics-filters,.metrics-category-tabs { display: flex; flex-wrap: nowrap;');
 expect(css).toContain('flex: 1 1 0; min-width: 0; min-height: var(--target-min)');
 expect(css).toContain('font-size: var(--text-body); white-space: nowrap;');
 expect(css).toContain('.classics-filters .button svg,.classics-filters .button .action-icon { width: 14.4px; height: 14.4px; }');
 expect(css).toContain('.classics-filters .button[aria-pressed="true"]::after');
 expect(css).toContain('bottom: 0; height: 3px; background: var(--focus-outline)');
 expect(css).toContain('padding: 0 var(--space-4); border-radius: var(--radius-pill); font-size: var(--text-eyebrow); line-height: 1.5;');
});

it.each(['Populate Missing Scores','Refresh Scores','Enrich/Refresh Metadata'])('keeps active %s feedback quiet and retains provider failures',async(label)=>{
 const movies=Array.from({length:11},(_,i)=>({...film(i),external_ids:[{provider:'imdb',external_id:'tt0000001'}]}));
 let release!: (value: Awaited<ReturnType<typeof api.maintainMovies>>) => void;
 vi.mocked(api.maintainMovies).mockImplementationOnce(async(_mode,ids)=>({results:ids.map(id=>({movie:{...movies.find(m=>m.id===id)!,appearances:[]},providers:[
  {provider:'mdblist',status:'success',count:1,message:'Captured'},
  {provider:'omdb',status:'success',count:0,message:'No missing scores supplied.'},
  {provider:'tmdb',status:'skipped',count:0,message:'TMDB rating already available.'},
  {provider:'omdb',status:'skipped',count:0,message:'No missing score OMDb can supply.'},
 ]}))})).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 vi.mocked(api.scoreMaintenanceStatus).mockResolvedValueOnce({candidateIds:movies.map(m=>m.id),eligibleDimensions:5729,unavailableDimensions:7,unavailableFilms:3});
 await act(async()=>root.render(createElement(AdminScreen,{catalog:{movies:[...movies,{...film(99),external_ids:[{provider:'tmdb',external_id:'99'}]},film(100)],members,sessions:[],cycles:[]},writesEnabled:true,onMovie:vi.fn(),onUpdated:async()=>{}})));
 expect(container.textContent).toContain('Scores: IMDb, RT-A, RT-C, LB, MC and TMDB. Populate fills missing scores; Refresh rechecks identified films. OMDb Metadata refreshes title, year, runtime, director and genres across the whole catalogue with a valid IMDb identity.');
 expect(container.textContent).toContain('1 need score identity · 2 need IMDb identity for metadata · 11 eligible for whole-catalogue OMDb Metadata.');
 expect(container.textContent).toContain('5729 score inputs eligible · 7 confirmed unavailable (3 films).');
 vi.useFakeTimers();await click(label);
 expect(container.textContent).toContain('Stop after this batch');expect(container.textContent).toContain('10 /');
 expect(container.querySelector('.score-maintenance-progress')?.getAttribute('value')).toBe('10');
 expect(container.querySelectorAll('.classics-maintenance li')).toHaveLength(0);
 for(const message of ['Captured','No missing scores supplied.','TMDB rating already available.','No missing score OMDb can supply.']) expect(container.textContent).not.toContain(message);
 await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
 await act(async()=>release({results:[{movie:{...movies[10],appearances:[]},providers:[{provider:'omdb',status:'failed',count:0,message:'Provider cooling down.',retryAfter:120}]}]}));
 expect(container.textContent).toContain('omdb · failed: Provider cooling down. Wait 120s before retrying.');
 expect(container.textContent).toContain('Stopped after a provider failure or cooldown.');expect(container.textContent).toContain(label === 'Enrich/Refresh Metadata' ? '10 / 11 films processed' : label === 'Refresh Scores' ? '12 / 12 films processed' : '11 / 11 films processed');
 expect(container.querySelectorAll('.classics-maintenance li')).toHaveLength(1);
 if (label === 'Enrich/Refresh Metadata') {
  expect(container.textContent).toContain('Resume Metadata '+String.fromCharCode(183)+' 1 remaining');
  expect(JSON.parse(localStorage.getItem('bookclub.omdb-metadata.v1')!)).toEqual({version:1,completed:10,remainingIds:['f10']});
 }
});

it('scopes orange progress fill to score maintenance across browser engines',()=>{
 const css=readFileSync('frontend/app.css','utf8'),palette=readFileSync('style.css','utf8');
 expect(palette).toContain('--pumpkin: #fab153;');
 expect(css).toContain('.score-maintenance-progress { appearance: none; border: 0; background: var(--asphalt-dark); accent-color: var(--pumpkin); }');
 expect(css).toContain('.score-maintenance-progress::-webkit-progress-bar { background: var(--asphalt-dark); }');
 for(const engine of ['webkit-progress-value','moz-progress-bar']) expect(css).toContain(`.score-maintenance-progress::-${engine} { background: var(--pumpkin); }`);
 expect(css).toContain('progress { width: 100%; height: 10px; accent-color: var(--concrete); }');
});
