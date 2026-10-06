// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { MetricsScreen } from '../frontend/MetricsScreen';
import type { Catalog, Movie } from '../shared/types';
import { renderToStaticMarkup } from 'react-dom/server';
const dimensions=[['IMDb','IMDb','imdb','rating',10,8.1,'8.1 / 10'],['LB','Letterboxd','letterboxd','rating',5,4.25,'4.25 / 5'],['MC','Metacritic','metacritic','critic',100,76,'76 / 100'],['MC-U','Metacritic User','metacritic','user',10,7.8,'7.8 / 10'],['Trakt','Trakt','trakt','rating',100,71,'71 / 100'],['Ebert','Roger Ebert','rogerebert','rating',4,3.5,'3.5 / 4'],['RT-A','Rotten Tomatoes - Audience','rottentomatoes','audience',100,82,'82 / 100'],['RT-C','Rotten Tomatoes - Critic','rottentomatoes','critic',100,91,'91 / 100'],['TMDB','TMDB','tmdb','rating',10,7.3,'7.3 / 10']] as const;
const movie:Movie={id:'a',title:'A film with a long title for the Metrics list',year:2000,original_title:null,release_date:null,runtime:null,overview:null,genres:['Drama'],assets:[],external_ids:[],seen:[],classic:false,ranking:null,scores:dimensions.map(([, ,provider,metric,raw_scale,raw_value])=>({provider,metric,raw_scale,raw_value,normalized_value:null,vote_count:null,fetched_at:'2000-01-01',retrieved_via:'mdblist'}))};
const catalog:Catalog={members:[{id:'m',display_name:'Member',active:1,sort_order:1}],movies:[movie],cycles:[],sessions:[{id:'s',movies:[movie,movie],host_member_id:'m',cycle_slot:1,kind:'hosted',event_date:'2000-01-01',legacy_cycle_label:null,cycle_id:null,date_precision:'exact'}]};
it('defaults on each mount, keeps nine selectors independent, displays full headings/native scores and preserves identity and IMDb summaries',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const container=document.createElement('div');document.body.appendChild(container);let root=createRoot(container);
 const mount=()=>act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
 const sections=()=>[...container.querySelectorAll('.metrics-rankings section')];
 const select=async(index:number,label:string)=>act(async()=>{[...sections()[index].querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
 try {
 await mount();
 for(const section of sections()) {
  expect([...section.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['IMDb','LB','MC','MC-U','RT-A','RT-C','TMDB','Trakt','Ebert']);
  expect(section.querySelector('button[aria-pressed=true]')?.textContent).toBe('IMDb');
 }
 await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[1].click());
 const summary=container.querySelector('.metrics-summary')!.textContent;
 const coverage=container.querySelector('.metrics-summary + p')!.textContent;
 const genres=container.querySelector('.metrics-table')!.textContent;
 for(const [label,name,,,,,display] of dimensions) {
  await select(0,label);
  expect(sections()[0].querySelector('h2')?.textContent).toBe(`Top 5 by ${name}`);
  expect([...sections()[0].querySelectorAll('.metrics-film-item > strong')].map(s=>s.textContent)).toEqual([display,display]);
  expect(sections()[1].querySelector('h2')?.textContent).toBe('Bottom 5 by IMDb');
  expect(container.querySelector('.metrics-filters button[aria-pressed=true]')?.textContent).toContain('MEMBER');
 }
 await select(0,'LB');
 for(const [label,name,,,,,display] of dimensions) {
  await select(1,label);
  expect(sections()[1].querySelector('h2')?.textContent).toBe(`Bottom 5 by ${name}`);
  expect(sections()[1].querySelector('.metrics-film-item > strong')?.textContent).toBe(display);
  expect(sections()[0].querySelector('h2')?.textContent).toBe('Top 5 by Letterboxd');
 }
 expect(container.querySelector('.metrics-summary')!.textContent).toBe(summary);
 expect(container.querySelector('.metrics-summary + p')!.textContent).toBe(coverage);
 expect(container.querySelector('.metrics-table')!.textContent).toBe(genres);
 await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,movies:[{...movie,scores:movie.scores.filter(s=>s.provider!=='letterboxd')}]},viewer:null,onUpdated:async()=>{}})));
 expect(sections()[0].textContent).toContain('No appearances with Letterboxd scores yet.');
 await act(async()=>root.unmount());root=createRoot(container);await mount();
 expect(sections().map(s=>s.querySelector('h2')?.textContent)).toEqual(['Top 5 by IMDb','Bottom 5 by IMDb']);
 } finally {await act(async()=>root.unmount());container.remove();}
});

it('empty identities preserve report axes and restrained missing states without invalid fractions',() => {
 const html=renderToStaticMarkup(createElement(MetricsScreen,{catalog:{...catalog,sessions:[]},viewer:null,onUpdated:async()=>{}}));
 const container=document.createElement('div');container.innerHTML=html;
 expect(container.querySelectorAll('.metrics-rating-profile > div')).toHaveLength(9);
 expect(container.querySelectorAll('.metrics-extremes section')).toHaveLength(4);
 expect(container.textContent).toContain('No events for this identity');
 expect(container.textContent).toContain('No director data for this selection.');
 expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
});

