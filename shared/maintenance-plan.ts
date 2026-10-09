import type { Catalog, ExternalId, Movie } from './types';
import { maintenanceMovies } from './score-maintenance';
import { enrichmentIdentity } from './enrichment';
import { tmdbMetadataIsStale } from './metadata';
import { maintenanceContract,missingMaintainedScores,maintainedScoreKeys,scoreProviderKeys,type OperationFieldCoverage } from './maintenance-contract';

export const maintenanceOperations = ['scores','omdb-metadata','tmdb-metadata','tmdb-enrichment','mdblist-enrichment','tmdb-collections','omdb-awards'] as const;
export type MaintenanceOperation = typeof maintenanceOperations[number];
export type MaintenanceIntent = 'populate' | 'refresh';
export type MaintenanceProvider = 'mdblist' | 'omdb' | 'tmdb';
export type CoverageCategory = 'present' | 'unchecked' | 'checked_unavailable' | 'stale' | 'unidentifiable' | 'unavailable_provider' | 'inconclusive';
export interface ProviderCoverage { movie_id:string; provider:string; domain:string; identity_provider:string; external_id:string; checked_at:string; absent:string[] }
export interface MaintenanceCoverage {
  fields?:OperationFieldCoverage[];
  fieldsSupported?:boolean;
  evidence?:ProviderCoverage[];
  evidenceSupported?:boolean;
  failures?:{movie_id:string;provider:string;operation:string;attempted_at:string}[];
  checks:ProviderCoverage[];
  unavailable:Record<MaintenanceProvider,string | null>;
  negativeScores:{movie_id:string;score_key:string}[];
  enrichment:{movie_id:string;provider:string;identity_provider:string;external_id:string;checked_at:string;unavailable_families?:number}[];
}
export interface MaintenanceUnit { movieId:string; provider:MaintenanceProvider; identity:ExternalId; operations:MaintenanceOperation[];scoreKeys?:string[] }
export interface MaintenancePlan {
  units:MaintenanceUnit[]; batches:MaintenanceUnit[][]; films:number; blocked:number; checkedUnavailable:number;
  calls:{provider:MaintenanceProvider;min:number;max:number}[];
}
export const providerKeys:Record<MaintenanceProvider,readonly string[]> = {
  ...scoreProviderKeys,
};
export function providerIdentity(movie:Pick<Movie,'external_ids'>,provider:MaintenanceProvider) {
  return provider==='omdb' ? movie.external_ids.find(e=>e.provider==='imdb' && /^tt\d{7,10}$/.test(e.external_id)) : enrichmentIdentity(movie.external_ids,provider);
}
export function matchingCheck(coverage:MaintenanceCoverage,movieId:string,provider:MaintenanceProvider,domain:string,identity:ExternalId) {
  const old=coverage.checks.find(c=>c.movie_id===movieId && c.provider===provider && c.domain===domain && c.identity_provider===identity.provider && c.external_id===identity.external_id);
  if(domain!=='scores')return old;
  const current=coverage.fields?.find(c=>c.movie_id===movieId&&c.provider===provider&&c.operation==='scores'&&c.identity_provider===identity.provider&&c.external_id===identity.external_id);
  if(!current)return old;
  return {...current,domain,checked_at:Object.values(current.fields).map(f=>f.checked_at).sort().at(-1) ?? old?.checked_at ?? '',absent:[...new Set([...(old?.absent ?? []).filter(key=>!current.fields[key]||current.fields[key].state==='checked_unavailable'),...Object.entries(current.fields).filter(([,field])=>field.state==='checked_unavailable').map(([key])=>key)])]};
}
export function negativeScore(movie:Movie,key:string,coverage:MaintenanceCoverage){
  const paths=(Object.keys(providerKeys) as MaintenanceProvider[]).filter(p=>providerKeys[p].includes(key)&&providerIdentity(movie,p));
  return paths.length>0&&paths.every(p=>matchingCheck(coverage,movie.id,p,'scores',providerIdentity(movie,p)!)?.absent.includes(key)) || !coverage.fieldsSupported&&coverage.negativeScores.some(c=>c.movie_id===movie.id&&c.score_key===key);
}
export function operationCoverage(movie:Movie,operation:MaintenanceOperation,coverage:MaintenanceCoverage):CoverageCategory {
  const provider=operation.startsWith('omdb')?'omdb':operation.startsWith('tmdb')?'tmdb':'mdblist';
  const identity=providerIdentity(movie,provider);
  if (!identity) return 'unidentifiable';
  if(coverage.fields && operation!=='scores'){
    const check=coverage.fields.find(c=>c.movie_id===movie.id&&c.provider===provider&&c.operation===operation&&c.identity_provider===identity.provider&&c.external_id===identity.external_id);
    const fields=maintenanceContract[operation].fields.map(f=>!f.optional&&check?.fields[f.id]?.state!=='present'?undefined:check?.fields[f.id]);
    if(fields.every(Boolean))return fields.some(f=>f!.state==='checked_unavailable')?'checked_unavailable':operation==='tmdb-metadata'&&fields.some(f=>tmdbMetadataIsStale(f!.checked_at))?'stale':'present';
    if(coverage.unavailable[provider])return 'unavailable_provider';
    return coverage.failures?.some(f=>f.movie_id===movie.id&&f.operation===operation)?'inconclusive':'unchecked';
  }
  if (operation==='scores') {
    const missing=missingMaintainedScores(movie.scores);
    if(!missing.length)return 'present';
    const actionable=missing.filter(key=>!negativeScore(movie,key,coverage));
    if(!actionable.length)return 'checked_unavailable';
    const capable=(Object.keys(providerKeys) as MaintenanceProvider[]).filter(p=>{const id=providerIdentity(movie,p);return id&&actionable.some(key=>providerKeys[p].includes(key)&&!matchingCheck(coverage,movie.id,p,'scores',id)?.absent.includes(key));});
    if(!capable.length)return 'unidentifiable';
    return capable.some(p=>!coverage.unavailable[p])?'unchecked':'unavailable_provider';
  }
  if (coverage.unavailable[provider]) return 'unavailable_provider';
  const evidenceOperation=operation==='tmdb-collections' || operation==='omdb-awards';
  const check=evidenceOperation ? coverage.evidence?.find(c=>c.movie_id===movie.id && c.domain===(operation==='tmdb-collections'?'collections':'awards') && c.identity_provider===identity.provider && c.external_id===identity.external_id) : operation.endsWith('enrichment') ? coverage.enrichment.find(c=>c.movie_id===movie.id && c.provider===provider && c.identity_provider===identity.provider && c.external_id===identity.external_id)
    : provider==='omdb' ? matchingCheck(coverage,movie.id,provider,'metadata',identity) : movie.tmdb_metadata_checked_at && (movie.tmdb_artwork_checked_at || ['poster','backdrop'].every(type=>movie.assets.some(a=>a.provider==='tmdb' && a.asset_type===type))) ? {checked_at:movie.tmdb_metadata_checked_at} : undefined;
  if (!check) return coverage.failures?.some(f=>f.movie_id===movie.id && f.operation===operation) ? 'inconclusive' : 'unchecked';
  if(operation==='omdb-metadata' && 'absent' in check) {
    const gaps=[...(!movie.year?['year']:[]),...(!movie.runtime?['runtime']:[]),...(!movie.director?.trim()?['director']:[]),...(!movie.genres.length?['genres']:[])];
    if(gaps.some(field=>!check.absent.includes(field))) return 'unchecked';
  }
  const absent=evidenceOperation ? ('absent' in check && check.absent.length>0) : operation==='omdb-metadata' ? !movie.year || !movie.runtime || !movie.director || !movie.genres.length
    : operation==='tmdb-metadata' ? !movie.overview || !movie.original_title || !movie.release_date || !movie.runtime || !movie.director || !movie.genres.length || !movie.assets.some(a=>a.provider==='tmdb' && a.asset_type==='poster') || !movie.assets.some(a=>a.provider==='tmdb' && a.asset_type==='backdrop') : ('unavailable_families' in check && Number(check.unavailable_families)>0);
  return absent ? 'checked_unavailable' : tmdbMetadataIsStale(check.checked_at) ? 'stale' : 'present';
}
/** Provider requirements, never title-based deduplication. Fallback ranges remain conditional. */
export function planMaintenance(catalog:Catalog,coverage:MaintenanceCoverage,intent:MaintenanceIntent,operations:readonly MaintenanceOperation[]=maintenanceOperations):MaintenancePlan {
  const scoreScope=new Set(maintenanceMovies(catalog).map(m=>m.id)), units:MaintenanceUnit[]=[], blocked=new Set<string>(), skipped=new Set<string>();
  for (const movie of [...catalog.movies].sort((a,b)=>a.id.localeCompare(b.id))) {
    const requested=new Map<MaintenanceProvider,MaintenanceOperation[]>();
    const scoreKeys=new Map<MaintenanceProvider,string[]>();
    for (const operation of operations) {
      if (operation==='scores') {
        if (!scoreScope.has(movie.id)) continue;
        const missing=intent==='refresh' ? [...maintainedScoreKeys] : missingMaintainedScores(movie.scores).filter(key=>!negativeScore(movie,key,coverage));
        if (!missing.length) {if (missingMaintainedScores(movie.scores).length) skipped.add(movie.id);continue;}
        for (const provider of ['mdblist','omdb','tmdb'] as const) {
          const identity=providerIdentity(movie,provider);
          const needed=missing.filter(key=>providerKeys[provider].includes(key));
          if(!needed.length)continue;
          const check=identity?matchingCheck(coverage,movie.id,provider,'scores',identity):undefined;
          if(intent==='populate'&&needed.every(key=>check?.absent.includes(key)))continue;
          if (!identity || coverage.unavailable[provider]) {blocked.add(movie.id);continue;}
          requested.set(provider,[...(requested.get(provider) ?? []),operation]);
          scoreKeys.set(provider,needed);
        }
        continue;
      }
      const category=operationCoverage(movie,operation,coverage);
      if (category==='unidentifiable' || category==='unavailable_provider') {blocked.add(movie.id);continue;}
      if (intent==='populate' && category!=='unchecked' && category!=='inconclusive') {if(category==='checked_unavailable') skipped.add(movie.id);continue;}
      const provider=operation.startsWith('omdb')?'omdb':operation.startsWith('tmdb')?'tmdb':'mdblist';
      if(intent==='refresh'&&coverage.unavailable[provider]){blocked.add(movie.id);continue;}
      requested.set(provider,[...(requested.get(provider) ?? []),operation]);
    }
    for (const [provider,selected] of requested) units.push({movieId:movie.id,provider,identity:providerIdentity(movie,provider)!,operations:[...new Set(selected)],...(scoreKeys.has(provider)?{scoreKeys:scoreKeys.get(provider)}:{})});
  }
  const batches:MaintenanceUnit[][]=[],calls:MaintenancePlan['calls']=[];
  for (const provider of ['mdblist','omdb','tmdb'] as const) {
    const selected=units.filter(u=>u.provider===provider), size=provider==='tmdb'?2:10;
    const groups=provider==='mdblist' ? ['imdb','tmdb'].map(p=>selected.filter(u=>u.identity.provider===p)) : [selected];
    let min=0,max=0;
    for (const group of groups) for(let offset=0;offset<group.length;offset+=size) {
      const batch=group.slice(offset,offset+size);batches.push(batch);
      if(provider==='mdblist') {min++;max+=1+batch.length;}
      else {min+=batch.filter(u=>u.operations.some(o=>o!=='scores')).length;max+=batch.length*(provider==='omdb'?2:1);}
    }
    calls.push({provider,min,max});
  }
  return {units,batches,films:new Set(units.map(u=>u.movieId)).size,blocked:blocked.size,checkedUnavailable:skipped.size,calls};
}
export function operationCounts(catalog:Catalog,operation:MaintenanceOperation,coverage:MaintenanceCoverage){
  const films=operation==='scores'?maintenanceMovies(catalog):catalog.movies;
  const counts={actionable:0,present:0,unavailable:0,blocked:0};
  for(const movie of films){const state=operationCoverage(movie,operation,coverage);if(state==='unchecked'||state==='inconclusive')counts.actionable++;else if(state==='checked_unavailable')counts.unavailable++;else if(state==='unidentifiable'||state==='unavailable_provider')counts.blocked++;else counts.present++;}
  return counts;
}
export interface MaintenanceBatchResult {
  results:{movieId:string;provider:MaintenanceProvider;status:'updated'|'no_change'|'failed'|'skipped';message:string;blocking?:boolean;retryAfter?:number;conflicts?:number}[];
  requests?:number;stopped?:boolean;canonicalChanged:boolean;cacheChanged:boolean;quota?:Record<string,string>;
}
