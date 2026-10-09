import { isThemeKeyword, themeDisplayLabel, themeKeyIdentity } from '../theme-keywords';
import type { Appearance } from '../metrics-summary';

/** Read-only analytical projection, deliberately separate from Movie and Catalog. */
export interface MetricsEnrichmentMovie {
  collection?: {status:'not_checked'|'inconclusive'|'checked_none'|'checked_present';external_id:string | null;checked_at:string | null;collection_id:number | null;collection_name:string | null};
  awards?: {status:'not_checked'|'inconclusive'|'checked_unavailable'|'checked_unquantified'|'checked_quantified';external_id:string | null;checked_at:string | null;awards_text:string | null;wins:number | null;nominations:number | null};
  metadata: { original_language: string | null; budget: number | null; revenue: number | null } | null;
  countries: { code: string; name: string | null }[];
  languages: { code: string; name: string | null; english_name: string | null }[];
  companies: { external_id: string; name: string }[];
  credits: { kind: string; role: string; person_id: string; name: string }[];
  contentRatings: { certification: string; release_type: number | null }[];
  keywords: { provider: string; name: string }[];
}
export interface MetricsEnrichment { movies: Record<string, MetricsEnrichmentMovie>; collections?:Record<string,import('../collection-roster').CollectionRosterEvidence> }
export const emptyEnrichmentMovie = (): MetricsEnrichmentMovie => ({metadata:null,countries:[],languages:[],companies:[],credits:[],contentRatings:[],keywords:[]});
export const talentRoles = ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer'] as const;
export type TalentRole = typeof talentRoles[number];
export interface Fact { id: string; label: string }
export interface Frequency extends Fact { count: number; percentage: number; ratio: number | null; colour: string }
export const order = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
export const percent = (n: number,d: number) => d ? n/d*100 : 0;
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
/** Opt-in immutable projection; caches are released with this snapshot, never persisted. */
const prepared = new WeakMap<MetricsEnrichment,Map<string,FactReader>>();
const projections = new WeakMap<MetricsEnrichment,MetricsEnrichment>();
type FrequencyReport={covered:number;values:(Fact & {count:number})[]};
const cachedFrequencies = new WeakMap<FactReader,WeakMap<Appearance[],FrequencyReport>>();
export function prepareMetricsEnrichment(source: MetricsEnrichment): MetricsEnrichment {
  const old=projections.get(source);if(old)return old;
  const data={...source};prepared.set(data,new Map());projections.set(source,data);return data;
}
function readerFor(data:MetricsEnrichment,key:string,read:(row:Appearance)=>Fact[]):FactReader {
  const readers=prepared.get(data);if(!readers)return read;
  const old=readers.get(key);if(old)return old;
  const films=new Map<string,Fact[]>();
  const reader:FactReader=row=>{
    const identity=key === 'talent:Director' || key === 'directors' ? `${row.movie.id}:${row.movie.director ?? ''}` : row.movie.id;
    let values=films.get(identity);if(!values){values=dedupe(read(row));films.set(identity,values);}return values;
  };
  readers.set(key,reader);cachedFrequencies.set(reader,new WeakMap());return reader;
}
export function metricsFactReader(data:MetricsEnrichment,dimension:Dimension):FactReader {
  return readerFor(data,dimension,row=>facts(row,data,dimension));
}
export function metricsTalentReader(data:MetricsEnrichment,role:TalentRole):FactReader {
  return readerFor(data,`talent:${role}`,row=>talent(row,data.movies[row.movie.id] ?? emptyEnrichmentMovie(),role));
}
export function themeReader(data:MetricsEnrichment):FactReader {
  if (!prepared.has(data)) return row=>cleanedThemes(data.movies[row.movie.id] ?? emptyEnrichmentMovie());
  const labels=new Map<string,string>();
  return readerFor(data,'cleanedThemes',row=>themes(data.movies[row.movie.id] ?? emptyEnrichmentMovie()).filter(f=>isThemeKeyword(f.id)).map(f=>{
    let label=labels.get(f.label);if(label === undefined){label=themeDisplayLabel(f.label);labels.set(f.label,label);}return {...f,label};
  }));
}
export type FactReader = (row: Appearance) => Fact[];
export function frequency(rows: Appearance[],read: FactReader):FrequencyReport {
  const cache=cachedFrequencies.get(read), previous=cache?.get(rows);if(previous)return previous;
  let covered = 0; const counts = new Map<string,Fact & {count:number}>();
  for (const row of rows) {
    const values = cache ? read(row) : dedupe(read(row)); if (values.length) covered++;
    for (const fact of values) {
      const old = counts.get(fact.id);
      counts.set(fact.id,{...fact,label:old && order(old.label,fact.label) < 0 ? old.label : fact.label,count:(old?.count ?? 0)+1});
    }
  }
  const report={covered,values:[...counts.values()].sort((a,b) => b.count-a.count || order(a.label,b.label) || order(a.id,b.id))};
  cache?.set(rows,report);return report;
}
// Shared meaningful-keyword eligibility for thematic breadth and frequency signatures.
export function cleanedThemes(movie: MetricsEnrichmentMovie): Fact[] {
  return themes(movie).filter(f => isThemeKeyword(f.id)).map(f => ({...f,label:themeDisplayLabel(f.label)}));
}
