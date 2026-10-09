import { metricsInventory, reportHeadings } from './helpers/metrics-inventory';
// @vitest-environment jsdom
import { act,createElement,StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { metricsTabs } from '../frontend/metrics-tabs';
import { api } from '../frontend/api';
import { metricsFixture } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
vi.mock('../frontend/api',() => ({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(() => vi.resetAllMocks());
const assignments = {
  'Top 5':['U','V','W','G','genre-combinations','H','I','L'],Tastes:['C','F','S','R','P','O'],
  'Breakdowns':['B','T','K','Y','D','M','N'],Records:['X'],
};
it('renders every metric in exactly one associated active panel, keeps global filters and cached enrichment',async() => {
  vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
  const container = document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
  const tabs = () => [...container.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const select = (label:string) => act(async() => {tabs().find(t => t.textContent === label)!.click();});
  try {
    await act(async() => root.render(createElement(StrictMode,null,createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}}))));
    expect(tabs().map(t => t.textContent)).toEqual(['Top 5','Tastes','Breakdowns','Records']);
    expect(metricsTabs.map(tab=>tab.id)).toEqual(['top-bottom','fingerprints','general','extremes']);
    expect(tabs().find(t => t.getAttribute('aria-selected') === 'true')?.textContent).toBe('Top 5');
    const seen:string[]=[];
    for (const [label,codes] of Object.entries(assignments)) {
      await select(label);
      expect(reportHeadings(container)).toEqual(metricsInventory[label as keyof typeof metricsInventory]);
      expect(container.querySelectorAll('[role=tab]')).toHaveLength(4);
      expect(container.querySelector('[id$="-tab-staging"]')).toBeNull();
      expect(container.querySelector(".metrics-companies")).toBeNull();
      const panels = container.querySelectorAll('[role=tabpanel]');expect(panels).toHaveLength(1);
      expect(container.querySelector('.metrics-filters')?.nextElementSibling?.getAttribute('role')).toBe('tablist');
      expect(container.querySelectorAll('.metrics-filters')).toHaveLength(1);
      const current = tabs().find(t => t.getAttribute('aria-selected') === 'true')!;
      expect(current.tabIndex).toBe(0);expect(tabs().filter(t => t.tabIndex === -1)).toHaveLength(3);
      expect(panels[0].id).toBe(current.getAttribute('aria-controls'));
      expect(panels[0].getAttribute('aria-labelledby')).toBe(current.id);
      const present = [...panels[0].querySelectorAll<HTMLElement>('[data-metric]')].map(e=>e.dataset.metric!);
      if(label === 'Tastes' || label === 'Breakdowns') expect(present).toEqual(codes);
      expect(present.sort()).toEqual([...codes].sort());seen.push(...present);
      expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|0 \/ 0/);
      const superseded=/\b(?:Fingerprints|Outliers|Diversity|General|Averages|Standalone|Cabinet|Extremes Cabinet|Top \/ bottom)\b/;
      expect(container.textContent).not.toMatch(superseded);
      for(const element of container.querySelectorAll('[aria-label],[title]'))expect(`${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`).not.toMatch(superseded);
      if(label === 'Records')expect(panels[0].querySelector('h2')?.textContent).toBe('Records');
    }
    expect(new Set(seen).size).toBe(22);expect(seen).toHaveLength(22);
    expect(metricsTabs.flatMap(t => [...t.metrics]).sort()).toEqual(seen.sort());
    await select('Tastes');
    const all = container.querySelector('.metrics-fingerprint')!.textContent;
    await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[1].click());
    expect(tabs().find(t => t.getAttribute('aria-selected') === 'true')?.textContent).toBe('Tastes');
    expect(container.querySelector('.metrics-fingerprint')!.textContent).not.toBe(all);
    expect(container.querySelector('.metrics-theme-signature')).toBeNull();
    await act(async() => container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[4].click());
    expect(container.querySelector('.metrics-themes')!.textContent).toContain('No eligible keywords for this selection.');
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
  } finally {await act(async()=>root.unmount());container.remove();}
});
it('supports arrow/Home/End focus, resets on new mount and uses no browser storage',async() => {
  vi.mocked(api.metricsEnrichment).mockResolvedValue({movies:{}});
  const container=document.createElement('div');document.body.appendChild(container);let root=createRoot(container);
  const mount=()=>act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
  const tabs=()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const storage=vi.spyOn(Storage.prototype,'setItem');
  try {
    await mount();tabs()[0].focus();
    for (const [key,index] of [['ArrowRight',1],['End',3],['ArrowRight',0],['ArrowLeft',3],['Home',0]] as const) {
      await act(async()=>{document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));});
      expect(document.activeElement).toBe(tabs()[index]);expect(tabs()[index].getAttribute('aria-selected')).toBe('true');
    }
    await act(async()=>tabs()[2].click());
    await act(async()=>root.unmount());root=createRoot(container);await mount();
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');expect(storage).not.toHaveBeenCalled();
  } finally {storage.mockRestore();await act(async()=>root.unmount());container.remove();}
});
