// @vitest-environment jsdom
import { applicationCss } from './helpers/application-css';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it,vi } from 'vitest';

vi.mock('../frontend/api',() => ({api:{metricsEnrichment:vi.fn().mockResolvedValue({movies:{}})}}));
import { MetricsScreen } from '../frontend/MetricsScreen';
import { metricsFilm,metricsEvent,metricsFixture,observation } from './metrics-fixture';
import type { Catalog, Movie } from '../shared/types';
const dimensions=[['IMDb','IMDb','imdb','rating',10,8.1,'8.1 / 10'],['LB','Letterboxd','letterboxd','rating',5,4.25,'4.25 / 5'],['MC','Metacritic','metacritic','critic',100,76,'76 / 100'],['MC-U','Metacritic user','metacritic','user',10,7.8,'7.8 / 10'],['Trakt','Trakt','trakt','rating',100,71,'71 / 100'],['Ebert','Roger Ebert','rogerebert','rating',4,3.5,'3.5 / 4'],['RT-A','Rotten Tomatoes - audience','rottentomatoes','audience',100,82,'82 / 100'],['RT-C','Rotten Tomatoes - critic','rottentomatoes','critic',100,91,'91 / 100'],['TMDB','TMDB','tmdb','rating',10,7.3,'7.3 / 10']] as const;
const movie:Movie={id:'a',title:'A film with a long title for the Metrics list',year:2000,original_title:null,release_date:null,runtime:null,overview:null,genres:['Drama'],assets:[],external_ids:[],seen:[],classic:false,ranking:null,scores:dimensions.map(([, ,provider,metric,raw_scale,raw_value])=>({provider,metric,raw_scale,raw_value,normalized_value:null,vote_count:null,fetched_at:'2000-01-01',retrieved_via:'mdblist'}))};
const catalog:Catalog={members:[{id:'m',display_name:'Member',active:1,sort_order:1}],movies:[movie],cycles:[],sessions:[{id:'s',movies:[movie,movie],host_member_id:'m',cycle_slot:1,kind:'hosted',event_date:'2000-01-01',legacy_cycle_label:null,cycle_id:null,date_precision:'exact'}]};
it('uses square popularity dividers and insets only the outer table columns',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const style=document.createElement('style');style.textContent=applicationCss();document.head.appendChild(style);
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 try {
  const scored={...movie,scores:movie.scores.map(s=>({...s,vote_count:100}))};
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,movies:[scored],sessions:[{...catalog.sessions[0],movies:[scored]}]},viewer:null,onUpdated:async()=>{}})));
  const tab=(label:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===label)!.click());
  await tab('Top 5');
  expect(container.querySelectorAll('.metrics-popularity-list')).toHaveLength(2);
  for(const list of container.querySelectorAll('.metrics-popularity-list')) expect(getComputedStyle(list.querySelector('a')!).borderRadius).toBe('0');
  await tab('Breakdowns');
  for(const cell of container.querySelectorAll('.metrics-table tr > :first-child')) expect(getComputedStyle(cell).paddingLeft).toBe('var(--space-16)');
  for(const cell of container.querySelectorAll('.metrics-table tr > :last-child')) expect(getComputedStyle(cell).paddingRight).toBe('var(--space-16)');
  expect(getComputedStyle(container.querySelector('thead')!).position).toBe('sticky');
 } finally {await act(async()=>root.unmount());container.remove();style.remove();}
});
it('defaults to Critics independently, switches composites, preserves identities and resets on mount',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const container=document.createElement('div');document.body.appendChild(container);let root=createRoot(container);
 const mount=()=>act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
 const sections=()=>[...container.querySelectorAll('.metrics-rankings section')];
 const select=async(index:number,label:string)=>act(async()=>{[...sections()[index].querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
 try {
  await mount();
  for(const section of sections()) {
   expect([...section.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['Critics','Audience']);
   expect(section.querySelector('button[aria-pressed=true]')?.textContent).toBe('Critics');
   expect([...section.querySelectorAll('.metrics-film-value')].map(s=>s.textContent)).toEqual(['84.8 / 100','84.8 / 100']);
  }
  await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[1].click());
  await select(0,'Audience');
  expect(sections()[0].querySelector('h2')?.textContent).toBe('Top 5 highest audience scores');
  expect(sections()[0].querySelector('.metrics-film-value')?.textContent).toBe('78.3 / 100');
  expect(sections()[1].querySelector('h2')?.textContent).toBe('Top 5 lowest critic scores');
  await select(1,'Audience');await select(0,'Critics');
  expect(sections()[1].querySelector('h2')?.textContent).toBe('Top 5 lowest audience scores');
  expect(container.querySelector('.metrics-filters button[aria-pressed=true]')?.textContent).toContain('MEMBER');
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,movies:[{...movie,scores:[]}]},viewer:null,onUpdated:async()=>{}})));
  expect(sections()[0].textContent).toContain('No appearances with critic scores yet.');
  expect(sections()[1].textContent).toContain('No appearances with audience scores yet.');
  await act(async()=>root.unmount());root=createRoot(container);await mount();
  expect(sections().map(s=>s.querySelector('h2')?.textContent)).toEqual(['Top 5 highest critic scores','Top 5 lowest critic scores']);
 } finally {await act(async()=>root.unmount());container.remove();}
});

it('empty identities preserve report axes and restrained missing states without invalid fractions',async() => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const container=document.createElement('div');const root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,sessions:[]},viewer:null,onUpdated:async()=>{}})));
  expect(container.textContent).toContain('No appearances with critic scores yet.');
  const tab=(label:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===label)!.click());
  await tab('Breakdowns');expect(container.querySelectorAll('.metrics-rating-profile > div')).toHaveLength(9);
  await tab('Records');expect(container.querySelectorAll('.metrics-extremes section')).toHaveLength(20);
  await tab('Top 5');expect(container.textContent).toContain('No qualifying evidence for this selection.');
  expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
 } finally {await act(async()=>root.unmount());}
});

it('switches independent unique popularity lists, keeps both medians visible and renders the same accessible film/context/identity structure in all four lists',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const a=metricsFilm('a',{title:'Hosted film',assets:[{asset_type:'poster',provider:'tmdb',reference:'/fixture.jpg',width:64,height:96,preferred:1}],scores:[observation('imdb','rating',8,10,100),observation('trakt','rating',80,100,10),observation('rogerebert','rating',3,4)]});
 const b=metricsFilm('b',{title:'Classic film',scores:[observation('imdb','rating',7,10,10),observation('letterboxd','rating',4,5,200),observation('metacritic','critic',80,100)]});
 const data={...metricsFixture(),movies:[a,b],cycles:[{id:'cycle',ordinal:12,title:null,rough_date:'2026-01-01',import_source:null,import_key:null,created_at:'',updated_at:''}],sessions:[{...metricsEvent('later',[a]),event_date:'2026-02-01',cycle_id:'cycle'},{...metricsEvent('first',[b,a],null),cycle_id:'cycle'}]};
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:data,viewer:null,onUpdated:async()=>{}})));
  const report=container.querySelector('[data-metric="W"]')!;
  const median=report.querySelector('p')!.textContent;
  expect(median).toBe('Median 100 IMDb votes · Median 110 total audience votes');
  expect(report.querySelector('button[aria-pressed=true]')?.textContent).toBe('IMDb');
  const lists=()=>[...report.querySelectorAll('ol')];
  expect(lists().map(l=>l.querySelector('a')?.getAttribute('href'))).toEqual(['#/movie/a','#/movie/b']);
  await act(async()=>[...report.querySelectorAll('button')].find(b=>b.textContent==='All audiences')!.click());
  expect(lists().map(l=>l.querySelector('a')?.getAttribute('href'))).toEqual(['#/movie/b','#/movie/b']);
  expect(lists()[1].textContent).toContain('10 IMDb votes');
  await act(async()=>[...report.querySelectorAll<HTMLButtonElement>('[aria-label="Most obscure vote filter"] button')].find(b=>b.textContent==='All audiences')!.click());
  expect(lists().map(l=>l.querySelector('a')?.getAttribute('href'))).toEqual(['#/movie/b','#/movie/a']);
  expect(lists()[0].textContent).toContain('210 audience votes');
  expect(lists()[1].textContent).toContain('110 audience votes');
  expect(report.querySelector('p')!.textContent).toBe(median);
  expect(container.querySelectorAll('ol.metrics-list')).toHaveLength(4);
  for(const list of container.querySelectorAll('ol.metrics-list')) {
   expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
   for(const row of list.querySelectorAll('a')) {
    expect(row.classList.contains('metrics-film-item')).toBe(true);
    expect(row.children).toHaveLength(3);
    expect(row.children[0].classList.contains('poster')).toBe(true);
    const copy=row.querySelector('.movie-copy')!;
    expect(copy.firstElementChild?.className).toBe('movie-title');
    expect(copy.lastElementChild?.className).toBe('metrics-film-value');
    expect(copy.textContent).toContain('2001 · 100 min');
    expect(copy.textContent).toContain('Cycle 12 · Film');
    expect(row.getAttribute('aria-label')).toBe(copy.querySelector('.movie-title')?.textContent);
    expect(row.querySelector('.metrics-film-host .club-avatar')).not.toBeNull();
   }
  }
  expect(container.querySelector('.metrics-rankings')?.textContent).toContain('SEAN');
  expect(lists()[0].querySelector('.metrics-film-host')?.textContent).toBe('CLSC');
  expect(lists()[1].querySelector('.metrics-film-host')?.textContent).toBe('CLSC');
  expect(lists()[1].querySelector('.movie-copy')?.textContent).toContain('Cycle 12 · Film 2');
  expect(container.querySelector('img.poster')?.getAttribute('alt')).toBe('Hosted film poster');
  expect(container.querySelector('.poster-empty')?.getAttribute('aria-label')).toBe('No poster available for Classic film');
  expect(container.querySelectorAll('.metrics-film-footer')).toHaveLength(0);
  expect(container.querySelectorAll('[data-metric="W"].metrics-section, [data-metric="W"] .metrics-section')).toHaveLength(0);
  await act(async()=>[...report.querySelectorAll('button')].find(b=>b.textContent==='IMDb')!.click());
  expect(lists()[0].textContent).toContain('100 IMDb votes');
  expect(lists()[1].textContent).toContain('110 audience votes');
  const tab=(label:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===label)!.click());
  await tab('Tastes');await tab('Top 5');
  expect([...container.querySelectorAll('[data-metric="W"] h2')].map(e=>e.textContent)).toEqual(['Top 5 most popular · IMDb','Top 5 most obscure · All audiences']);
  await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[5].click());
  expect(container.querySelector('[aria-label="Most obscure vote filter"] [aria-pressed=true]')?.textContent).toBe('All audiences');
 } finally {await act(async()=>root.unmount());container.remove();}
});
