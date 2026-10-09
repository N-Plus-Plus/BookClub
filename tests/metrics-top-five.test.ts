import { metricsInventory, reportHeadings } from './helpers/metrics-inventory';
// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { formatRevenueRatio } from '../frontend/metrics/TopBottom';
import { api } from '../frontend/api';
import { topFrequency,productionCountryRankings,metricsFactReader,metricsTalentReader,talentRoles,emptyEnrichmentMovie,revenueRatioRankings,type MetricsEnrichment } from '../shared/metrics-enrichment';
import { selectedAppearances } from '../shared/metrics';
import { metricsFixture,metricsFilm,metricsEvent } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(()=>vi.resetAllMocks());
const fixture=(counts:number[])=>{
 const movies=counts.map((_,i)=>metricsFilm(String(i),{director:`Person ${i}`}));
 const catalog={...metricsFixture(),movies,sessions:[metricsEvent('one',movies.flatMap((movie,i)=>Array.from({length:counts[i]},()=>movie)))]};
 const data:MetricsEnrichment={movies:Object.fromEntries(movies.map((movie,i)=>[movie.id,{...emptyEnrichmentMovie(),companies:[{external_id:String(i),name:`Studio ${i}`}],countries:[{code:String(i),name:`Country ${i}`}],credits:[{kind:'cast' as const,role:'cast',person_id:String(i),name:`Person ${i}`},...['writer','screenplay','cinematographer','composer','editor','producer'].map(role=>({kind:'crew' as const,role,person_id:String(i),name:`Person ${i}`}))]}]))};
 return {catalog,data,rows:selectedAppearances(catalog)};
};
const examples=[{counts:[10,9,8,8,7,6],length:5},{counts:[10,10,10,8,8,8,7],length:6},{counts:[12,10,9,9,9,9,9],length:7}];
it.each(examples)('uses five plus actual fifth-count ties for every talent role and studios: $counts',({counts,length})=>{
 const {rows,data}=fixture(counts);
 for(const role of talentRoles) {
  const report=topFrequency(rows,rows,metricsTalentReader(data,role),true);
  expect(report.values.map(v=>v.count)).toEqual(counts.slice(0,length));
  expect(report.values.map(v=>v.label)).toEqual(Array.from({length},(_,i)=>`Person ${i}`));
 }
 const studios=topFrequency(rows,rows,metricsFactReader(data,'companies'));
 expect(studios.values.map(v=>v.count)).toEqual(counts.slice(0,length));
 expect(studios.values[0].percentage).toBeCloseTo(counts[0]/counts.reduce((a,b)=>a+b,0)*100);
});
it('keeps small lists, singleton studios and unlimited fifth-place ties without requiring two appearances',()=>{
 const small=fixture([1,1,1]);
 expect(topFrequency(small.rows,small.rows,metricsFactReader(small.data,'companies')).values).toHaveLength(3);
 const large=fixture([10,9,8,7,...Array(30).fill(6)]);
 expect(topFrequency(large.rows,large.rows,metricsFactReader(large.data,'companies')).values).toHaveLength(34);
});
it('countries dedupe canonical films and country codes, count multinational films once per country and include missing-country films only in the selection denominator',()=>{
 const movies=['a','b','c'].map(id=>metricsFilm(id));
 const catalog={...metricsFixture(),movies,sessions:[metricsEvent('one',[movies[0],movies[0],movies[1],movies[2]])]};
 const data:MetricsEnrichment={movies:{a:{...emptyEnrichmentMovie(),countries:[{code:'US',name:'United States'},{code:' us ',name:'United States'},{code:'GB',name:'United Kingdom'}]},b:{...emptyEnrichmentMovie(),countries:[{code:'US',name:'United States'},{code:'FR',name:'France'}]}}};
 const rows=selectedAppearances(catalog),report=productionCountryRankings(rows,data);
 expect(report).toMatchObject({unique:3,covered:2,distinct:3});
 expect(report.values.map(v=>[v.label,v.count])).toEqual([['United States',2],['France',1],['United Kingdom',1]]);
 expect(report.values.map(v=>v.percentage)).toEqual([2/3*100,1/3*100,1/3*100]);
 expect(report.values.reduce((sum,v)=>sum+v.percentage,0)).toBeCloseTo(133.3333);
 expect(productionCountryRankings([...rows].reverse(),data)).toEqual(report);
 expect(productionCountryRankings([],data)).toMatchObject({unique:0,values:[]});
});
it.each(examples)('country frequency includes fifth-place film-count ties: $counts',({counts,length})=>{
 const movies=Array.from({length:Math.max(...counts)},(_,i)=>metricsFilm(String(i)));
 const catalog={...metricsFixture(),movies,sessions:[metricsEvent('one',[...movies,movies[0]])]};
 const data:MetricsEnrichment={movies:Object.fromEntries(movies.map((movie,index)=>[movie.id,{...emptyEnrichmentMovie(),countries:counts.flatMap((count,i)=>index<count?[{code:String(i),name:`Country ${i}`}]:[])}]))};
 const report=productionCountryRankings(selectedAppearances(catalog),data);
 expect(report.values.map(v=>v.count)).toEqual(counts.slice(0,length));
 expect(report.unique).toBe(movies.length);
});
it.each([[4144,false,'Ratio: 4,144 : 1'],[.5,true,'Ratio: 1 : 2'],[.025,true,'Ratio: 1 : 40'],[1/4144,true,'Ratio: 1 : 4,144'],[1,true,'Ratio: 1 : 1'],[2.25,true,'Ratio: 2 : 1'],[1/621428.6,false,'Ratio: 1 : 621,429'],[1e12,false,'Ratio: 1,000,000,000,000 : 1'],[1e-12,true,'Ratio: 1 : 1,000,000,000,000'],[0,true,'Ratio unavailable'],[NaN,false,'Ratio unavailable'],[Infinity,true,'Ratio unavailable'],[Number.MIN_VALUE,true,'Ratio unavailable']] as const)('formats ratio %s defensively', (ratio,lowest,display)=>expect(formatRevenueRatio(ratio,lowest)).toBe(display));
it('financial ranks use actual ratios for ties and exclude overflow/underflow from otherwise finite positive money',()=>{
 const {catalog,data}=fixture([1,1,1,1,1,1,1]);
 const ratios=[6,5,4,3,2.04,2.04,2.03];
 for(const [i,movie] of catalog.movies.entries())data.movies[movie.id].metadata={original_language:null,budget:100,revenue:ratios[i]*100};
 const rows=selectedAppearances(catalog),report=revenueRatioRankings(rows,data);
 expect(report.top.map(p=>p.ratio)).toEqual(ratios.slice(0,6));
 const lowest=revenueRatioRankings(rows,{movies:Object.fromEntries(catalog.movies.map((movie,i)=>[movie.id,{...data.movies[movie.id],metadata:{original_language:null,budget:100,revenue:[1,2,3,4,5,5,6][i]}}]))});
 expect(lowest.bottom.map(p=>p.ratio)).toEqual([.01,.02,.03,.04,.05,.05]);
 data.movies['0'].metadata={original_language:null,budget:Number.MIN_VALUE,revenue:Number.MAX_VALUE};
 data.movies['1'].metadata={original_language:null,budget:Number.MAX_VALUE,revenue:Number.MIN_VALUE};
 expect(revenueRatioRankings(rows,data).covered).toBe(5);
});
it('owns the exact thirteen reports, keeps selectors and roles local, and removes moved reports from their old categories',async()=>{
 vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
 const container=document.createElement('div'),root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
  const titles=()=>reportHeadings(container);
  const expected=metricsInventory['Top 5'];
  expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Top 5');expect(titles()).toEqual(expected);
  expect(container.querySelector('.metrics-directors')).toBeNull();
  for(const selector of ['.metrics-talent','.metrics-revenue-ratios','.metrics-countries'])expect(container.querySelectorAll(selector)).toHaveLength(1);
  expect(container.querySelector('.metrics-companies')).toBeNull();
  expect(container.querySelectorAll('.metrics-countries .metrics-distribution-track').length).toBeGreaterThan(0);
  const groups=()=>[...container.querySelectorAll('[role=group]')];
  const choose=(name:string,label:string)=>act(async()=>[...groups().find(e=>e.getAttribute('aria-label')===name)!.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label)!.click());
  await choose('Top 5 score filter','Audience');await choose('Bottom 5 score filter','Audience');await choose('Most popular vote filter','All audiences');
  expect(titles().slice(0,4)).toEqual(['Top 5 highest audience scores','Top 5 lowest audience scores','Top 5 most popular · All audiences','Top 5 most obscure · IMDb']);
  const select=container.querySelector('.metrics-talent select')! as unknown as HTMLSelectElement;
  expect([...select.options].map(o=>o.value)).toEqual([...talentRoles,'Studios']);
  for(const role of talentRoles){await act(async()=>{select.value=role;select.dispatchEvent(new Event('change',{bubbles:true}));});expect(container.querySelector('.metrics-talent > p')?.textContent).toBe(`Share of appearances with ${role.toLowerCase()} credit.`);}
  await act(async()=>{select.value='Studios';select.dispatchEvent(new Event('change',{bubbles:true}));});
  const tab=(name:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===name)!.click());
  const partner=container.querySelector('[aria-label="Creative partnerships"] select') as unknown as HTMLSelectElement;
  expect([...partner.options].map(o=>o.value)).toEqual(['Writer','Composer','Cinematographer','Editor']);
  expect(partner.value).toBe('Writer');
  for(const value of ['Composer','Cinematographer','Editor'])await act(async()=>{partner.value=value;partner.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(select.value).toBe('Studios');
  await tab('Tastes');expect(titles()).toEqual(metricsInventory.Tastes);expect(container.querySelector('.metrics-talent,.metrics-companies')).toBeNull();
  await tab('Breakdowns');expect(container.querySelector('.metrics-revenue-ratios')).toBeNull();
  await tab('Top 5');expect((container.querySelector('[aria-label="Creative partnerships"] select') as unknown as HTMLSelectElement).value).toBe('Editor');expect((container.querySelector('.metrics-talent select') as unknown as HTMLSelectElement)?.value).toBe('Studios');
  for(const index of [1,5]){await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[index].click());expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Top 5');expect(titles()).toHaveLength(13);
   const studioRows=[...container.querySelectorAll('.metrics-talent .metrics-frequency-row')];expect(studioRows).toHaveLength(2);
   for(const row of studioRows)expect(row.textContent).toContain(index===1?'2 appearances · 66.7%':'1 appearances · 50.0%');
   for(const row of container.querySelectorAll('.metrics-countries .metrics-enriched-row')){expect(row.textContent).toContain('1 film');expect(row.textContent).not.toContain('%');}
  }
  expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
 }finally{await act(async()=>root.unmount());}
});
it('Top 5 exposes delayed enrichment, failure and explicit retry while keeping existing film rankings usable',async()=>{
 let release!:(value:MetricsEnrichment)=>void;
 vi.mocked(api.metricsEnrichment).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({movies:{}});
 const container=document.createElement('div'),root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
  expect(container.textContent).toContain('Loading enriched Metrics…');expect(container.querySelector('.metrics-rankings a')).not.toBeNull();
  await act(async()=>release(metricsEnrichmentFixture()));expect(container.textContent).not.toContain('Loading enriched');
  await act(async()=>root.unmount());const next=createRoot(container);
  try {
   await act(async()=>next.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
   expect(container.textContent).toContain('Existing Metrics remains available.');expect(container.querySelector('.metrics-rankings a')).not.toBeNull();
   await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Retry enriched Metrics')!.click());
   expect(container.textContent).not.toContain('could not load');expect(container.querySelector('.metrics-talent')?.textContent).toContain('No qualifying evidence');expect(api.metricsEnrichment).toHaveBeenCalledTimes(3);
  }finally{await act(async()=>next.unmount());}
 }finally{if(container.querySelector('.metrics-content'))await act(async()=>root.unmount());}
});
