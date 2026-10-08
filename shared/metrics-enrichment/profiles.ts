import { uniqueAppearances, withCutoffTies, genreColour } from '../metrics';
import type { Catalog } from '../types';
import { catalogIndex } from '../catalog-index';
import { matchesMetricsFilter, type Appearance, type MetricsFilter } from '../metrics-summary';
import { order, percent, facts, frequency, metricsFactReader, emptyEnrichmentMovie, type MetricsEnrichment } from './facts';
import { australianClassification, auCategories } from './classification';

export function comparisonScopes(catalog: Catalog,all: Appearance[],filter: MetricsFilter) {
  if (filter.kind === 'all') return contributorScopes(catalog,all).map(scope=>({label:scope.filter.kind==='classics'?'CLSC':scope.label.toUpperCase(),rows:scope.rows}));
  const selected = filter.kind === 'classics' ? 'CLSC' : catalogIndex(catalog).memberById.get(filter.memberId)?.display_name.toUpperCase() || 'Selected';
  return [{label:selected,rows:all.filter(r => matchesMetricsFilter(r.session,filter))},{label:'CLUB',rows:all}];
}
export function stackedProfile(rows: Appearance[],data: MetricsEnrichment,dimension: 'language' | 'classification') {
  const counts = new Map<string,number>(); let covered = 0, headline = 0;
  for (const row of rows) {
    const value = dimension === 'language' ? facts(row,data,'languages')[0]?.id || 'Unknown' : australianClassification(data.movies[row.movie.id] ?? emptyEnrichmentMovie());
    counts.set(value,(counts.get(value) ?? 0)+1);
    if (value !== 'Unknown') { covered++; if (dimension === 'language' ? value !== 'en' : ['MA15+','R18+'].includes(value)) headline++; }
  }
  return {counts,covered,total:rows.length,headline:covered ? percent(headline,covered) : null};
}
const languageNames = new Intl.DisplayNames(['en'],{type:'language',fallback:'none'});
function languageLabel(code:string,fallback:string) {
  try { return languageNames.of(code) || fallback; } catch { return fallback; }
}


/** Five positional contributors; no club comparison row. */
export function contributorScopes(catalog:Catalog,all:Appearance[]) {
  return [...catalog.members.filter(m=>m.sort_order>=1 && m.sort_order<=4).sort((a,b)=>a.sort_order-b.sort_order || order(a.id,b.id)).map(member=>({label:member.display_name,filter:{kind:'member',memberId:member.id} as MetricsFilter,rows:all.filter(row=>matchesMetricsFilter(row.session,{kind:'member',memberId:member.id}))})),
    {label:'Classics',filter:{kind:'classics'} as MetricsFilter,rows:all.filter(row=>matchesMetricsFilter(row.session,{kind:'classics'}))}];
}
export function filterContributorScopes<T extends {filter:MetricsFilter}>(scopes:T[],filter:MetricsFilter):T[] {
  return filter.kind==='all'?scopes:scopes.filter(scope=>scope.filter.kind===filter.kind && (filter.kind!=='member' || scope.filter.kind==='member' && scope.filter.memberId===filter.memberId));
}
export const classificationCategories = [...auCategories.filter(id=>id!=='Other' && id!=='Unknown').map(id=>({id,label:id,colour:genreColour(id)})),{id:'Other/Unknown',label:'Other/Unknown',colour:'asphalt'}];
export function classificationDistribution(rows:Appearance[],data:MetricsEnrichment) {
  const profile=stackedProfile(rows,data,'classification');
  return {total:profile.total,segments:classificationCategories.map(category=>{
    const count=category.id==='Other/Unknown'?(profile.counts.get('Other') ?? 0)+(profile.counts.get('Unknown') ?? 0):profile.counts.get(category.id) ?? 0;
    return {...category,percentage:percent(count,profile.total)};
  })};
}
/** Original language only, one opportunity per canonical film; English/missing never qualify. */
export function nonEnglishLanguageRankings(rows:Appearance[],data:MetricsEnrichment) {
  const read=metricsFactReader(data,'languages');
  const values=frequency(uniqueAppearances(rows),row=>read(row).filter(fact=>fact.id!=='en')).values.map(value=>({...value,label:languageLabel(value.id,value.label)}));
  values.sort((a,b)=>b.count-a.count || order(a.label,b.label) || order(a.id,b.id));
  return {maximum:Math.max(0,...values.map(value=>value.count)),values:withCutoffTies(values,value=>value.count)};
}
