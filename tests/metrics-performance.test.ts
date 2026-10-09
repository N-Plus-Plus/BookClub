import * as relocated from '../shared/metrics-staging/films';
import * as numerical from '../shared/metrics-staging/numerical';
import * as overlaps from '../shared/metrics-staging/overlap';
// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import * as reports from '../shared/metrics-enrichment';
import { metricsCatalog,selectedAppearances,calculateMetrics,metricsDashboard,metricsSummary } from '../shared/metrics';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { MetricsResults } from '../frontend/MetricsResults';
import { MetricsEnrichmentResource } from '../frontend/metrics-cache';
import { api } from '../frontend/api';
import { metricsFixture } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
import { GenreRevenueReport,FlopsReport } from '../frontend/metrics/staging/Evidence';
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(()=>vi.restoreAllMocks());

it('keeps every genre-revenue and contributor flop tie accessible in bounded pages',async()=>{
 const seed=metricsFixture(),movies=Array.from({length:43},(_,i)=>({...seed.movies[0],id:`tie-${i}`,title:`Tie ${i}`}));
 const catalog={...seed,movies,sessions:[{...seed.sessions[0],movies}]};
 const rows=selectedAppearances(catalog),data={movies:Object.fromEntries(movies.map(movie=>[movie.id,{...reports.emptyEnrichmentMovie(),metadata:{original_language:null,budget:1000000,revenue:2000000}}]))};
 const node=document.createElement('div'),root=createRoot(node);document.body.appendChild(node);
 try{
  for(const Component of [GenreRevenueReport,FlopsReport]){
   await act(async()=>root.render(createElement(Component,{catalog,all:rows,rows,filter:{kind:'all'},data})));
   const group=Component===GenreRevenueReport?node.querySelector('.staging-revenue-table tbody tr')!:node.querySelector('.staging-flop-group')!;
   const found=new Set<string>();
   for(let page=0;page<3;page++){
    expect(group.querySelectorAll('a').length).toBeLessThanOrEqual(20);
    for(const link of group.querySelectorAll('a'))found.add(link.getAttribute('href')!);
    const next=[...group.querySelectorAll('button')].find(button=>button.textContent==='Next')!;
    if(page<2)await act(async()=>next.click());else expect(next.disabled).toBe(true);
   }
   expect(found.size).toBe(43);
  }
 }finally{await act(async()=>root.unmount());node.remove();}
});

it('cached analytical snapshots preserve every filter, role, repeat, score and missing-data result',()=>{
  const source=metricsFixture(),catalog=metricsCatalog(source),raw=metricsEnrichmentFixture(),data=reports.prepareMetricsEnrichment(raw);
  const all=selectedAppearances(catalog),original=selectedAppearances(source);
  expect(metricsSummary(source)).toEqual({events:calculateMetrics(source).events,appearances:calculateMetrics(source).appearances,imdbAverage:calculateMetrics(source).imdbAverage});
  for(const filter of [{kind:'all' as const},{kind:'classics' as const},...source.members.map(m=>({kind:'member' as const,memberId:m.id}))]){
    const rows=selectedAppearances(catalog,filter),before=selectedAppearances(source,filter);
    expect(calculateMetrics(catalog,filter)).toEqual(calculateMetrics(source,filter));
    expect(metricsDashboard(rows,all)).toEqual(metricsDashboard(before,original));
    expect(reports.themeFingerprint(rows,all,data)).toEqual(reports.themeFingerprint(before,original,raw));
    for(const dimension of ['countries','languages','themes','directors','cast','companies'] as const){
      expect(reports.fingerprint(rows,all,reports.metricsFactReader(data,dimension))).toEqual(reports.fingerprint(before,original,r=>reports.facts(r,raw,dimension)));
      expect(reports.tasteDiversity(rows,data,dimension)).toEqual(reports.tasteDiversity(before,raw,dimension));
    }
    for(const role of reports.talentRoles){
      expect(reports.fingerprint(rows,all,reports.metricsTalentReader(data,role),{qualifyingShare:true})).toEqual(reports.fingerprint(before,original,r=>reports.talent(r,raw.movies[r.movie.id] ?? reports.emptyEnrichmentMovie(),role),{qualifyingShare:true}));
      expect(reports.recurringTalent(rows,data,role)).toEqual(reports.recurringTalent(before,raw,role));
    }
  }
  const changed={...source,movies:source.movies.map(m=>({...m,scores:[]}))};
  expect(calculateMetrics(metricsCatalog(changed)).top).toEqual([]);
  expect(calculateMetrics(catalog).top.length).toBeGreaterThan(0);
});

it('normalises shared film evidence once and reuses club frequencies across contributor reports',()=>{
  const catalog=metricsFixture(),all=selectedAppearances(catalog),raw=metricsEnrichmentFixture();
  let reads=0;
  for(const movie of Object.values(raw.movies)){
    const values=movie.keywords;Object.defineProperty(movie,'keywords',{get:()=>{reads++;return values;}});
  }
  const data=reports.prepareMetricsEnrichment(raw);
  reports.themeFingerprint(all,all,data);
  const initial=reads;
  for(const scope of reports.comparisonScopes(catalog,all,{kind:'all'}))reports.themeFingerprint(scope.rows,all,data);
  reports.tasteDiversity(all,data,'themes');
  expect(reads).toBe(initial);expect(initial).toBeGreaterThan(0);
  const reader=reports.metricsFactReader(data,'cast');
  expect(reports.frequency(all,reader)).toBe(reports.frequency(all,reader));
});

it('shares reads across visits and invalidates without allowing an older response to replace new data',async()=>{
  const resource=new MetricsEnrichmentResource();let release!:(data:reports.MetricsEnrichment)=>void;
  const read=vi.fn(()=>new Promise<reports.MetricsEnrichment>(resolve=>{release=resolve;}));
  const first=resource.load(read);expect(resource.load(read)).toBe(first);expect(read).toHaveBeenCalledOnce();
  resource.invalidate();const fresh=reports.prepareMetricsEnrichment(metricsEnrichmentFixture());
  const next=vi.fn(async()=>fresh);await resource.load(next);
  release({movies:{}});await first;
  expect(await resource.load(read)).toEqual(fresh);expect(next).toHaveBeenCalledOnce();
  const otherAccount=new MetricsEnrichmentResource();await otherAccount.load(next);expect(next).toHaveBeenCalledTimes(2);
});

it('does no theme work on Top 5, retains visited reports, and treats repeated identity selection as a no-op',async()=>{
  vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
  const theme=vi.spyOn(reports,'themeFingerprint'),diversity=vi.spyOn(reports,'tasteDiversity');
  const container=document.createElement('div'),root=createRoot(container);document.body.appendChild(container);
  try{
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
    expect(theme).not.toHaveBeenCalled();expect(diversity).not.toHaveBeenCalled();
    const tab=(name:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent === name)!.click());
    await tab('Tastes');expect(theme).toHaveBeenCalledTimes(5);
    await tab('Breakdowns');await tab('Tastes');expect(theme).toHaveBeenCalledTimes(5);
    await act(async()=>container.querySelector<HTMLButtonElement>('.metrics-filters button')!.click());expect(theme).toHaveBeenCalledTimes(5);
    await tab('Tastes');expect(diversity).toHaveBeenCalledTimes(20);
  }finally{await act(async()=>root.unmount());container.remove();}
});

it('mounts bounded pages while preserving every tie, ordinal and keyboard-operated result',async()=>{
  const items=Array.from({length:63},(_,i)=>({id:i}));
  const container=document.createElement('div'),root=createRoot(container);document.body.appendChild(container);
  const render=(values=items)=>act(async()=>root.render(createElement(MetricsResults<{id:number}>,{items:values,label:'Tied films',render:(item:{id:number},index:number)=>createElement('a',{key:item.id,href:`#/movie/${item.id}`},`${index+1}: Film ${item.id}`)})));
  try{
    await render();expect(container.querySelectorAll('a')).toHaveLength(20);expect(container.textContent).toContain('63 results');
    const found:string[]=[];
    for(let i=0;i<4;i++){
      found.push(...[...container.querySelectorAll('a')].map(a=>a.textContent!));
      const next=[...container.querySelectorAll('button')].find(b=>b.textContent === 'Next')!;
      if(i<3)await act(async()=>next.click());else expect(next.disabled).toBe(true);
    }
    expect(found).toEqual(items.map((item,index)=>`${index+1}: Film ${item.id}`));
    await render(items.slice(0,2));expect(container.querySelectorAll('a')).toHaveLength(2);expect(container.querySelector('button')).toBeNull();
  }finally{await act(async()=>root.unmount());container.remove();}
});

it('invalidating saved enrichment refreshes an already mounted Metrics screen',async()=>{
  const resource=new MetricsEnrichmentResource();
  vi.mocked(api.metricsEnrichment).mockReset().mockResolvedValueOnce(metricsEnrichmentFixture()).mockResolvedValueOnce({movies:{}});
  const container=document.createElement('div'),root=createRoot(container);document.body.appendChild(container);
  try{
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...metricsFixture(),sessions:[...metricsFixture().sessions,...Array.from({length:8},(_,i)=>({...metricsFixture().sessions[0],id:`repeat-${i}`}))]},viewer:null,onUpdated:async()=>{},resource})));
    await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent === 'Tastes')!.click());
    expect(container.querySelectorAll('.metrics-theme-cloud li').length).toBeGreaterThan(0);
    await act(async()=>resource.invalidate());
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(2);expect(container.querySelector('.metrics-theme-cloud')).toBeNull();
    expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Tastes');
  }finally{await act(async()=>root.unmount());container.remove();}
});

it('evaluates relocated reports only in their owning category and reuses reports on revisits',async()=>{
 vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
 const spies={pairs:vi.spyOn(relocated,'partnerships'),stars:vi.spyOn(relocated,'sharedStars'),awards:vi.spyOn(relocated,'awardsReport'),collections:vi.spyOn(relocated,'collectionCompletion'),offers:vi.spyOn(relocated,'platforms'),cycles:vi.spyOn(numerical,'cycleScorecards'),spreads:vi.spyOn(numerical,'contributorSpreads'),overlap:vi.spyOn(overlaps,'genreOverlap'),shared:vi.spyOn(overlaps,'firstSharedTheme'),creators:vi.spyOn(reports,'recurringTalent')};
 const catalog=metricsFixture(),node=document.createElement('div'),root=createRoot(node);
 const select=(label:string)=>act(async()=>[...node.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(t=>t.textContent===label)!.click());
 try {
  await act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
  expect(spies.pairs).toHaveBeenCalled();for(const key of ['stars','awards','collections','offers','cycles','spreads','overlap','shared','creators'] as const)expect(spies[key]).not.toHaveBeenCalled();
  await select('Tastes');expect(spies.stars).toHaveBeenCalledOnce();expect(spies.overlap).toHaveBeenCalledOnce();expect(spies.shared).toHaveBeenCalledOnce();expect(spies.awards).not.toHaveBeenCalled();expect(spies.creators).not.toHaveBeenCalled();
  await select('Breakdowns');for(const key of ['awards','collections','offers','cycles'] as const)expect(spies[key]).toHaveBeenCalledOnce();expect(spies.spreads).toHaveBeenCalledTimes(2);expect(spies.creators).not.toHaveBeenCalled();
  const calls=Object.fromEntries(Object.entries(spies).map(([key,spy])=>[key,spy.mock.calls.length]));
  await select('Top 5');await select('Tastes');await select('Breakdowns');
  for(const [key,spy] of Object.entries(spies))expect(spy.mock.calls.length).toBe(calls[key]);
  await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...catalog,movies:[...catalog.movies]},viewer:null,onUpdated:async()=>{}})));
  expect(spies.awards).toHaveBeenCalledTimes(2);expect(api.metricsEnrichment).toHaveBeenCalledOnce();
 }finally{await act(async()=>root.unmount());}
});
