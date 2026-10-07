import type { Catalog } from './types';
import { isThemeKeyword, themeDisplayLabel, themeKeyIdentity } from './theme-keywords';
import { contributorMetrics, extremesCabinet, genreColour, matchesMetricsFilter, median, tiedExtreme, uniqueAppearances, withCutoffTies, type Appearance, type MetricsFilter } from './metrics';
export { tiedExtreme } from './metrics';

/** Read-only analytical projection, deliberately separate from Movie and Catalog. */
export interface MetricsEnrichmentMovie {
  metadata: { original_language: string | null; budget: number | null; revenue: number | null } | null;
  countries: { code: string; name: string | null }[];
  languages: { code: string; name: string | null; english_name: string | null }[];
  companies: { external_id: string; name: string }[];
  credits: { kind: string; role: string; person_id: string; name: string }[];
  contentRatings: { certification: string; release_type: number | null }[];
  keywords: { provider: string; name: string }[];
}
export interface MetricsEnrichment { movies: Record<string, MetricsEnrichmentMovie> }
export const emptyEnrichmentMovie = (): MetricsEnrichmentMovie => ({metadata:null,countries:[],languages:[],companies:[],credits:[],contentRatings:[],keywords:[]});
export const talentRoles = ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer'] as const;
export type TalentRole = typeof talentRoles[number];
export interface Fact { id: string; label: string }
export interface Frequency extends Fact { count: number; percentage: number; ratio: number | null; colour: string }
const order = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
const percent = (n: number,d: number) => d ? n/d*100 : 0;
const clean = (value: string) => value.trim();
function dedupe(facts: Fact[]): Fact[] {
  const result = new Map<string,Fact>();
  for (const fact of [...facts].sort((a,b) => order(a.label,b.label))) if (fact.id && fact.label.trim() && !result.has(fact.id)) result.set(fact.id,fact);
  return [...result.values()].sort((a,b) => order(a.label,b.label) || order(a.id,b.id));
}
export function themes(movie: MetricsEnrichmentMovie): Fact[] {
  const result = new Map<string,Fact>();
  // TMDB casing wins; lexical order breaks ties within a provider, independently of row order.
  for (const item of [...movie.keywords].sort((a,b) => (a.provider === 'tmdb' ? 0 : 1)-(b.provider === 'tmdb' ? 0 : 1) || order(a.provider,b.provider) || order(clean(a.name),clean(b.name)))) {
    const label = clean(item.name), id = themeKeyIdentity(label);
    if (id && !result.has(id)) result.set(id,{id,label});
  }
  return [...result.values()].sort((a,b) => order(a.id,b.id));
}
export function talent(row: Appearance,movie: MetricsEnrichmentMovie,role: TalentRole): Fact[] {
  if (role === 'Director') return row.movie.director?.trim() ? [{id:row.movie.director.trim(),label:row.movie.director.trim()}] : [];
  return dedupe(movie.credits.filter(c => role === 'Cast' ? c.kind === 'cast' : c.kind === 'crew' && (role === 'Writer' ? ['writer','screenplay'].includes(c.role) : c.role === role.toLowerCase())).map(c => ({id:c.person_id ? `person:${c.person_id}` : `name:${c.name.trim().toLowerCase()}`,label:c.name.trim()})));
}
export type Dimension = 'countries' | 'languages' | 'themes' | 'directors' | 'cast' | 'companies';
export function facts(row: Appearance,data: MetricsEnrichment,dimension: Dimension): Fact[] {
  const movie = data.movies[row.movie.id] ?? emptyEnrichmentMovie();
  if (dimension === 'themes') return themes(movie);
  if (dimension === 'directors' || dimension === 'cast') return talent(row,movie,dimension === 'cast' ? 'Cast' : 'Director');
  if (dimension === 'countries') return dedupe(movie.countries.map(c => ({id:c.code.trim().toUpperCase(),label:c.name?.trim() || c.code.toUpperCase()})));
  if (dimension === 'companies') return dedupe(movie.companies.map(c => ({id:c.external_id ? `company:${c.external_id}` : `name:${c.name.trim().toLowerCase()}`,label:c.name.trim()})));
  const code = movie.metadata?.original_language?.trim().toLowerCase();
  if (!code) return [];
  const names = movie.languages.filter(l => l.code.toLowerCase() === code).map(l => l.english_name?.trim() || l.name?.trim()).filter((n): n is string => Boolean(n)).sort(order);
  return [{id:code,label:names[0] || code.toUpperCase()}];
}
export type FactReader = (row: Appearance) => Fact[];
export function frequency(rows: Appearance[],read: FactReader) {
  let covered = 0; const counts = new Map<string,Fact & {count:number}>();
  for (const row of rows) {
    const values = dedupe(read(row)); if (values.length) covered++;
    for (const fact of values) {
      const old = counts.get(fact.id);
      counts.set(fact.id,{...fact,label:old && order(old.label,fact.label) < 0 ? old.label : fact.label,count:(old?.count ?? 0)+1});
    }
  }
  return {covered,values:[...counts.values()].sort((a,b) => b.count-a.count || order(a.label,b.label) || order(a.id,b.id))};
}
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
// Shared eligibility for thematic breadth and signatures; support is a Fingerprint rule only.
export function cleanedThemes(movie: MetricsEnrichmentMovie): Fact[] {
  return themes(movie).filter(f => isThemeKeyword(f.id)).map(f => ({...f,label:themeDisplayLabel(f.label)}));
}
export function themeFingerprint(rows: Appearance[],all: Appearance[],data: MetricsEnrichment,options: {distinctive?:boolean;limit?:number} = {}) {
  const read = (row:Appearance) => cleanedThemes(data.movies[row.movie.id] ?? emptyEnrichmentMovie());
  const supported = new Set(frequency(uniqueAppearances(rows),read).values.filter(f => f.count >= 2).map(f => f.id));
  const report = fingerprint(rows,all,read,{...options,limit:Number.MAX_SAFE_INTEGER});
  return {...report,values:report.values.filter(f => supported.has(f.id)).slice(0,options.limit ?? 10)};
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

export function comparisonScopes(catalog: Catalog,all: Appearance[],filter: MetricsFilter) {
  const scopes = contributorMetrics(catalog,all).map(c => ({label:c.label,rows:all.filter(r => matchesMetricsFilter(r.session,c.filter))}));
  if (filter.kind === 'all') return scopes;
  const selected = filter.kind === 'classics' ? 'CLSC' : catalog.members.find(m => m.id === filter.memberId)?.display_name.toUpperCase() || 'Selected';
  return [{label:selected,rows:all.filter(r => matchesMetricsFilter(r.session,filter))},{label:'CLUB',rows:all}];
}
export const auCategories = ['G','PG','M','MA15+','R18+','Other','Unknown'] as const;
export type AuCategory = typeof auCategories[number];
export function normaliseAu(value: string): AuCategory {
  const cleaned = value.trim().toUpperCase().replace(/\s/g,'');
  if (['G','PG','M'].includes(cleaned)) return cleaned as AuCategory;
  if (/^MA15\+?$/.test(cleaned)) return 'MA15+';
  if (/^R18\+?$/.test(cleaned)) return 'R18+';
  return 'Other';
}
/** Limited/wide theatrical (2/3) before all other release types. Highest familiar severity wins;
 * unusual evidence is Other, below familiar labels. Empty evidence is Unknown. */
export function australianClassification(movie: Pick<MetricsEnrichmentMovie,'contentRatings'>): AuCategory {
  const rows = movie.contentRatings.filter(r => r.certification.trim());
  if (!rows.length) return 'Unknown';
  const theatrical = rows.filter(r => r.release_type === 2 || r.release_type === 3);
  const severity: AuCategory[] = ['Other','G','PG','M','MA15+','R18+'];
  return (theatrical.length ? theatrical : rows).map(r => normaliseAu(r.certification)).sort((a,b) => severity.indexOf(b)-severity.indexOf(a))[0];
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
export function languageCategories(all: Appearance[],data: MetricsEnrichment): Fact[] {
  return [...frequency(all,row => facts(row,data,'languages')).values.slice(0,6).map(v => ({id:v.id,label:v.label})),{id:'Other',label:'Other'},{id:'Unknown',label:'Unknown'}];
}
export const positiveMoney = (value: number | null | undefined): number | null => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
export function filmEconomics(rows: Appearance[],data: MetricsEnrichment) {
  const unique = uniqueAppearances(rows);
  const identities = new Map<string,Set<string>>();
  for (const row of rows) {
    const hosts = identities.get(row.movie.id) ?? new Set<string>();
    hosts.add(row.session.kind === 'classics' ? 'CLSC' : row.session.host_member_id ?? 'Unknown');
    identities.set(row.movie.id,hosts);
  }
  const points = unique.flatMap(row => {
    const metadata = data.movies[row.movie.id]?.metadata, budget = positiveMoney(metadata?.budget), revenue = positiveMoney(metadata?.revenue);
    const hosts = [...identities.get(row.movie.id)!].sort(order);
    return budget !== null && revenue !== null ? [{movie:row.movie,budget,revenue,hosts}] : [];
  });
  const values = (key: 'budget' | 'revenue') => rows.flatMap(row => {const value = positiveMoney(data.movies[row.movie.id]?.metadata?.[key]);return value === null ? [] : [value];});
  const budgets = values('budget'), revenues = values('revenue');
  return {points,unique:unique.length,budget:{median:median(budgets),covered:budgets.length},revenue:{median:median(revenues),covered:revenues.length}};
}
export function tasteDiversity(rows: Appearance[],data: MetricsEnrichment,dimension: Dimension) {
  const report = frequency(rows,row => dimension === 'themes' ? cleanedThemes(data.movies[row.movie.id] ?? emptyEnrichmentMovie()) : facts(row,data,dimension));
  const distinct = report.values.filter(v => dimension !== 'cast' || v.count >= 2).length;
  return {distinct,covered:report.covered,total:rows.length,perTen:report.covered ? distinct/report.covered*10 : null};
}
export function revenueRatioRankings(rows: Appearance[],data: MetricsEnrichment) {
  const report = filmEconomics(rows,data);
  const values = report.points.map(point => ({...point,ratio:point.revenue/point.budget}));
  const order = (a:typeof values[number],b:typeof values[number]) => orderText(a.movie.title,b.movie.title) || (a.movie.year ?? 0)-(b.movie.year ?? 0) || orderText(a.movie.id,b.movie.id);
  const orderText = (a:string,b:string) => a < b ? -1 : a > b ? 1 : 0;
  return {covered:values.length,unique:report.unique,
    top:withCutoffTies([...values].sort((a,b) => b.ratio-a.ratio || order(a,b)),p => p.ratio),
    bottom:withCutoffTies([...values].sort((a,b) => a.ratio-b.ratio || order(a,b)),p => p.ratio)};
}
export function recurringTalent(rows: Appearance[],data: MetricsEnrichment,role: TalentRole) {
  const report = frequency(rows,row => talent(row,data.movies[row.movie.id] ?? emptyEnrichmentMovie(),role));
  return {covered:report.covered,extreme:tiedExtreme(report.values.filter(v => v.count >= 2),v => v.count)};
}
export const filmExtremes = extremesCabinet;
