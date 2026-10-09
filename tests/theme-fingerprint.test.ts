import {expect,it} from 'vitest';
import {themeFingerprint,emptyEnrichmentMovie,contributorScopes,type MetricsEnrichment} from '../shared/metrics-enrichment';
import {fingerprint} from '../shared/metrics-enrichment';
import {themeReader} from '../shared/metrics-enrichment/facts';
import {themeDistinctiveness} from '../shared/metrics-enrichment/fingerprints';
import {selectedAppearances} from '../shared/metrics';
import {metricsFixture,metricsFilm,metricsEvent} from './metrics-fixture';

function fixture(total=60) {
  const catalog=metricsFixture();catalog.movies=[];catalog.sessions=[];
  const data:MetricsEnrichment={movies:{}};
  for(let c=0;c<5;c++){
    const films=Array.from({length:total},(_,i)=>{
      const film=metricsFilm(`${c}-${i}`);
      const names=[...(i<total/2?['blood','murder','death','violence',...Array.from({length:8},(_,n)=>`common theme ${n}`)]:[]),...(i<12?[`signature ${c}`]:[]),...(i<4?[`supported ${c}`]:[]),...(i<2?[`rare ${c}`]:[])];
      data.movies[film.id]={...emptyEnrichmentMovie(),keywords:names.flatMap(name=>[{provider:'tmdb',name},{provider:'mdblist',name:name.toUpperCase()}])};return film;
    });
    catalog.movies.push(...films);catalog.sessions.push(metricsEvent(`c${c}`,films,c===4?null:`m${c+1}`));
  }
  return {catalog,data,all:selectedAppearances(catalog)};
}
it('promotes supported concentrations across all five scopes, with unchanged counts and whole-club ratios',()=>{
  const {catalog,data,all}=fixture();
  const reports=contributorScopes(catalog,all).map(scope=>themeFingerprint(scope.rows,all,data));
  for(const [i,scope] of contributorScopes(catalog,all).entries()){
    const report=reports[i];
    expect(report.values.map(v=>[v.id,v.count,v.ratio])).toEqual([[`signature ${i}`,12,5],[`supported ${i}`,4,5]]);
    expect(report.values.every(v=>Number.isFinite(v.distinctiveness)&&v.distinctiveness>0)).toBe(true);
    expect(themeFingerprint(selectedAppearances(catalog,scope.filter),all,data)).toEqual(report);
    expect(themeFingerprint([...scope.rows].reverse(),[...all].reverse(),data)).toEqual(report);
  }
});
it('enforces support at four or three percent and handles zero/small populations',()=>{
  for(const total of [60,100,200]){const minimum=Math.max(4,Math.ceil(.03*total));expect(themeDistinctiveness(minimum,total,0,240)).toBeGreaterThan(0);expect(themeDistinctiveness(minimum-1,total,0,240)).toBeNull();}
  for(const args of [[0,0,0,0],[4,4,0,0],[2,2,0,10],[4,60,16,240],[4,60,30,240],[NaN,60,0,240],[4,60,Infinity,240]])expect(themeDistinctiveness(...args as [number,number,number,number])).toBeNull();
  const {all,data}=fixture(2);expect(themeFingerprint(all.slice(0,2),all,data).values).toEqual([]);expect(themeFingerprint([],all,data).values).toEqual([]);expect(themeFingerprint(all,all,data).values).toEqual([]);
});
it('retains repeated appearances and the same canonical movie brought by different contributors',()=>{
  const {catalog,data}=fixture();const shared=catalog.movies[0];
  data.movies[shared.id].keywords=[{provider:'tmdb',name:'blood'}];
  catalog.sessions=[metricsEvent('self',Array(8).fill(shared),'m1'),metricsEvent('other',[shared,...Array(19).fill(catalog.movies[59])],'m2')];
  const all=selectedAppearances(catalog),rows=selectedAppearances(catalog,{kind:'member',memberId:'m1'});
  const result=themeFingerprint(rows,all,data).values[0];expect(result).toMatchObject({id:'blood',count:8});expect(result.ratio).toBeCloseTo(28/9);expect(result.distinctiveness).toBeCloseTo(themeDistinctiveness(8,8,1,20)!);
});
it('caps at twelve with stable labels/IDs, count ties, and frequency as the second ordering key',()=>{
  const {catalog,data,all}=fixture();const rows=selectedAppearances(catalog,{kind:'member',memberId:'m1'});
  const names=Array.from({length:14},(_,i)=>`theme ${String(i).padStart(2,'0')}`);
  for(const [i,row] of rows.entries())data.movies[row.movie.id].keywords=i<4?names.map(name=>({provider:'tmdb',name})):[];
  const result=themeFingerprint(rows,all,data);expect(result.values.map(v=>v.id)).toEqual(names.slice(0,12));expect(themeFingerprint([...rows].reverse(),[...all].reverse(),data)).toEqual(result);
});

it('reproduces the captured old/new diagnostic for each contributor',()=>{
  const {catalog,data,all}=fixture();
  for(const [i,scope] of contributorScopes(catalog,all).entries()){
    const old=fingerprint(scope.rows,all,themeReader(data),{limit:12});
    expect(old.values).toHaveLength(12);expect(old.values.every(v=>v.count===30&&v.ratio===1)).toBe(true);
    const result=themeFingerprint(scope.rows,all,data);
    expect(result.values.map(v=>v.id)).toEqual([`signature ${i}`,`supported ${i}`]);
    expect(result.values[0].distinctiveness).toBeCloseTo(15.626075702184513);
    expect(result.values[1].distinctiveness).toBeCloseTo(9.0217190130337);
  }
});
it('supports disproportionate themes shared with peers rather than requiring uniqueness',()=>{
  const {catalog,data,all}=fixture();
  for(const row of all.slice(60,66))data.movies[row.movie.id].keywords.push({provider:'tmdb',name:'signature 0'});
  const rows=selectedAppearances(catalog,{kind:'member',memberId:'m1'}),result=themeFingerprint(rows,all,data).values.find(v=>v.id==='signature 0')!;
  expect(result.count).toBe(12);expect(result.ratio).toBeCloseTo(10/3);expect(result.distinctiveness).toBeCloseTo(themeDistinctiveness(12,60,6,240)!);
});
