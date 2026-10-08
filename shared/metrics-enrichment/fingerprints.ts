import { isThemeKeyword, themeDisplayLabel } from '../theme-keywords';
import { genreColour, uniqueAppearances, withCutoffTies, type Appearance } from '../metrics';
import { frequency, metricsFactReader, themeReader, themes, order, percent, type FactReader, type Frequency, type MetricsEnrichment } from './facts';

export function fingerprint(rows: Appearance[],all: Appearance[],read: FactReader,options: {distinctive?:boolean; minimum?:number; limit?:number; qualifyingShare?:boolean} = {}) {
  const selected = frequency(rows,read), baseline = frequency(all,read);
  const denominator = options.qualifyingShare ? selected.covered : rows.length;
  const clubDenominator = options.qualifyingShare ? baseline.covered : all.length;
  const club = new Map(baseline.values.map(v => [v.id,v.count]));
  const values: Frequency[] = selected.values.filter(v => v.count >= (options.minimum ?? 1)).map(v => {
    const percentage = percent(v.count,denominator), clubShare = percent(club.get(v.id) ?? 0,clubDenominator);
    return {...v,percentage,ratio:clubShare ? percentage/clubShare : null,colour:genreColour(v.id)};
  });
  values.sort((a,b) => (options.distinctive ? (b.ratio ?? 0)-(a.ratio ?? 0) || b.percentage-a.percentage : 0) || b.count-a.count || order(a.label,b.label) || order(a.id,b.id));
  return {covered:selected.covered,distinct:selected.values.length,values:values.slice(0,options.limit ?? 10)};
}
/** Frequency selects exactly twelve at most; club ratios describe rather than rank themes. */
export function themeFingerprint(rows: Appearance[],all: Appearance[],data: MetricsEnrichment) {
  return fingerprint(rows,all,themeReader(data),{limit:12});
}
/** Safe aggregate diagnostic; no movie IDs, titles, provenance or private rows are returned. */
export function themeKeywordAudit(data: MetricsEnrichment,rows: Appearance[] = []) {
  const raw = new Set<string>();
  const identities = new Map<string,{id:string;label:string;films:number}>();
  for (const movie of Object.values(data.movies)) {
    for (const keyword of movie.keywords) raw.add(keyword.name);
    for (const fact of themes(movie)) {
      const old = identities.get(fact.id);
      identities.set(fact.id,{...fact,films:(old?.films ?? 0)+1});
    }
  }
  const values = [...identities.values()].sort((a,b) => b.films-a.films || order(a.id,b.id));
  const excluded = values.filter(f => !isThemeKeyword(f.id));
  const included = values.filter(f => isThemeKeyword(f.id));
  return {rawLabels:raw.size,normalisedIdentities:values.length,excludedIdentities:excluded.length,includedIdentities:included.length,
    topExcluded:excluded.slice(0,20).map(f => ({label:f.label,films:f.films})),
    topIncluded:included.slice(0,20).map(f => ({label:themeDisplayLabel(f.label),films:f.films})),
    fingerprint:themeFingerprint(rows,rows,data).values.map(f => ({label:f.label,count:f.count}))};
}

/** Frequency rankings retain every actual fifth-place count tie, in stable label/ID order. */
export function topFrequency(rows:Appearance[],all:Appearance[],read:FactReader,qualifyingShare=false) {
  const report=fingerprint(rows,all,read,{qualifyingShare,limit:Infinity});
  return {...report,values:withCutoffTies(report.values,value=>value.count)};
}
export function productionCountryRankings(rows:Appearance[],data:MetricsEnrichment) {
  const unique=uniqueAppearances(rows);
  return {...topFrequency(unique,unique,metricsFactReader(data,'countries')),unique:unique.length};
}
