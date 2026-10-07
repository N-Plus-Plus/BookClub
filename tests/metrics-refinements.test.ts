// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import { compositeScore,metricsScoreDimensions,selectedAppearances,withCutoffTies,extremesCabinet } from '../shared/metrics';
import { comparisonWidths,ratingCircleFills } from '../frontend/MetricsVisuals';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import { metricsFilm,metricsEvent,metricsFixture,observation } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
import { revenueRatioRankings,emptyEnrichmentMovie } from '../shared/metrics-enrichment';
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
it('normalises selected and club bars defensively',()=>{
  expect(comparisonWidths(1.7)).toEqual({selected:100,club:100/1.7});
  expect(comparisonWidths(4.8).club).toBeCloseTo(20.833);
  expect(comparisonWidths(.5)).toEqual({selected:50,club:100});
  expect(comparisonWidths(0)).toEqual({selected:0,club:100});
});
it.each([[80,8,1],[83,9,.3],[87.5,9,.75],[100,10,1],[0,0,undefined]])('circles represent mean %s exactly',(mean,length,last)=>{
  const fills=ratingCircleFills(mean!);expect(fills).toHaveLength(length!);expect(fills.at(-1)).toBe(last);
  expect(fills.slice(0,-1).every(f=>f===1)).toBe(true);
});
it('cutoff includes every fifth-place tie and handles small lists',()=>{
  expect(withCutoffTies([10,8,7,7,6,6,6,6,6],n=>n)).toHaveLength(9);
  expect(withCutoffTies([10,8,7,6,5,4],n=>n)).toEqual([10,8,7,6,5]);
  expect(withCutoffTies([2,1],n=>n)).toEqual([2,1]);expect(withCutoffTies([],Number)).toEqual([]);
});
it.each(metricsScoreDimensions)('uses genuine normalised $id in its composite',d=>{
  const kind=['metacritic','rt-critic','ebert'].includes(d.id)?'critic':'audience';
  const movie=metricsFilm('a',{scores:[observation(d.provider,d.metric,d.scale*.8,d.scale)]});
  expect(compositeScore(movie,kind)).toBeCloseTo(80);
  expect(compositeScore(movie,kind==='critic'?'audience':'critic')).toBeNull();
});
it('averages available scores without zeros/imputation and preserves all unique extreme ties',()=>{
  const scores=[observation('imdb','rating',8,10),observation('letterboxd','rating',3,5)];
  const a=metricsFilm('a',{scores}),b=metricsFilm('b',{scores});
  expect(compositeScore(a,'audience')).toBe(70);expect(compositeScore(metricsFilm('c',{scores:[]}),'audience')).toBeNull();
  const catalog={...metricsFixture(),movies:[a,b],sessions:[metricsEvent('s',[a,a,b])]};
  const report=extremesCabinet(selectedAppearances(catalog));
  expect(report.topAudience?.items.map(r=>r.movie.id)).toEqual(['a','b']);expect(report.bottomAudience?.value).toBe(70);
});
it('ratios exclude nonpositive money, dedupe repeats and sort exact cutoff ties stably',()=>{
  const movies=Array.from({length:9},(_,i)=>metricsFilm(String(i)));
  const catalog={...metricsFixture(),movies,sessions:[metricsEvent('s',[...movies,movies[0]])]};
  const data={movies:Object.fromEntries(movies.map((movie,i)=>[movie.id,{...emptyEnrichmentMovie(),metadata:{original_language:null,budget:i===8?0:100,revenue:[1000,800,700,600,500,500,400,-1,900][i]}}]))};
  const report=revenueRatioRankings(selectedAppearances(catalog),data);
  expect(report).toMatchObject({covered:7,unique:9});
  expect(report.top.map(p=>p.ratio)).toEqual([10,8,7,6,5,5]);
  expect(report.bottom.map(p=>p.ratio)).toEqual([4,5,5,6,7]);
  expect(report.top.filter(p=>p.ratio===5).map(p=>p.movie.id)).toEqual(['4','5']);
});
it('Cast preserves all fifth-place ties without changing appearance counts',async()=>{
  const counts=[10,8,7,7,6,6,6,6,6];
  const movies=Array.from({length:10},(_,i)=>metricsFilm(String(i)));
  const data={movies:Object.fromEntries(movies.map((movie,index)=>[movie.id,{...emptyEnrichmentMovie(),credits:counts.flatMap((count,i)=>index<count?[{kind:'cast',role:'cast',person_id:String(i),name:`Person ${i}`}]:[])}]))};
  vi.mocked(api.metricsEnrichment).mockResolvedValue(data);
  const container=document.createElement('div'),root=createRoot(container);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...metricsFixture(),movies,sessions:[metricsEvent('s',movies)]},viewer:null,onUpdated:async()=>{}})));
    await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent==='Fingerprints')!.click());
    expect(container.querySelectorAll('.metrics-talent-row')).toHaveLength(9);
    expect([...container.querySelectorAll('.metrics-talent-row')].slice(4).map(e=>e.textContent)).toEqual(Array.from({length:5},(_,i)=>`Person ${i+4}6 appearances · 60.0%`));
  } finally {await act(async()=>root.unmount());vi.clearAllMocks();}
});
it('renders revised visuals, stable colours, readable coverage and linked ratios without refetch',async()=>{
  vi.mocked(api.metricsEnrichment).mockResolvedValue(metricsEnrichmentFixture());
  const container=document.createElement('div'),root=createRoot(container);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:metricsFixture(),viewer:null,onUpdated:async()=>{}})));
    const tab=async(name:string)=>act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===name)!.click());
    await tab('Fingerprints');expect(container.querySelectorAll('.metrics-comparison-bars').length).toBeGreaterThan(0);
    expect(container.querySelector('.metrics-five-scroll')).not.toBeNull();
    await tab('General Interest');expect(container.querySelectorAll('.metrics-decades .metrics-stack-bar')).toHaveLength(1);
    expect(container.querySelectorAll('.metrics-classifications .metrics-distribution-track').length).toBeGreaterThan(0);
    await tab('Averages');expect(container.querySelector('.metrics-rating-circles')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.metrics-rating-profile')?.textContent).toMatch(/Mean.*Median.*scored/);
    const colours=(selector:string)=>[...container.querySelectorAll<HTMLElement>(selector)].map(e=>e.style.getPropertyValue('--chart-colour'));
    for(const key of ['budget','revenue']) expect(colours(`.metrics-median-${key} .metrics-enriched-row`)).toEqual(['var(--jeans)','var(--lavender)','var(--jeans)','var(--lavender)','var(--jeans)']);
    await tab('Taste Diversity');for(const section of container.querySelectorAll('.metrics-diversity section')) {expect(section.querySelector('h3 + .meta')?.textContent).toMatch(/per 10/);expect([...section.querySelectorAll<HTMLElement>('.metrics-enriched-row')].map(e=>e.style.getPropertyValue('--chart-colour'))).toEqual(['var(--jeans)','var(--lavender)','var(--jeans)','var(--lavender)','var(--jeans)']);}
    await tab('Economics / Standalone');expect(container.querySelector('.metrics-revenue-ratios svg')).toBeNull();expect(container.querySelector('.metrics-revenue-ratios')?.textContent).toContain('7 / 10 unique films');
    expect(container.querySelector('.metrics-ratio-list a')?.getAttribute('href')).toMatch(/^#\/movie\//);
    await tab('Extremes');expect(container.textContent).not.toMatch(/Highest IMDb|Lowest IMDb|Cinematographer known for/);
    for(const name of ['Top Critic','Top Audience','Bottom Critic','Bottom Audience']) expect(container.textContent).toContain(name);
    expect(container.querySelector('.metrics-creator-extreme > .meta')).not.toBeNull();
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
  } finally {await act(async()=>root.unmount());}
});
