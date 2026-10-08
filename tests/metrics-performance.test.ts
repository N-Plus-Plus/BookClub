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
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(()=>vi.restoreAllMocks());

it('cached analytical snapshots preserve every filter, role, repeat, score and missing-data result',()=>{
  const source=metricsFixture(),catalog=metricsCatalog(source),raw=metricsEnrichmentFixture(),data=reports.prepareMetricsEnrichment(raw);
  const all=selectedAppearances(catalog),original=selectedAppearances(source);
  expect(metricsSummary(source)).toEqual({events:calculateMetrics(source).events,appearances:calculateMetrics(source).appearances,imdbAverage:calculateMetrics(source).imdbAverage});
  for(const filter of [{kind:'all' as const},{kind:'classics' as const},...source.members.map(m=>({kind:'member' as const,memberId:m.id}))]){
    const rows=selectedAppearances(catalog,filter),before=selectedAppearances(source,filter);
    expect(calculateMetrics(catalog,filter)).toEqual(calculateMetrics(source,filter));
    expect(metricsDashboard(rows,all)).toEqual(metricsDashboard(before,original));
    expect(reports.themeFingerprint(rows,all,data,{distinctive:true,limit:10000})).toEqual(reports.themeFingerprint(before,original,raw,{distinctive:true,limit:10000}));
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

it('does no theme work on Top / Bottom, retains visited reports, and treats repeated identity selection as a no-op',async()=>{
  vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
  const theme=vi.spyOn(reports,'themeFingerprint'),diversity=vi.spyOn(reports,'tasteDiversity');
  const container=document.createElement('div'),root=createRoot(container);document.body.appendChild(container);
  try{
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
    expect(theme).not.toHaveBeenCalled();expect(diversity).not.toHaveBeenCalled();
    const tab=(name:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent === name)!.click());
    await tab('Fingerprints');expect(theme).toHaveBeenCalledTimes(5);
    await tab('General');await tab('Fingerprints');expect(theme).toHaveBeenCalledTimes(5);
    await act(async()=>container.querySelector<HTMLButtonElement>('.metrics-filters button')!.click());expect(theme).toHaveBeenCalledTimes(5);
    await tab('Diversity');expect(diversity).toHaveBeenCalledTimes(20);
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
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{},resource})));
    await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent === 'Fingerprints')!.click());
    expect(container.querySelectorAll('.metrics-theme-cloud li').length).toBeGreaterThan(0);
    await act(async()=>resource.invalidate());
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(2);expect(container.querySelector('.metrics-theme-cloud')).toBeNull();
    expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Fingerprints');
  }finally{await act(async()=>root.unmount());container.remove();}
});
