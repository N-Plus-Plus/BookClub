// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { RankingCard, SourceScores } from '../frontend/components';
import { createRoot } from 'react-dom/client';
import { ClassicsScreen } from '../frontend/ClassicsScreen';
import { DetailScreen } from '../frontend/DetailScreen';
import { api } from '../frontend/api';
import type { MovieDetail } from '../shared/types';
import { parseMdbList } from '../worker/src/providers/mdblist';
import { rankMovie } from '../shared/ranking';
const ratings=[{source:'imdb',value:9},{source:'letterboxd',value:9.2},{source:'metacritic',value:97},{source:'popcorn',value:97},{source:'tomatoes',value:100},{source:'tmdb',value:85}];
const optional=[{source:'metacriticuser',value:9.2},{source:'trakt',value:89},{source:'rogerebert',value:3.5}];
const render=(count:number)=>{
 const scores=parseMdbList({ratings:[...ratings,...optional.slice(0,count-6)]},'2026-10-06','batch');
 const before=structuredClone(scores),node=document.createElement('div');
 node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores,ranking:rankMovie(scores,[],[])}));
 expect(scores).toEqual(before);return {node,scores};
};
it.each([6,7,8,9])('%s genuine observations choose the count-based mode and canonical order',count=>{
 const {node,scores}=render(count),row=node.querySelector('.ranking-source-scores')!;
 expect(row.classList.contains('ranking-source-scores-stacked')).toBe(count>6);
 const expected=['IMDb 90','LB 92',...(count>6?['MC-U 92']:[]),'RT-A 97','TMDB 85',...(count>7?['Trakt 89']:[]),...(count>8?['Ebert 87.5']:[]),'MC 97','RT-C 100'];
 expect([...row.children].map(n=>n.textContent)).toEqual(expected);
 for(const item of row.children){expect(item.getAttribute('title')).toBeTruthy();expect(item.getAttribute('aria-label')).toBe(`${item.getAttribute('title')}: ${item.lastElementChild?.textContent}`);}
 if(count===9)expect(scores.find(s=>s.provider==='rogerebert')).toMatchObject({raw_value:3.5,raw_scale:4,normalized_value:87.5});
});
it('omits missing and imputed sources, including optional-only films outside Classics',()=>{
 const scores=parseMdbList({ratings:[{source:'rogerebert',value:4}]});
 const ranking=rankMovie(scores,[],[]),node=document.createElement('div');
 node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores,ranking}));
 expect(node.textContent).toBe('Ebert 100');expect(node.querySelector('span[title]')?.getAttribute('title')).toBe('Roger Ebert Rating');
 expect(renderToStaticMarkup(createElement(SourceScores,{scores:[],ranking:rankMovie([],[],[])}))).toBe('');
 const partial=parseMdbList({ratings:[{source:'imdb',value:9}]});
 node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores:partial,ranking:rankMovie(partial,[],[])}));
 expect(node.textContent).toBe('IMDb 90');
});
it.each(['single','batch'] as const)('presents endpoint-specific Letterboxd equivalently (%s)',endpoint=>{
 const scores=parseMdbList({ratings:[{source:'letterboxd',value:endpoint==='single'?4.6:9.2}]},'2026-10-06',endpoint);
 expect(renderToStaticMarkup(createElement(SourceScores,{scores,ranking:rankMovie(scores,[],[])}))).toContain('>92</span>');
});
it('keeps intrinsic columns and readable typography with graceful wrapping',()=>{
 const style=document.createElement('style');style.textContent=readFileSync('frontend/app.css','utf8');document.head.appendChild(style);
 const {node}=render(9);document.body.appendChild(node);
 try{
 const row=getComputedStyle(node.firstElementChild!);expect([row.display,row.flexWrap,row.justifyContent]).toEqual(['flex','wrap','space-between']);
 for(const item of node.firstElementChild!.children){const css=getComputedStyle(item);expect([css.flex,css.display,css.flexDirection,css.alignItems]).toEqual(['0 0 auto','flex','column','center']);}
 }finally{node.remove();style.remove();}
});

vi.mock('../frontend/api',()=>({api:{detail:vi.fn()}}));
it.each([5,6,7,9])('Home, Classics and Detail share genuine-only presentation with %s scores',async count=>{
 const inputs=count===5?ratings.filter(r=>r.source!=='letterboxd'):[...ratings,...optional.slice(0,count-6)];
 const scores=parseMdbList({ratings:inputs},'2026-10-06','batch');
 const members=[{id:'m1',display_name:'Member',active:1,sort_order:1}];
 const seen=[{member_id:'m1',seen:0,updated_at:''}];
 const ranking=rankMovie(scores,seen,members),before=structuredClone(ranking);
 const movie:MovieDetail={id:'shared-'+count,title:'Shared scores',year:2000,runtime:100,original_title:null,release_date:null,director:null,genres:[],overview:'Overview',assets:[],external_ids:[],classic:true,scores,seen,ranking,appearances:[]};
 const expected=renderToStaticMarkup(createElement(SourceScores,{scores,ranking}));
 const node=document.createElement('div');
 for(const element of [createElement(RankingCard,{movie,variant:'home',rank:1}),createElement(ClassicsScreen,{movies:[movie],viewer:null,writesEnabled:false,onMovie:vi.fn()})]){
  node.innerHTML=renderToStaticMarkup(element);
  expect(node.querySelector('.ranking-source-scores')?.outerHTML).toBe(expected);
  expect(node.querySelectorAll('.ranking-source-scores > span')).toHaveLength(count);
  expect(node.textContent).not.toMatch(/Missing:|using available-score average|imput|residual|Score breakdown/);
 }
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(node);vi.mocked(api.detail).mockResolvedValue(movie);
 try{
  await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members})));
  const row=node.querySelector('.ranking-source-scores')!;
  expect(row.outerHTML).toBe(expected);
  expect(row.classList.contains('ranking-source-scores-stacked')).toBe(count>6);
  expect(row.nextElementSibling?.className).toBe('detail-overview');
  expect(row.textContent).not.toMatch(/Missing|average|imput/);
  expect(node.querySelector('.detail-score-breakdown')).toBeTruthy();
  if(count===5){
   expect(ranking.imputedScores).toHaveLength(1);
   expect(row.textContent).not.toContain('LB');
   expect(node.querySelector('.detail-rating-summary')?.textContent).toContain('Letterboxd Rating: - (average used)');
   expect(node.querySelector('.detail-score-breakdown')?.textContent).toContain('Letterboxd (missing)');
  }
 }finally{await act(async()=>root.unmount());}
 expect(ranking).toEqual(before);
});

it('keeps inline pairs together but allows the shared row to wrap on narrow screens',()=>{
 const style=document.createElement('style');style.textContent=readFileSync('frontend/app.css','utf8');document.head.appendChild(style);
 const {node}=render(6);document.body.appendChild(node);
 try{expect(getComputedStyle(node.firstElementChild!).flexWrap).toBe('wrap');for(const item of node.firstElementChild!.children)expect(getComputedStyle(item).whiteSpace).toBe('nowrap');}
 finally{node.remove();style.remove();}
});

it.each([
 [['trakt','rogerebert'],'Ebert 87.5'],
 [['imdb','metacritic'],'MC 97'],
 [['tmdb','tomatoes'],'RT-C 100'],
 [['rogerebert','metacritic','tomatoes'],null],
 [['imdb','trakt'],null],
])('separates available audience and critic groups for %s', (sources,boundary)=>{
 const scores=parseMdbList({ratings:[...ratings,...optional].filter(r=>sources.includes(r.source))},'2026-10-06','batch');
 const node=document.createElement('div');node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores}));
 const dividers=node.querySelectorAll('.source-scores-critic-boundary');
 expect(dividers).toHaveLength(boundary ? 1 : 0);
 if(boundary)expect(dividers[0].textContent).toBe(boundary);
});
