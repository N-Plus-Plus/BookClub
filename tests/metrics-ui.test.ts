// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it,vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('../frontend/api',() => ({api:{metricsEnrichment:vi.fn().mockResolvedValue({movies:{}})}}));
import { MetricsScreen } from '../frontend/MetricsScreen';
import type { Catalog, Movie } from '../shared/types';
const dimensions=[['IMDb','IMDb','imdb','rating',10,8.1,'8.1 / 10'],['LB','Letterboxd','letterboxd','rating',5,4.25,'4.25 / 5'],['MC','Metacritic','metacritic','critic',100,76,'76 / 100'],['MC-U','Metacritic User','metacritic','user',10,7.8,'7.8 / 10'],['Trakt','Trakt','trakt','rating',100,71,'71 / 100'],['Ebert','Roger Ebert','rogerebert','rating',4,3.5,'3.5 / 4'],['RT-A','Rotten Tomatoes - Audience','rottentomatoes','audience',100,82,'82 / 100'],['RT-C','Rotten Tomatoes - Critic','rottentomatoes','critic',100,91,'91 / 100'],['TMDB','TMDB','tmdb','rating',10,7.3,'7.3 / 10']] as const;
const movie:Movie={id:'a',title:'A film with a long title for the Metrics list',year:2000,original_title:null,release_date:null,runtime:null,overview:null,genres:['Drama'],assets:[],external_ids:[],seen:[],classic:false,ranking:null,scores:dimensions.map(([, ,provider,metric,raw_scale,raw_value])=>({provider,metric,raw_scale,raw_value,normalized_value:null,vote_count:null,fetched_at:'2000-01-01',retrieved_via:'mdblist'}))};
const catalog:Catalog={members:[{id:'m',display_name:'Member',active:1,sort_order:1}],movies:[movie],cycles:[],sessions:[{id:'s',movies:[movie,movie],host_member_id:'m',cycle_slot:1,kind:'hosted',event_date:'2000-01-01',legacy_cycle_label:null,cycle_id:null,date_precision:'exact'}]};
it('uses square popularity dividers and insets only the outer table columns',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const style=document.createElement('style');style.textContent=readFileSync('frontend/app.css','utf8');document.head.appendChild(style);
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 try {
  const scored={...movie,scores:movie.scores.map(s=>({...s,vote_count:100}))};
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,movies:[scored],sessions:[{...catalog.sessions[0],movies:[scored]}]},viewer:null,onUpdated:async()=>{}})));
  const tab=(label:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===label)!.click());
  await tab('Top / Bottom');
  expect(container.querySelectorAll('.metrics-popularity-list')).toHaveLength(2);
  for(const list of container.querySelectorAll('.metrics-popularity-list')) expect(getComputedStyle(list.querySelector('a')!).borderRadius).toBe('0');
  await tab('General Interest');
  for(const cell of container.querySelectorAll('.metrics-table tr > :first-child')) expect(getComputedStyle(cell).paddingLeft).toBe('1rem');
  for(const cell of container.querySelectorAll('.metrics-table tr > :last-child')) expect(getComputedStyle(cell).paddingRight).toBe('1rem');
  expect(getComputedStyle(container.querySelector('thead')!).position).toBe('sticky');
 } finally {await act(async()=>root.unmount());container.remove();style.remove();}
});
it('defaults on each mount, keeps nine selectors independent, displays full headings/native scores and preserves identity and IMDb summaries',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const container=document.createElement('div');document.body.appendChild(container);let root=createRoot(container);
 const mount=()=>act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
 const tab=(label:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===label)!.click());
 const sections=()=>[...container.querySelectorAll('.metrics-rankings section')];
 const select=async(index:number,label:string)=>act(async()=>{[...sections()[index].querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
 try {
 await mount();
 await tab('Top / Bottom');
 for(const section of sections()) {
  expect([...section.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['IMDb','LB','MC','MC-U','RT-A','RT-C','TMDB','Trakt','Ebert']);
  expect(section.querySelector('button[aria-pressed=true]')?.textContent).toBe('IMDb');
 }
 await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[1].click());
 await tab('General Interest');
 const genres=container.querySelector('.metrics-table')!.textContent;
 await tab('Top / Bottom');
 for(const [label,name,,,,,display] of dimensions) {
  await select(0,label);
  expect(sections()[0].querySelector('h2')?.textContent).toBe(`Top 5 by ${name}`);
  expect([...sections()[0].querySelectorAll('.metrics-film-footer > strong')].map(s=>s.textContent)).toEqual([display,display]);
  expect(sections()[1].querySelector('h2')?.textContent).toBe('Bottom 5 by IMDb');
  expect(container.querySelector('.metrics-filters button[aria-pressed=true]')?.textContent).toContain('MEMBER');
 }
 await select(0,'LB');
 for(const [label,name,,,,,display] of dimensions) {
  await select(1,label);
  expect(sections()[1].querySelector('h2')?.textContent).toBe(`Bottom 5 by ${name}`);
  expect(sections()[1].querySelector('.metrics-film-footer > strong')?.textContent).toBe(display);
  expect(sections()[0].querySelector('h2')?.textContent).toBe('Top 5 by Letterboxd');
 }
 await tab('General Interest');
 expect(container.querySelector('.metrics-table')!.textContent).toBe(genres);
 await tab('Top / Bottom');
 await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,movies:[{...movie,scores:movie.scores.filter(s=>s.provider!=='letterboxd')}]},viewer:null,onUpdated:async()=>{}})));
 expect(sections()[0].textContent).toContain('No appearances with Letterboxd scores yet.');
 await act(async()=>root.unmount());root=createRoot(container);await mount();await tab('Top / Bottom');
 expect(sections().map(s=>s.querySelector('h2')?.textContent)).toEqual(['Top 5 by IMDb','Bottom 5 by IMDb']);
 } finally {await act(async()=>root.unmount());container.remove();}
});

it('empty identities preserve report axes and restrained missing states without invalid fractions',async() => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const container=document.createElement('div');const root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,sessions:[]},viewer:null,onUpdated:async()=>{}})));
  expect(container.textContent).toContain('No appearances with IMDb scores yet.');
  const tab=(label:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===label)!.click());
  await tab('Averages');expect(container.querySelectorAll('.metrics-rating-profile > div')).toHaveLength(9);
  await tab('Extremes');expect(container.querySelectorAll('.metrics-extremes section')).toHaveLength(14);
  await tab('Top / Bottom');expect(container.textContent).toContain('No director data for this selection.');
  expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
 } finally {await act(async()=>root.unmount());}
});
