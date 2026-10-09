import { metricsInventory, reportHeadings } from './helpers/metrics-inventory';
// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { selectedAppearances,metricsDashboard,matchesMetricsFilter,type MetricsFilter } from '../shared/metrics';
import { contributorScopes,filterContributorScopes,classificationDistribution,medianEconomicsComparison,nonEnglishLanguageRankings,emptyEnrichmentMovie,type MetricsEnrichment } from '../shared/metrics-enrichment';
import { GenreRevenueReport } from '../frontend/metrics/staging/Evidence';
import { ClassificationChart } from '../frontend/metrics/Profiles';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { api } from '../frontend/api';
import { metricsFixture,metricsFilm,metricsEvent } from './metrics-fixture';
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

it('classification uses each whole appearance distribution, one legend, merged Other/Unknown and a five-percent inline threshold',()=>{
  const films=['G','PG','M','Other','Unknown'].map(id=>metricsFilm(id));
  const catalog={...metricsFixture(),movies:films,sessions:[metricsEvent('distribution',[...Array(80).fill(films[0]),...Array(5).fill(films[1]),...Array(4).fill(films[2]),films[3],...Array(10).fill(films[4])])]};
  const rows=selectedAppearances(catalog);
  const data:MetricsEnrichment={movies:Object.fromEntries(films.map(film=>[film.id,{...emptyEnrichmentMovie(),contentRatings:film.id==='Unknown'?[]:[{certification:film.id,release_type:3}]}]))};
  const distribution=classificationDistribution(rows,data);
  expect(distribution.segments.map(value=>value.percentage)).toEqual([80,5,4,0,0,11]);
  expect(distribution.segments.reduce((sum,value)=>sum+value.percentage,0)).toBe(100);
  const node=document.createElement('div');node.innerHTML=renderToStaticMarkup(createElement(ClassificationChart,{scopes:[{label:'Sean',rows}],data}));
  expect(node.querySelectorAll('.metrics-stack-legend')).toHaveLength(1);
  expect([...node.querySelectorAll('.metrics-segment-percentage')].map(value=>value.textContent)).toEqual(['80.0%','5.0%','11.0%']);
  expect(node.textContent).not.toContain('appearances');expect(node.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('M 4.0%');
  expect(classificationDistribution(rows,{movies:{}}).segments.at(-1)?.percentage).toBe(100);
  node.innerHTML=renderToStaticMarkup(createElement(ClassificationChart,{scopes:[{label:'Sean',rows:[]}],data}));
  expect(node.querySelector('[role=img]')).toBeNull();expect(node.textContent).toContain('No film appearances.');
});

function financialFixture() {
  const movies=['a','b','c','d'].map(id=>metricsFilm(id));
  const catalog={...metricsFixture(),movies,sessions:[metricsEvent('s',[movies[0],movies[1],movies[0]]),metricsEvent('t',[movies[2]],'m2'),metricsEvent('m',[movies[3]],'m3'),metricsEvent('j',[],'m4'),metricsEvent('cl',[movies[2]],null)]};
  const data:MetricsEnrichment={movies:Object.fromEntries(movies.map((film,index)=>[film.id,{...emptyEnrichmentMovie(),metadata:{original_language:null,budget:[100,300,100,0][index],revenue:[1000,null,200,100][index]}}]))};
  return {catalog,data};
}
it('financial medians retain repeat weighting and independent positive coverage, with one full-population maximum',()=>{
  const {catalog,data}=financialFixture();const scopes=contributorScopes(catalog,selectedAppearances(catalog));
  expect(scopes.map(scope=>scope.label)).toEqual(['Sean','Troy','Matt','Jess','Classics']);
  const comparison=medianEconomicsComparison(scopes,data);
  expect(comparison.maximum).toBe(1000);
  expect(comparison.groups[0].report).toMatchObject({budget:{median:100,covered:3},revenue:{median:1000,covered:2}});
  expect(comparison.groups[2].report).toMatchObject({budget:{median:null,covered:0},revenue:{median:100,covered:1}});
  expect(comparison.groups[3].report).toMatchObject({budget:{median:null},revenue:{median:null}});
  expect(medianEconomicsComparison(scopes,{movies:{}}).maximum).toBe(0);
  for(const filter of [{kind:'classics'},{kind:'member',memberId:'m1'}] as MetricsFilter[])expect(filterContributorScopes(comparison.groups,filter)).toHaveLength(1);
});
it('Breakdowns has seventeen ordered reports, one contributor under every filter, stable shared financial widths and the complete Ratings profile',async()=>{
  const {catalog,data}=financialFixture();vi.mocked(api.metricsEnrichment).mockResolvedValue(data);
  const node=document.createElement('div'),root=createRoot(node);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
    expect([...node.querySelectorAll('[role=tab]')].map(tab=>tab.textContent)).toEqual(['Top 5','Tastes','Breakdowns','Records']);
    await act(async()=>[...node.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(tab=>tab.textContent==='Breakdowns')!.click());
    expect(reportHeadings(node)).toEqual(metricsInventory.Breakdowns);
    expect(node.querySelectorAll('.metrics-classification-row')).toHaveLength(5);expect(node.querySelectorAll('.metrics-economics-row')).toHaveLength(5);
    expect(node.querySelectorAll('.metrics-economics-axis')).toHaveLength(1);
    expect([...node.querySelectorAll('.metrics-economics-identity .club-identity')].map(e=>e.textContent)).toEqual(['SEAN','TROY','MATT','JESS','CLSC']);
    expect(node.querySelectorAll('.metrics-budget-heading > span')).toHaveLength(10);
    expect(node.querySelector('.metrics-ratings-heading button')?.getAttribute('aria-label')).toBe('Explain score abbreviations');
    const widths=[...node.querySelectorAll<HTMLElement>('.metrics-economics-row')].map(row=>[...row.querySelectorAll<HTMLElement>('.metrics-distribution-track span')].map(bar=>bar.style.width));
    expect(widths).toEqual([['10%','100%'],['10%','20%'],['0%','10%'],['0%','0%'],['10%','20%']]);
    for(let i=1;i<=5;i++) {
      await act(async()=>node.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[i].click());
      expect(node.querySelectorAll('.metrics-classification-row')).toHaveLength(1);expect(node.querySelectorAll('.metrics-economics-row')).toHaveLength(1);
      expect([...node.querySelectorAll<HTMLElement>('.metrics-economics-row .metrics-distribution-track span')].map(bar=>bar.style.width)).toEqual(widths[i-1]);
      expect(node.querySelector('.metrics-economics-axis')?.getAttribute('aria-label')).toBe('Shared USD axis, zero to 1000');
      expect(node.querySelector('.metrics-classifications,.metrics-median-economics')?.textContent).not.toContain('CLUB');
      const filter:MetricsFilter=i===5?{kind:'classics'}:{kind:'member',memberId:`m${i}`};
      const all=selectedAppearances(catalog),rows=all.filter(row=>matchesMetricsFilter(row.session,filter));
      const ratings=metricsDashboard(rows,all).ratings;
      expect(node.querySelectorAll('.metrics-rating-profile > div')).toHaveLength(9);
      expect([...node.querySelectorAll('.metrics-rating-profile .metrics-distribution-label strong')].map(value=>value.textContent)).toEqual(ratings.map(value=>value.mean===null?'Mean —':`Mean ${value.mean} / 100`));
    }
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);
  }finally{await act(async()=>root.unmount());vi.clearAllMocks();}
});
it('language rankings exclude English/missing/spoken-only evidence, dedupe active canonical films and include alphabetical fifth-place ties',()=>{
  const codes=['ja','fr','de','es','it','ko','ru'];
  const movies=[...codes.flatMap(code=>[metricsFilm(`${code}-1`),metricsFilm(`${code}-2`)]),metricsFilm('english'),metricsFilm('missing'),metricsFilm('deleted'),metricsFilm('candidate')];
  const catalog={...metricsFixture(),movies,sessions:[metricsEvent('one',[...movies.slice(0,14),movies[0],movies[14],movies[15]]),metricsEvent('two',[movies[0]],'m2'),metricsEvent('classic',[movies[1]],null),{...metricsEvent('deleted',[movies[16]]),deleted_at:'2026-01-02'}]};
  const data:MetricsEnrichment={movies:Object.fromEntries(movies.map(film=>[film.id,{...emptyEnrichmentMovie(),metadata:{original_language:film.id==='missing'?null:film.id==='english'?'en':film.id.split('-')[0],budget:null,revenue:null},languages:[{code:'ja',name:'Japanese',english_name:'Japanese'}]}]))};
  const all=selectedAppearances(catalog),report=nonEnglishLanguageRankings(all,data);
  expect(report.maximum).toBe(2);expect(report.values).toHaveLength(7);expect(report.values.every(value=>value.count===2)).toBe(true);
  expect(report.values.map(value=>value.label)).toEqual(['French','German','Italian','Japanese','Korean','Russian','Spanish']);
  expect(nonEnglishLanguageRankings(all.filter(row=>row.session.host_member_id==='m2'),data).values).toEqual([expect.objectContaining({id:'ja',count:1})]);
  expect(nonEnglishLanguageRankings(all.filter(row=>row.session.kind==='classics'),data).values).toEqual([expect.objectContaining({id:'ja',count:1})]);
  expect(nonEnglishLanguageRankings(all,{movies:{}})).toEqual({maximum:0,values:[]});
  expect(nonEnglishLanguageRankings([...all].reverse(),data)).toEqual(report);
});
it('language bars use the winning film count, alternating colours and readable formatted counts',async()=>{
  const movies=['a','b','c'].map(id=>metricsFilm(id));const data:MetricsEnrichment={movies:Object.fromEntries(movies.map((film,index)=>[film.id,{...emptyEnrichmentMovie(),metadata:{original_language:index===2?'fr':'ja',budget:null,revenue:null}}]))};
  vi.mocked(api.metricsEnrichment).mockResolvedValue(data);const node=document.createElement('div'),root=createRoot(node);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:{...metricsFixture(),movies,sessions:[metricsEvent('s',[...movies,movies[0]])]},viewer:null,onUpdated:async()=>{}})));
    expect(node.querySelector('.metrics-panel')?.lastElementChild?.getAttribute('data-metric')).toBe('L');
    expect([...node.querySelectorAll<HTMLElement>('.metrics-non-english .metrics-distribution-track span')].map(bar=>bar.style.width)).toEqual(['100%','50%']);
    expect([...node.querySelectorAll<HTMLElement>('.metrics-non-english .metrics-enriched-row')].map(row=>row.style.getPropertyValue('--chart-colour'))).toEqual(['var(--jeans)','var(--lavender)']);
    expect(node.querySelector('.metrics-non-english')?.textContent).toContain('Japanese2 films');expect(node.querySelector('.metrics-non-english')?.textContent).toContain('French1 film');
  }finally{await act(async()=>root.unmount());vi.clearAllMocks();}
});

it.each([1,5,8])('keeps all %s genre gross rows inside the keyboard-scrollable window without pagination',count=>{
 const genres=['Action','Adventure','Animation','Comedy','Crime','Drama','Fantasy','Horror'].slice(0,count);
 const movies=['a','b'].map(id=>metricsFilm(id,{genres})),catalog={...metricsFixture(),movies,sessions:[metricsEvent('gross',movies)]};
 const all=selectedAppearances(catalog),data={movies:Object.fromEntries(movies.map(m=>[m.id,{...emptyEnrichmentMovie(),metadata:{original_language:null,budget:100,revenue:125000000}}]))};
 const node=document.createElement('div');node.innerHTML=renderToStaticMarkup(createElement(GenreRevenueReport,{catalog,all,rows:all,filter:{kind:'all'},data}));
 expect(node.querySelector('.staging-revenue-scroll')?.getAttribute('tabindex')).toBe('0');expect(node.querySelector('.staging-revenue-scroll')?.getAttribute('role')).toBe('region');expect(node.querySelectorAll('tbody tr')).toHaveLength(count);expect(node.querySelectorAll('tbody a')).toHaveLength(count*2);expect(node.querySelectorAll('button')).toHaveLength(0);expect(node.textContent).toContain('$125M USD');
});
