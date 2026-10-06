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
    expect(container.querySelectorAll('.metrics-theme-signature')).toHaveLength(5);
    expect(container.querySelectorAll('.metrics-scatter a')).toHaveLength(7);
    expect(container.querySelector('.metrics-economics-scatter')?.textContent).toContain('7 / 10 unique films');
    for (let i = 1;i <= 5;i++) {
      await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[i].click());
      expect(container.querySelectorAll('.metrics-theme-signature')).toHaveLength(0);
      expect(container.querySelectorAll('.metrics-languages .metrics-stacked-profile')).toHaveLength(2);
      expect(container.querySelectorAll('.metrics-classifications .metrics-stacked-profile')).toHaveLength(2);
      expect(container.querySelectorAll('.metrics-median-budget .metrics-distribution-row')).toHaveLength(2);
      expect(container.querySelectorAll('.metrics-diversity section')).toHaveLength(5);
      expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
    }
    const select = container.querySelector('.metrics-talent select') as unknown as {value:string;dispatchEvent:(event:Event)=>boolean};
    for (const role of ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']) {
      await act(async() => {select.value=role;select.dispatchEvent(new Event('change',{bubbles:true}));});
      expect(container.querySelector('.metrics-talent')?.textContent).toContain(`${role} known for`);
    }
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
    await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[3].click());
    expect(container.querySelectorAll('.metrics-film-extreme')[3].textContent).toContain('6-way tie');
    expect(container.querySelectorAll('.metrics-film-extreme')[3].querySelectorAll('a')).toHaveLength(6);
    const picker = container.querySelector('.metrics-economics-scatter select') as unknown as {value:string;dispatchEvent:(event:Event)=>boolean};
    await act(async() => {picker.value='extra-0';picker.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(container.querySelector('.metrics-scatter-detail a')?.getAttribute('href')).toBe('#/movie/extra-0');
    expect(container.querySelector('.metrics-scatter-detail')?.textContent).toMatch(/Budget.*Revenue.*MATT/);
  } finally {await act(async() => root.unmount());container.remove();}
});
it('failed/partial loading preserves existing reports, supports explicit retry and quiet missing states',async() => {
  vi.mocked(api.metricsEnrichment).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({movies:{}});
  const container = document.createElement('div'),root = createRoot(container);
  try {
    await act(async() => root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
    expect(container.textContent).toContain('Existing Metrics remains available.');
    expect(container.querySelector('.metrics-summary')?.textContent).toContain('14');
    await act(async() => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retry enriched Metrics')!.click());
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(2);expect(container.textContent).not.toContain('could not load');
    expect(container.textContent).toContain('No qualifying evidence');expect(container.textContent).toContain('No repeat writer yet');
    expect(container.querySelector('.metrics-languages')?.textContent).toContain('Unknown 100.0%');
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
  } finally {await act(async() => root.unmount());}
});
