// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { it,expect,vi,afterEach } from 'vitest';
import { MetricsScreen } from '../frontend/MetricsScreen';
import Staging from '../frontend/metrics/Staging';
import * as overlapCalculations from '../shared/metrics-staging/overlap';
import { api } from '../frontend/api';
import { selectedAppearances } from '../shared/metrics';
import { metricsFixture,metricsEvent,observation } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(()=>{vi.resetAllMocks();vi.restoreAllMocks();});
const headings=['Cycle scorecards','Release-year spread','Runtime spread','Critics or audiences?','Top 5 genre combinations','Genre taste overlap','First shared theme','Shared stars','Creative partnerships','Highest-grossing film by genre','Expensive flops','Classification versus acclaim','Streaming platform representation','Top 5 hidden gems','Top 5 most cult','Franchise / collection spotlight','Awards and nominations'];
it('renders all 17 independent reports, all five tabs and every Records addition without additional reads',async()=>{
  const combinations=vi.spyOn(overlapCalculations,'genreCombinations');
  const catalog=metricsFixture(),data=metricsEnrichmentFixture();
  catalog.movies[0].scores=[observation('metacritic','critic',60,100),observation('imdb','rating',8,10,250)];
  catalog.movies[0].au_watch_offers=[{service_id:'1',name:'Fictional service',access_type:'subscription',link:null}];
  data.movies.a.collection={status:'checked_present',external_id:'1',checked_at:'2026',collection_id:123,collection_name:'Fictional collection'};
  data.movies.a.awards={status:'checked_quantified',external_id:'tt1',checked_at:'2026',wins:0,nominations:3,awards_text:'0 wins & 3 nominations.'};
  catalog.movies[0].classic=true;catalog.movies[0].seen=catalog.members.map(m=>({member_id:m.id,seen:1,updated_at:''}));
  vi.mocked(api.metricsEnrichment).mockResolvedValue(data);
  const container=document.createElement('div'),root=createRoot(container);document.body.appendChild(container);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
    const tabs=[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')];expect(tabs.map(t=>t.textContent)).toEqual(['Top 5','Tastes','Breakdowns','Records','Staging']);
    await act(async()=>tabs[4].click());
    // Resolve the actual dynamic import without a timing-based sleep.
    await act(async()=>{await import('../frontend/metrics/Staging');});
    expect([...container.querySelectorAll('.staging-report > h2')].map(h=>h.textContent)).toEqual(headings);
    expect(container.textContent).toContain('Fictional collection');expect(container.textContent).toContain('0 wins & 3 nominations.');expect(container.textContent).toContain('Fictional service');
    expect(container.querySelector('[aria-label="Top 5 most cult"] a')).not.toBeNull();expect(container.querySelector('[aria-label="Top 5 hidden gems"] a')).not.toBeNull();expect(container.querySelector('[role="table"][aria-label="Reliably quantified OMDb awards"]')).not.toBeNull();
    expect(container.querySelectorAll('.staging-matrix tbody tr')).toHaveLength(10);expect(container.querySelectorAll('.staging-matrix td[aria-label]')).toHaveLength(50);
    expect(container.querySelectorAll('.staging-matrix td[title]')).toHaveLength(50);
    const originalAxes=[...container.querySelectorAll('[aria-label^="Shared"]')].map(n=>n.getAttribute('aria-label'));
    await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[1].click());
    expect([...container.querySelectorAll('[aria-label^="Shared"]')].map(n=>n.getAttribute('aria-label'))).toEqual(originalAxes);
    expect(container.querySelectorAll('.staging-chart-row')).toHaveLength(3);expect(container.querySelectorAll('.staging-matrix tbody tr')).toHaveLength(10);expect(container.querySelector('[data-emphasis=true]')).not.toBeNull();
    await act(async()=>tabs[3].click());
    expect(container.querySelectorAll('.metrics-film-extreme')).toHaveLength(10);expect(container.querySelectorAll('.metrics-reception-record')).toHaveLength(2);expect(container.querySelectorAll('.metrics-viewed-record')).toHaveLength(2);
    expect(container.textContent).toContain('Most aligned critics and audiences');expect(container.textContent).toContain('Most misaligned critics and audiences');expect(container.textContent).toContain('Most Classics viewed');expect(container.textContent).toContain('Least Classics viewed');
    await act(async()=>tabs[1].click());expect(container.querySelector('.metrics-fingerprint')).not.toBeNull();
    await act(async()=>tabs[2].click());expect(container.textContent).toContain('Ratings profile');
    await act(async()=>tabs[0].click());expect(container.querySelector('.metrics-rankings')).not.toBeNull();
    await act(async()=>tabs[4].click());expect(combinations).toHaveBeenCalledTimes(2);
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  } finally {await act(async()=>root.unmount());container.remove();}
});
it('keeps every complete historical cycle in a named keyboard-scrollable region and missing reports truthful',async()=>{
  const catalog=metricsFixture();catalog.cycles=Array.from({length:8},(_,i)=>({id:`cycle${i}`,ordinal:i+1,rough_date:'2026-01-01',title:null,import_source:'fixture',import_key:`cycle${i}`,created_at:'',updated_at:''}));
  catalog.sessions=catalog.cycles.flatMap(c=>Array.from({length:5},(_,i)=>({...metricsEvent(`${c.id}-${i}`,[catalog.movies[0]],i===4?null:`m${i+1}`),cycle_id:c.id,cycle_slot:i+1})));
  const all=selectedAppearances(catalog),container=document.createElement('div'),root=createRoot(container);
  try {
    await act(async()=>root.render(createElement(Staging,{catalog,all,rows:all,filter:{kind:'all'},data:{movies:{}}})));
    const cycles=container.querySelector('.staging-cycles')!;expect(cycles.getAttribute('tabindex')).toBe('0');expect(cycles.getAttribute('role')).toBe('region');expect(cycles.children).toHaveLength(8);expect(cycles.firstElementChild?.textContent).toContain('Cycle 8');expect(cycles.lastElementChild?.textContent).toContain('Cycle 1');
    expect(container.querySelector('[aria-label="Awards and nominations"]')?.textContent).toContain('0 of 1 distinct films checked');
    expect(container.querySelector('[aria-label="Franchise / collection spotlight"]')?.textContent).toContain('1 unknown');
    expect(container.querySelector('[aria-label="Shared stars"]')?.textContent).toContain('No qualifying evidence');expect(container.querySelector('[aria-label="Streaming platform representation"]')?.textContent).toContain('Cached Australian availability');
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  } finally {await act(async()=>root.unmount());}
});
