// @vitest-environment jsdom
import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { orderedCycleEvents,cycleHostSequence } from '../shared/history-order';
import { glossaryExample,sourceRatingKeys } from '../shared/rating-dimensions';
import { selectedAppearances,extremesCabinet } from '../shared/metrics';
import { metricsFixture,metricsFilm,metricsEvent } from './metrics-fixture';
import { emptyEnrichmentMovie,stackedProfile } from '../shared/metrics-enrichment';
import { ClassificationChart } from '../frontend/metrics/Profiles';
import { Navigation } from '../frontend/Navigation';
import { isUnrankedClassic } from '../frontend/ClassicsScreen';

it('orders actual swapped hosts and sparse/legacy events without inventing the roster',()=>{
  const catalog=metricsFixture();catalog.sessions=[2,1,5].map((slot,i)=>({...metricsEvent(`e${i}`,[],slot===5?null:['m2','m1'][i]),cycle_id:'c',cycle_slot:slot}));
  catalog.members=[{id:'m1',display_name:'Sean',sort_order:1,active:1},{id:'m2',display_name:'Troy',sort_order:2,active:1}];
  expect(orderedCycleEvents(catalog.sessions,false).map(s=>s.cycle_slot)).toEqual([5,2,1]);
  expect(orderedCycleEvents(catalog.sessions,true).map(s=>s.cycle_slot)).toEqual([1,2,5]);
  expect(cycleHostSequence(catalog,'c').map(s=>s.label)).toEqual(['Sean','Troy','Classics']);
  catalog.sessions[0].host_member_id='m1';catalog.sessions[1].host_member_id='m2';
  expect(cycleHostSequence(catalog,'c').map(s=>s.label)).toEqual(['Troy','Sean','Classics']);
  expect(orderedCycleEvents(catalog.sessions.filter(s=>s.host_member_id==='m1'),false).map(s=>s.cycle_slot)).toEqual([2]);
  catalog.sessions.push({...catalog.sessions[0],id:'legacy',cycle_slot:null,host_member_id:null});
  expect(cycleHostSequence(catalog,'c').at(-1)).toMatchObject({label:'Host unknown',positionKnown:false});
  catalog.sessions[0].deleted_at='2026-10-08';expect(cycleHostSequence(catalog,'c')).toHaveLength(3);
});
it('selects Newest by valid date and Shortest by positive runtime, preserving unique ties',()=>{
  const movies=[metricsFilm('a',{release_date:'2026-01-01',runtime:1}),metricsFilm('b',{release_date:'2026-01-01',runtime:1}),metricsFilm('invalid',{release_date:'2026-02-30',runtime:0}),metricsFilm('absent',{release_date:null,runtime:null})];
  const catalog={...metricsFixture(),movies,sessions:[metricsEvent('s',[...movies,movies[0]])]};
  const report=extremesCabinet(selectedAppearances(catalog));
  expect(report.newest?.items.map(r=>r.movie.id)).toEqual(['a','b']);expect(report.shortest?.items.map(r=>r.movie.id)).toEqual(['a','b']);
  movies[0].runtime=NaN;movies[1].runtime=-1;expect(extremesCabinet(selectedAppearances(catalog)).shortest).toBeNull();
});
describe('native glossary examples',()=>{
  const expected=[['9.9 / 10','99%'],['4.5 / 5','90%'],['9.9 / 10','99%'],['99 / 100','99%'],['9.5 / 10','95%'],['9 / 10','90%'],['3.5 / 4','87.5%'],['99 / 100','99%'],['99 / 100','99%']];
  it.each(sourceRatingKeys.map((key,i)=>({key,expected:expected[i]})))('$key uses a valid native increment',({key,expected})=>{const e=glossaryExample(key);expect([e.native,e.normalised]).toEqual(expected);});
});
it('groups Other/Unknown only in classification presentation and retains the known denominator',()=>{
  const movies=['G','PG','M','MA15+','R18+','Other','Unknown'].map(id=>metricsFilm(id));
  const catalog={...metricsFixture(),movies,sessions:[metricsEvent('s',movies)]};const rows=selectedAppearances(catalog);
  const data={movies:Object.fromEntries(movies.map(m=>[m.id,{...emptyEnrichmentMovie(),contentRatings:m.id==='Unknown'?[]:[{certification:m.id,release_type:3}]}]))};
  const profile=stackedProfile(rows,data,'classification');expect(profile.counts.get('Other')).toBe(1);expect(profile.counts.get('Unknown')).toBe(1);expect(profile.headline).toBeCloseTo(100/3);
  const html=renderToStaticMarkup(createElement(ClassificationChart,{scopes:[{label:'Club',rows}],data}));
  const container=document.createElement('div');container.innerHTML=html;const bars=container.querySelectorAll('.metrics-stack-bar > span');expect(bars).toHaveLength(6);expect(bars[5].textContent).toContain('28.6%');expect(container.textContent).not.toContain('appearances');expect(bars[5].getAttribute('style')).toContain('asphalt');expect(container.querySelector('[role=img]')?.getAttribute('aria-label')).toContain('Other/Unknown 28.6%');
});
it.each([0,1,9,99,100,126].flatMap(count=>[true,false].map(expanded=>({count,expanded}))))('desktop Seen count $count expanded=$expanded is exact accessibly, capped visually and absent from the dock',({count,expanded})=>{
  const node=document.createElement('div');node.innerHTML=renderToStaticMarkup(createElement(Navigation,{page:'classics',expanded,onToggle:()=>{},missingAnswersCount:count}));
  expect(node.querySelector('.desktop-navigation a[href="#/classics"] .count-indicator')).toBeNull();
  expect(node.querySelectorAll('.bottom-nav .count-indicator')).toHaveLength(0);const badge=node.querySelector('.desktop-navigation .count-indicator');
  if(count){expect(badge?.textContent).toBe(count>99?'99+':String(count));expect(badge?.parentElement?.getAttribute('aria-label')).toBe(`Seen: ${count} missing ${count===1?'answer':'answers'}`);}else expect(badge).toBeNull();
  expect(isUnrankedClassic(metricsFilm('a',{ranking:null}))).toBe(false);
});
