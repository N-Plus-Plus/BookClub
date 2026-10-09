// @vitest-environment jsdom
import { act,createElement,StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { EnrichedFingerprints } from '../frontend/metrics/Fingerprints';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import { metricsFixture } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
import { selectedAppearances, matchesMetricsFilter, type MetricsFilter } from '../shared/metrics';
import { comparisonScopes, themeFingerprint, tasteDiversity } from '../shared/metrics-enrichment';
vi.mock('../frontend/api',() => ({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(() => vi.resetAllMocks());
it('loads once in StrictMode, updates every identity/role locally and exposes truthful chart coverage/ties',async() => {
  vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
  const container = document.createElement('div'),root = createRoot(container);document.body.appendChild(container);
  const catalog = metricsFixture();
  try {
    await act(async() => root.render(createElement(StrictMode,null,createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}}))));
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
    const tab = (name:string) => act(async() => [...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b => b.textContent === name)!.click());
    await tab('Tastes');
    expect(container.querySelectorAll('.metrics-theme-signature')).toHaveLength(5);
    await tab('Top 5');
    expect(container.querySelector('.metrics-scatter')).toBeNull();
    expect(container.querySelector('.metrics-revenue-ratios')?.textContent).not.toContain('unique films have reported');
    for (const list of container.querySelectorAll('.metrics-ratio-list')) {
      expect([...list.querySelectorAll('.metrics-ratio-rank')].map(n=>n.textContent)).toEqual(['1.','2.','3.','4.','5.','6.','7.']);
      expect(list.querySelectorAll('li > .metrics-ratio-data')).toHaveLength(7);
      for (const amounts of list.querySelectorAll('.metrics-reported-money')) {expect([...amounts.querySelectorAll('dt')].map(n=>n.textContent)).toEqual(['Reported budget USD','Reported revenue USD']); expect([...amounts.querySelectorAll('dd')].every(n=>/^\$[\d,]+,000$/.test(n.textContent!))).toBe(true);}
    }
    for (let i = 1;i <= 5;i++) {
      await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[i].click());
      await tab('Tastes');
      expect(container.querySelectorAll('.metrics-theme-signature')).toHaveLength(0);
      const filter:MetricsFilter=i===5?{kind:'classics'}:{kind:'member',memberId:catalog.members[i-1].id};
      const all=selectedAppearances(catalog),rows=all.filter(row=>matchesMetricsFilter(row.session,filter));
      const expected=themeFingerprint(rows,all,metricsEnrichmentFixture());
      expect([...container.querySelectorAll('.metrics-theme-cloud li')].map(e=>e.textContent)).toEqual(expected.values.map(v=>`${v.label}${v.count.toLocaleString('en-AU')}, ${v.ratio!.toFixed(1)}x club`));
      const scopes=comparisonScopes(catalog,all,filter);
      for(const [index,dimension] of (['cast','directors','languages','countries'] as const).entries()) {
        const section=container.querySelectorAll('.metrics-diversity section')[index];
        expect([...section.querySelectorAll('.metrics-distribution-label strong')].map(e=>e.textContent)).toEqual(scopes.map(scope=>{const value=tasteDiversity(scope.rows,metricsEnrichmentFixture(),dimension).perTen;return value===null?'No evidence':`${new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(value*10)}%`;}));
      }
      await tab('Breakdowns');
      expect(container.querySelectorAll('.metrics-classification-row')).toHaveLength(1);
      await tab('Breakdowns');
      expect(container.querySelectorAll('.metrics-median-budget')).toHaveLength(1);
      await tab('Tastes');
      expect(container.querySelectorAll('.metrics-diversity section')).toHaveLength(4);
      expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
    }
    await tab('Top 5');
    const select = container.querySelector('.metrics-talent select') as unknown as {value:string;dispatchEvent:(event:Event)=>boolean};
    for (const role of ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']) {
      await act(async() => {select.value=role;select.dispatchEvent(new Event('change',{bubbles:true}));});
      expect(container.querySelector('.metrics-talent')?.textContent).not.toContain(`${role} known for`);
    }
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
    await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[3].click());
    await tab('Records');
    expect(container.querySelectorAll('.metrics-film-extreme')[8].textContent).toContain('6-way tie');
    expect(container.querySelectorAll('.metrics-film-extreme')[8].querySelectorAll('a')).toHaveLength(6);
    await tab('Top 5');
    expect(container.querySelector('.metrics-revenue-ratios a')?.getAttribute('href')).toMatch(/^#\/movie\//);
    expect(container.querySelector('.metrics-revenue-ratios')?.textContent).toMatch(/Reported budget.*Reported revenue/);
  } finally {await act(async() => root.unmount());container.remove();}
});
it('failed/partial loading preserves existing reports, supports explicit retry and quiet missing states',async() => {
  vi.mocked(api.metricsEnrichment).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({movies:{}});
  const container = document.createElement('div'),root = createRoot(container);
  try {
    await act(async() => root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
    const tab = (name:string) => act(async() => [...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b => b.textContent === name)!.click());
    expect(container.querySelector('.metrics-rankings')).not.toBeNull();
    expect(container.textContent).toContain('Existing Metrics remains available.');
    await act(async() => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retry enriched Metrics')!.click());
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(2);expect(container.textContent).not.toContain('could not load');
    expect(container.textContent).toContain('No qualifying evidence');await tab('Records');expect(container.textContent).toContain('No repeat writer yet');
    await tab('Breakdowns');
    expect(container.querySelector('.metrics-classifications')?.textContent).toContain('100.0%');
    await tab('Top 5');expect(container.querySelector('.metrics-non-english')?.textContent).toContain('No qualifying original-language evidence');
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
  } finally {await act(async() => root.unmount());}
});

it.each([true,false])('theme counts use grouped thousands metadata with unchanged ratios in ALL=%s',async isAll=>{
 const all=selectedAppearances(metricsFixture()),data=metricsEnrichmentFixture();
 const rows=Array.from({length:1234},()=>all[0]);
 const other=all.find(row=>row.movie.id!==all[0].movie.id)!;
 data.movies[other.movie.id]={...data.movies[other.movie.id],keywords:[]};
 const report=themeFingerprint(rows,[...rows,...Array.from({length:1234},()=>other)],data),container=document.createElement('div'),root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(EnrichedFingerprints,{isAll,themeReport:report,signatures:[{label:'SEAN',rows,report}]})));
  const terms=[...container.querySelectorAll('.metrics-theme-cloud li')];
  expect(terms).toHaveLength(report.values.length);expect(terms.length).toBeGreaterThan(0);
  for(const [index,term] of terms.entries()) {
   expect(term.firstElementChild?.textContent).toBe(report.values[index].label);
   expect(term.lastElementChild?.textContent).toBe('1,234, 2.0x club');
  }
 }finally{await act(async()=>root.unmount());}
});
