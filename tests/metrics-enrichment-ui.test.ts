// @vitest-environment jsdom
import { act,createElement,StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import { metricsFixture } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
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
    await tab('Fingerprints');
    expect(container.querySelectorAll('.metrics-theme-signature')).toHaveLength(5);
    await tab('Economics / Standalone');
    expect(container.querySelector('.metrics-scatter')).toBeNull();
    expect(container.querySelector('.metrics-revenue-ratios')?.textContent).toContain('7 / 10 unique films');
    for (const list of container.querySelectorAll('.metrics-ratio-list')) {
      expect([...list.querySelectorAll('.metrics-ratio-rank')].map(n=>n.textContent)).toEqual(['1.','2.','3.','4.','5.','6.','7.']);
      expect(list.querySelectorAll('li > .metrics-ratio-data')).toHaveLength(7);
      expect(list.textContent).toMatch(/Reported budget USD\s[\d,]+,000 · Reported revenue USD\s[\d,]+,000/);
    }
    for (let i = 1;i <= 5;i++) {
      await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[i].click());
      await tab('Fingerprints');
      expect(container.querySelectorAll('.metrics-theme-signature')).toHaveLength(0);
      await tab('Economics / Standalone');
      expect(container.querySelectorAll('.metrics-languages .metrics-stacked-profile')).toHaveLength(2);
      await tab('General Interest');
      expect(container.querySelectorAll('.metrics-classifications .metrics-stacked-profile')).toHaveLength(2);
      await tab('Averages');
      expect(container.querySelectorAll('.metrics-median-budget')).toHaveLength(2);
      await tab('Taste Diversity');
      expect(container.querySelectorAll('.metrics-diversity section')).toHaveLength(5);
      expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
    }
    await tab('Fingerprints');
    const select = container.querySelector('.metrics-talent select') as unknown as {value:string;dispatchEvent:(event:Event)=>boolean};
    for (const role of ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']) {
      await act(async() => {select.value=role;select.dispatchEvent(new Event('change',{bubbles:true}));});
      expect(container.querySelector('.metrics-talent')?.textContent).toContain(`${role} known for`);
    }
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
    await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[3].click());
    await tab('Extremes');
    expect(container.querySelectorAll('.metrics-film-extreme')[5].textContent).toContain('6-way tie');
    expect(container.querySelectorAll('.metrics-film-extreme')[5].querySelectorAll('a')).toHaveLength(6);
    await tab('Economics / Standalone');
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
    await tab('Fingerprints');
    expect(container.textContent).toContain('Existing Metrics remains available.');
    await act(async() => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retry enriched Metrics')!.click());
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(2);expect(container.textContent).not.toContain('could not load');
    expect(container.textContent).toContain('No qualifying evidence');await tab('Extremes');expect(container.textContent).toContain('No repeat writer yet');
    await tab('Economics / Standalone');
    expect(container.querySelector('.metrics-languages')?.textContent).toMatch(/Unknown.*100.0%/);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
  } finally {await act(async() => root.unmount());}
});
