import type { Catalog } from '../types';
import { catalogIndex } from '../catalog-index';
import { matchesMetricsFilter, type Appearance, type MetricsFilter } from '../metrics-summary';
import { order, percent, facts, frequency, metricsFactReader, emptyEnrichmentMovie, type Fact, type MetricsEnrichment } from './facts';
import { australianClassification } from './classification';

export function comparisonScopes(catalog: Catalog,all: Appearance[],filter: MetricsFilter) {
  if (filter.kind === 'all') return [...catalog.members.filter(m=>m.sort_order>=1 && m.sort_order<=4).sort((a,b)=>a.sort_order-b.sort_order || order(a.id,b.id)).map(m=>({label:m.display_name.toUpperCase(),rows:all.filter(r=>matchesMetricsFilter(r.session,{kind:'member',memberId:m.id}))})),{label:'CLSC',rows:all.filter(r=>matchesMetricsFilter(r.session,{kind:'classics'}))}];
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
export function languageCategories(all: Appearance[],data: MetricsEnrichment): Fact[] {
  return [...frequency(all,metricsFactReader(data,'languages')).values.slice(0,6).map(v => ({id:v.id,label:languageLabel(v.id,v.label)})),{id:'Other',label:'Other'},{id:'Unknown',label:'Unknown'}];
}
