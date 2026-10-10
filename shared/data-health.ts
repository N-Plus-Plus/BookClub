import type { MovieDetail } from './types';
import { latestScores, effectiveRankingScores } from './ranking';
import { maintenanceContract, missingMaintainedScores } from './maintenance-contract';
import { operationCoverage, providerIdentity, negativeScore, matchingCheck, type MaintenanceCoverage, type MaintenanceOperation } from './maintenance-plan';
import { ratingDimensions } from './rating-dimensions';

export const healthCategories = ['identity','metadata','artwork','ratings','coverage','consistency'] as const;
export const healthPriorities = ['blocking','actionable','review','confirmed'] as const;
export const healthLocations = ['history','ranked','unranked','dq','builder','prediction','archived','catalogue'] as const;
export type HealthPriority = typeof healthPriorities[number];
export interface HealthIssue {
  code:string; category:typeof healthCategories[number]; priority:HealthPriority; label:string; explanation:string;
  state?:string; provider?:string; identity?:string; checkedAt?:string; attemptedAt?:string;
}
export interface HealthLocation { kind:typeof healthLocations[number]; label:string; count?:number }
export interface IdentityClaim { provider:string; identity_provider:string; external_id:string; fetched_at:string; owner_movie_id:string|null }
export interface HealthRelationships { builderCount:number; predictions:string[]; archivedCount:number }
export interface HealthFilm { id:string; title:string; year:number|null; external_ids:MovieDetail['external_ids']; locations:HealthLocation[]; issues:HealthIssue[] }
export interface HealthPage { films:HealthFilm[]; scanned:number; next:string|null; partial:boolean }

/** Relationships and evidence are independent; never infer Seen from a missing answer. */
export function filmLocations(movie:MovieDetail, relationships:HealthRelationships, names:ReadonlyMap<string,string>):HealthLocation[] {
  const locations:HealthLocation[]=[];
  for(const kind of ['hosted','classics'] as const){
    const appearances=movie.appearances.filter(a=>a.kind===kind);
    if(appearances.length){
      const hosts=[...new Set(appearances.map(a=>a.host_member_id).filter((id):id is string=>Boolean(id)))].map(id=>names.get(id)??id);
      locations.push({kind:'history',count:appearances.length,label:`Active History · ${kind==='classics'?'Classics events':`Hosted${hosts.length?' · '+hosts.join(', '):''}`} · ${appearances.length} appearance${appearances.length===1?'':'s'}`});
    }
  }
  if(movie.classic){
    const kind=movie.appearances.length||!movie.ranking?.eligible?'dq':movie.ranking.rankable?'ranked':'unranked';
    locations.push({kind,label:kind==='dq'?'Disqualified Classic':kind==='ranked'?'Ranked Classic':'Unranked Classic'});
  }
  if(relationships.builderCount)locations.push({kind:'builder',count:relationships.builderCount,label:`Private saved Builder membership · ${relationships.builderCount} set${relationships.builderCount===1?'':'s'}`});
  if(relationships.predictions.length)locations.push({kind:'prediction',label:`Curated AI Prediction · ${relationships.predictions.join(', ')}`});
  if(relationships.archivedCount)locations.push({kind:'archived',count:relationships.archivedCount,label:`Archived History · ${relationships.archivedCount} appearance${relationships.archivedCount===1?'':'s'}`});
  if(!locations.some(l=>l.kind!=='archived'))locations.push({kind:'catalogue',label:'Catalogue only · no active membership'});
  return locations;
}

export function classifyFilm(movie:MovieDetail, coverage:MaintenanceCoverage, locations:HealthLocation[], claims:IdentityClaim[]):HealthFilm {
  const issues:HealthIssue[]=[];
  const important=locations.some(l=>['history','ranked','unranked'].includes(l.kind));
  const eligibleClassic=locations.some(l=>l.kind==='ranked'||l.kind==='unranked');
  const add=(issue:HealthIssue)=>issues.push(issue);
  for(const [provider,valid] of [['imdb',providerIdentity(movie,'omdb')],['tmdb',providerIdentity(movie,'tmdb')]] as const){
    const stored=movie.external_ids.find(i=>i.provider===provider);
    if(!valid)add({code:`identity-${provider}`,category:'identity',priority:'actionable',label:`${provider==='imdb'?'IMDb':'TMDB'} identity ${stored?'invalid':'missing'}`,explanation:stored?`Stored identity ${stored.external_id} cannot be used by maintenance.`:'Provider checks need a valid external identity.'});
  }
  for(const claim of claims){
    const canonical=movie.external_ids.find(i=>i.provider===claim.identity_provider);
    if((canonical&&canonical.external_id!==claim.external_id)||(claim.owner_movie_id&&claim.owner_movie_id!==movie.id))add({code:`claim-${claim.provider}-${claim.identity_provider}-${claim.external_id}`,category:'identity',priority:'actionable',label:`Conflicting ${claim.identity_provider==='imdb'?'IMDb':'TMDB'} identity`,provider:claim.provider,identity:claim.external_id,checkedAt:claim.fetched_at,explanation:`${claim.provider} claims ${claim.external_id}${canonical?`; canonical identity is ${canonical.external_id}`:''}${claim.owner_movie_id&&claim.owner_movie_id!==movie.id?'; claimed identity belongs to another catalogue film':''}. Stored claims are evidence for inspection, not a repair instruction.`});
  }
  const check=(operation:MaintenanceOperation,field:string)=>{
    const provider=operation.startsWith('omdb')?'omdb':operation.startsWith('tmdb')?'tmdb':'mdblist';
    const identity=providerIdentity(movie,provider);
    if(!identity)return null;
    const row=coverage.fields?.find(c=>c.movie_id===movie.id&&c.operation===operation&&c.provider===provider&&c.identity_provider===identity.provider&&c.external_id===identity.external_id);
    const evidence=row?.fields[field];
    const failure=coverage.failures?.find(f=>f.movie_id===movie.id&&f.operation===operation&&f.provider===provider);
    return {provider,identity:`${identity.provider}:${identity.external_id}`,checkedAt:evidence?.checked_at,attemptedAt:failure?.attempted_at,state:evidence?.state??(failure?'inconclusive':'unchecked')};
  };
  const gaps:[string,string,boolean,[MaintenanceOperation,string][]][]=[
    ['release','release date',!movie.release_date,[['tmdb-metadata','release']]],
    ['year','release year',!movie.year,[['tmdb-metadata','release'],['omdb-metadata','year']]],
    ['runtime','runtime',!(movie.runtime&&movie.runtime>0),[['tmdb-metadata','runtime'],['omdb-metadata','runtime']]],
    ['director','director',!movie.director?.trim(),[['tmdb-metadata','director'],['omdb-metadata','director']]],
    ['genres','genres',!movie.genres.length,[['tmdb-metadata','genres'],['omdb-metadata','genres']]],
    ['overview','overview',!movie.overview?.trim(),[['tmdb-metadata','overview']]],
    ['poster','poster artwork',!movie.assets.some(a=>a.asset_type==='poster'&&a.reference.trim()),[['tmdb-metadata','poster']]],
  ];
  for(const [code,label,missing,paths] of gaps)if(missing){
    const evidence=paths.map(([op,field])=>check(op,field)).filter(c=>c!==null);
    const confirmed=evidence.length>0&&evidence.every(c=>c.state==='checked_unavailable');
    const positive=evidence.some(c=>c.state==='present');
    add({...(evidence.length===1?evidence[0]:{}),code:`missing-${code}`,category:code==='poster'?'artwork':'metadata',priority:confirmed?'confirmed':positive||important?'actionable':'review',label:`Missing ${label}`,state:confirmed?'checked_unavailable':positive?'inconsistent':evidence.some(c=>c.state==='inconclusive')?'inconclusive':'unchecked',explanation:confirmed?'All applicable identity-matching provider checks confirm absence. This is not outstanding maintenance.':positive?'Provider coverage records presence but the canonical value is absent. Inspect the record.':evidence.length?evidence.map(c=>`${c.provider}: ${c.state}${c.checkedAt?' · checked '+c.checkedAt:''}${c.attemptedAt?' · attempted '+c.attemptedAt:''}`).join('; '):'No supported identity to check this field.'});
  }
  const rankingScores=effectiveRankingScores(movie.scores);
  if(!latestScores(movie.scores).length || eligibleClassic&&!rankingScores.length)add({code:'no-ratings',category:'ratings',priority:eligibleClassic?'blocking':important?'actionable':'review',label:eligibleClassic?'No usable Watch Order ratings':'No usable ratings',explanation:eligibleClassic?'This eligible Classic cannot be ranked without at least one genuine Watch Order rating.':'No valid genuine source rating is stored. Optional ratings alone do not supply Watch Order inputs.'});
  const scoreScope=coverage.scoreEligibleIds?.includes(movie.id)??locations.some(l=>['history','ranked','unranked','dq','builder','prediction'].includes(l.kind));
  if(scoreScope)for(const key of missingMaintainedScores(movie.scores)){
    const confirmed=negativeScore(movie,key,coverage);
    const imputed=eligibleClassic&&movie.ranking?.imputedScores.some(s=>`${s.provider}:${s.metric}`===key);
    add({code:`rating-${key}`,category:'ratings',priority:confirmed?'confirmed':imputed?'actionable':'review',label:`Missing ${ratingDimensions[key].fullLabel}`,state:confirmed?'checked_unavailable':'unchecked',explanation:confirmed?'All supported identity-matching provider paths confirm this rating unavailable. No Populate request is outstanding.':imputed?'Watch Order imputes this dimension using the available-score average. A legacy score may still bootstrap ranking.':'No usable live observation for this maintained dimension. Legacy bootstrap observations are not live coverage.'});
  }
  if(scoreScope)for(const provider of ['mdblist','omdb','tmdb'] as const){
    const identity=providerIdentity(movie,provider),failure=coverage.failures?.find(f=>f.movie_id===movie.id&&f.operation==='scores'&&f.provider===provider);
    if(!identity||!failure)continue;
    const success=matchingCheck(coverage,movie.id,provider,'scores',identity);
    if(success&&success.checked_at>=failure.attempted_at)continue;
    add({code:`score-attempt-${provider}`,category:'coverage',priority:'actionable',label:`${provider} ratings check inconclusive`,state:'inconclusive',provider,identity:`${identity.provider}:${identity.external_id}`,checkedAt:success?.checked_at,attemptedAt:failure.attempted_at,explanation:'Latest recorded score attempt was inconclusive. Retained successful ratings and confirmed absences remain authoritative; this does not make them outstanding Populate requests.'});
  }
  for(const operation of ['omdb-metadata','tmdb-metadata','tmdb-enrichment','mdblist-enrichment','tmdb-collections','omdb-awards'] as const){
    const state=operationCoverage(movie,operation,coverage);
    if(['present','checked_unavailable','unidentifiable'].includes(state))continue;
    const provider=operation.startsWith('omdb')?'omdb':operation.startsWith('tmdb')?'tmdb':'mdblist';
    const identity=providerIdentity(movie,provider)!;
    const row=coverage.fields?.find(c=>c.movie_id===movie.id&&c.operation===operation&&c.identity_provider===identity.provider&&c.external_id===identity.external_id);
    const missing=maintenanceContract[operation].fields.filter(f=>!row?.fields[f.id]||!f.optional&&row.fields[f.id].state!=='present').map(f=>f.label);
    add({code:`coverage-${operation}`,category:'coverage',priority:state==='inconclusive'?'actionable':'review',label:`${maintenanceContract[operation].name} ${state==='stale'?'evidence stale':state==='inconclusive'?'check inconclusive':state==='unavailable_provider'?'check blocked':'not fully checked'}`,state,provider,identity:`${identity.provider}:${identity.external_id}`,checkedAt:row?Object.values(row.fields).map(f=>f.checked_at).sort().at(-1):undefined,attemptedAt:coverage.failures?.find(f=>f.movie_id===movie.id&&f.operation===operation)?.attempted_at,explanation:state==='stale'?'Existing TMDB metadata age policy classifies this evidence as stale; age alone does not activate Populate.':`Unresolved checks: ${missing.join(', ')||'legacy evidence incomplete'}. Confirmed optional absence is complete coverage.`});
  }
  if(movie.release_date&&movie.year&&/^\d{4}-/.test(movie.release_date)&&Number(movie.release_date.slice(0,4))!==movie.year)add({code:'release-year-conflict',category:'consistency',priority:'actionable',label:'Release date and year disagree',explanation:`Release date ${movie.release_date}; canonical year ${movie.year}.`});
  return {id:movie.id,title:movie.title,year:movie.year,external_ids:movie.external_ids,locations,issues};
}
