import type { Catalog, ExternalId, Movie } from './types';
import { maintenanceMovies } from './score-maintenance';
import { missingLiveScoreDimensions, requiredScores } from './ranking';
import { enrichmentIdentity } from './enrichment';
import { tmdbMetadataIsStale } from './metadata';

export const maintenanceOperations = ['scores','omdb-metadata','tmdb-metadata','tmdb-enrichment','mdblist-enrichment'] as const;
export type MaintenanceOperation = typeof maintenanceOperations[number];
export type MaintenanceIntent = 'populate' | 'refresh';
export type MaintenanceProvider = 'mdblist' | 'omdb' | 'tmdb';
export type CoverageCategory = 'present' | 'unchecked' | 'checked_unavailable' | 'stale' | 'unidentifiable' | 'unavailable_provider' | 'inconclusive';
export interface ProviderCoverage { movie_id:string; provider:string; domain:string; identity_provider:string; external_id:string; checked_at:string; absent:string[] }
export interface MaintenanceCoverage {
  failures?:{movie_id:string;provider:string;operation:string;attempted_at:string}[];
  checks:ProviderCoverage[];
  unavailable:Record<MaintenanceProvider,string | null>;
  negativeScores:{movie_id:string;score_key:string}[];
  enrichment:{movie_id:string;provider:string;identity_provider:string;external_id:string;checked_at:string;unavailable_families?:number}[];
}
export interface MaintenanceUnit { movieId:string; provider:MaintenanceProvider; identity:ExternalId; operations:MaintenanceOperation[] }
export interface MaintenancePlan {
  units:MaintenanceUnit[]; batches:MaintenanceUnit[][]; films:number; blocked:number; checkedUnavailable:number;
  calls:{provider:MaintenanceProvider;min:number;max:number}[];
}
export const providerKeys:Record<MaintenanceProvider,readonly string[]> = {
  mdblist:requiredScores, omdb:['imdb:rating','rottentomatoes:critic','metacritic:critic'],tmdb:['tmdb:rating'],
};
export function providerIdentity(movie:Pick<Movie,'external_ids'>,provider:MaintenanceProvider) {
  return provider==='omdb' ? movie.external_ids.find(e=>e.provider==='imdb' && /^tt\d{7,10}$/.test(e.external_id)) : enrichmentIdentity(movie.external_ids,provider);
}
export function matchingCheck(coverage:MaintenanceCoverage,movieId:string,provider:MaintenanceProvider,domain:string,identity:ExternalId) {
  return coverage.checks.find(c=>c.movie_id===movieId && c.provider===provider && c.domain===domain && c.identity_provider===identity.provider && c.external_id===identity.external_id);
}
export function operationCoverage(movie:Movie,operation:MaintenanceOperation,coverage:MaintenanceCoverage):CoverageCategory {
  const provider=operation.startsWith('omdb')?'omdb':operation.startsWith('tmdb')?'tmdb':'mdblist';
  const identity=providerIdentity(movie,provider);
  if (!identity) return 'unidentifiable';
  if (coverage.unavailable[provider]) return 'unavailable_provider';
  if (operation==='scores') {
    const missing=missingLiveScoreDimensions(movie.scores);
    return !missing.length ? 'present' : missing.every(key=>coverage.negativeScores.some(c=>c.movie_id===movie.id && c.score_key===key)) ? 'checked_unavailable' : 'unchecked';
  }
  const check=operation.endsWith('enrichment') ? coverage.enrichment.find(c=>c.movie_id===movie.id && c.provider===provider && c.identity_provider===identity.provider && c.external_id===identity.external_id)
    : provider==='omdb' ? matchingCheck(coverage,movie.id,provider,'metadata',identity) : movie.tmdb_metadata_checked_at && (movie.tmdb_artwork_checked_at || ['poster','backdrop'].every(type=>movie.assets.some(a=>a.provider==='tmdb' && a.asset_type===type))) ? {checked_at:movie.tmdb_metadata_checked_at} : undefined;
  if (!check) return coverage.failures?.some(f=>f.movie_id===movie.id && f.operation===operation) ? 'inconclusive' : 'unchecked';
  if(operation==='omdb-metadata' && 'absent' in check) {
    const gaps=[...(!movie.year?['year']:[]),...(!movie.runtime?['runtime']:[]),...(!movie.director?.trim()?['director']:[]),...(!movie.genres.length?['genres']:[])];
    if(gaps.some(field=>!check.absent.includes(field))) return 'unchecked';
  }
  const absent=operation==='omdb-metadata' ? !movie.year || !movie.runtime || !movie.director || !movie.genres.length
    : operation==='tmdb-metadata' ? !movie.overview || !movie.original_title || !movie.release_date || !movie.runtime || !movie.director || !movie.genres.length || !movie.assets.some(a=>a.provider==='tmdb' && a.asset_type==='poster') || !movie.assets.some(a=>a.provider==='tmdb' && a.asset_type==='backdrop') : ('unavailable_families' in check && Number(check.unavailable_families)>0);
  return absent ? 'checked_unavailable' : tmdbMetadataIsStale(check.checked_at) ? 'stale' : 'present';
}
/** Provider requirements, never title-based deduplication. Fallback ranges remain conditional. */
export function planMaintenance(catalog:Catalog,coverage:MaintenanceCoverage,intent:MaintenanceIntent,operations:readonly MaintenanceOperation[]=maintenanceOperations):MaintenancePlan {
  const scoreScope=new Set(maintenanceMovies(catalog).map(m=>m.id)), units:MaintenanceUnit[]=[], blocked=new Set<string>(), skipped=new Set<string>();
  for (const movie of [...catalog.movies].sort((a,b)=>a.id.localeCompare(b.id))) {
    const requested=new Map<MaintenanceProvider,MaintenanceOperation[]>();
    for (const operation of operations) {
      if (operation==='scores') {
        if (!scoreScope.has(movie.id)) continue;
        const missing=intent==='refresh' ? [...requiredScores] : missingLiveScoreDimensions(movie.scores).filter(key=>!coverage.negativeScores.some(c=>c.movie_id===movie.id && c.score_key===key));
        if (!missing.length) {if (missingLiveScoreDimensions(movie.scores).length) skipped.add(movie.id);continue;}
        for (const provider of ['mdblist','omdb','tmdb'] as const) {
          const identity=providerIdentity(movie,provider);
          if (!identity || coverage.unavailable[provider]) {blocked.add(movie.id);continue;}
          const check=matchingCheck(coverage,movie.id,provider,'scores',identity);
          const needed=missing.filter(key=>providerKeys[provider].includes(key));
          if (!needed.length || intent==='populate' && needed.every(key=>check?.absent.includes(key))) continue;
          requested.set(provider,[...(requested.get(provider) ?? []),operation]);
        }
        continue;
      }
      const category=operationCoverage(movie,operation,coverage);
      if (category==='unidentifiable' || category==='unavailable_provider') {blocked.add(movie.id);continue;}
      if (intent==='populate' && category!=='unchecked' && category!=='inconclusive') {if(category==='checked_unavailable') skipped.add(movie.id);continue;}
      const provider=operation.startsWith('omdb')?'omdb':operation.startsWith('tmdb')?'tmdb':'mdblist';
      requested.set(provider,[...(requested.get(provider) ?? []),operation]);
    }
    for (const [provider,selected] of requested) units.push({movieId:movie.id,provider,identity:providerIdentity(movie,provider)!,operations:[...new Set(selected)]});
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
export interface MaintenanceBatchResult {
  results:{movieId:string;provider:MaintenanceProvider;status:'updated'|'no_change'|'failed'|'skipped';message:string;blocking?:boolean;retryAfter?:number;conflicts?:number}[];
  requests?:number;stopped?:boolean;canonicalChanged:boolean;cacheChanged:boolean;quota?:Record<string,string>;
}
