import { availabilityProviderName } from '../availability-provider-name';
import { order } from '../metrics-enrichment/facts';
import type { Catalog } from '../types';
import { compositeScore, audienceVotes, uniqueAppearances, withCutoffTies, type Appearance, type MetricsFilter } from '../metrics';
import { normalizedGenres } from '../genres';
import { contributorScopes, filterContributorScopes, metricsTalentReader, australianClassification, classificationCategories, emptyEnrichmentMovie, type MetricsEnrichment } from '../metrics-enrichment';
import { positive, paired, scoreMeans } from './numerical';
import { parseCollectionRoster } from '../collection-roster';

const filmOrder=(a:Appearance,b:Appearance)=>order(a.movie.title,b.movie.title)||order(a.movie.id,b.movie.id);
export function sharedStars(catalog:Catalog,all:Appearance[],data:MetricsEnrichment) {
  const scopes=contributorScopes(catalog,all).filter(scope=>scope.filter.kind==='member'),read=metricsTalentReader(data,'Cast');
  const actors=new Map<string,{id:string;label:string;counts:number[]}>();
  scopes.forEach((scope,index)=>{for(const row of scope.rows)for(const person of read(row)){
    let actor=actors.get(person.id);if(!actor){actor={...person,counts:scopes.map(()=>0)};actors.set(person.id,actor);}
    if(order(person.label,actor.label)<0)actor.label=person.label;
    actor.counts[index]++;
  }});
  return [...actors.values()].filter(a=>a.counts.length===4&&a.counts.every(n=>n>0)).map(a=>({...a,appearances:a.counts.reduce((sum,n)=>sum+n,0)}))
    .sort((a,b)=>b.appearances-a.appearances||order(a.label,b.label)||order(a.id,b.id));
}
// Conservative name fallback for absent IDs, including one established screen-name alias.
const personName=(name:string)=>name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/^charlie chaplin$/,'charles chaplin');
export const partnershipRoles=['Writer','Composer','Cinematographer','Editor'] as const;
export type PartnershipRole=typeof partnershipRoles[number];
export function partnerships(rows:Appearance[],data:MetricsEnrichment,selectedRole?:PartnershipRole) {
  return (selectedRole?[selectedRole]:partnershipRoles).map(role=>{
    const read=metricsTalentReader(data,role),canonicalDirectors=metricsTalentReader(data,'Director');
    const pairs=new Map<string,{id:string;director:string;partner:string;films:Appearance[]}>();
    for(const row of uniqueAppearances(rows)){
      const credits=data.movies[row.movie.id]?.credits.filter(c=>c.kind==='crew'&&c.role==='director'&&c.name.trim())??[];
      const directors=credits.length?credits.map(c=>({id:c.person_id?`person:${c.person_id}`:`name:${personName(c.name)}`,label:c.name.trim()})):canonicalDirectors(row).map(c=>({...c,id:`name:${personName(c.label)}`}));
      for(const director of directors)for(const partner of read(row)){
        if(!personName(director.label)||!personName(partner.label)||director.id===partner.id||personName(director.label)===personName(partner.label))continue;
        const id=JSON.stringify([director.id,partner.id]);
        const pair=pairs.get(id)??{id,director:director.label,partner:partner.label,films:[]};
        if(!pair.films.some(f=>f.movie.id===row.movie.id))pair.films.push(row);pairs.set(id,pair);
      }
    }
    return {role,values:withCutoffTies([...pairs.values()].sort((a,b)=>b.films.length-a.films.length||order(a.director,b.director)||order(a.partner,b.partner)||order(a.id,b.id)),v=>v.films.length)};
  });
}
export function genreRevenue(rows:Appearance[],data:MetricsEnrichment) {
  const genres=new Map<string,{genre:string;revenue:number;films:Appearance[]}>();
  for(const row of uniqueAppearances(rows)){
    const revenue=data.movies[row.movie.id]?.metadata?.revenue;if(!positive(revenue))continue;
    for(const genre of normalizedGenres(row.movie.genres)){
      const old=genres.get(genre);
      if(!old||revenue>old.revenue)genres.set(genre,{genre,revenue,films:[row]});else if(revenue===old.revenue)old.films.push(row);
    }
  }
  return [...genres.values()].sort((a,b)=>b.revenue-a.revenue||order(a.genre,b.genre));
}
export function expensiveFlops(catalog:Catalog,all:Appearance[],filter:MetricsFilter,data:MetricsEnrichment) {
  return filterContributorScopes(contributorScopes(catalog,all),filter).map(scope=>{
    const values=uniqueAppearances(scope.rows).flatMap(row=>{
      const budget=data.movies[row.movie.id]?.metadata?.budget,scores=paired(row);if(!positive(budget)||!scores)return [];
      const score=(scores.critic+scores.audience)/2;if(!positive(score))return [];
      return [{row,budget,score,ratio:budget/score}];
    }).sort((a,b)=>b.ratio-a.ratio||filmOrder(a.row,b.row));
    return {...scope,values:values.filter(v=>v.ratio===values[0]?.ratio)};
  });
}
export function classificationAcclaim(rows:Appearance[],data:MetricsEnrichment) {
  return classificationCategories.map(category=>{
    const films=rows.filter(row=>{
      const id=australianClassification(data.movies[row.movie.id]??emptyEnrichmentMovie());
      return category.id==='Other/Unknown'?id==='Other'||id==='Unknown':id===category.id;
    });
    return {...category,...scoreMeans(films)};
  });
}
export function platforms(rows:Appearance[]) {
  const films=uniqueAppearances(rows),services=new Map<string,{id:string;name:string;films:Set<string>;stream:Set<string>;access:Map<string,Set<string>>}>();
  for(const row of films)for(const offer of row.movie.au_watch_offers??[]){
    // Report-only exclusion: inspect original evidence before aliases can aggregate it.
    if(!offer.service_id||!offer.name.trim()||offer.name.toLowerCase().includes(' ads'))continue;
    const name=availabilityProviderName(offer.name.trim()),id=name.toLowerCase();
    // Also reject an advertising-specific display alias if one is introduced later.
    if(id.includes(' ads'))continue;
    const old=services.get(id)??{id,name,films:new Set<string>(),stream:new Set<string>(),access:new Map<string,Set<string>>()};
    if(order(name,old.name)<0)old.name=name;
    old.films.add(row.movie.id);if(['subscription','free','ads'].includes(offer.access_type))old.stream.add(row.movie.id);const set=old.access.get(offer.access_type)??new Set<string>();set.add(row.movie.id);old.access.set(offer.access_type,set);services.set(old.id,old);
  }
  return {population:films.length,values:withCutoffTies([...services.values()].filter(s=>s.stream.size>0).map(s=>({id:s.id,name:s.name,count:s.stream.size,percentage:films.length?s.stream.size/films.length*100:0,access:['subscription','free','ads','rent','buy'].flatMap(type=>s.access.has(type)?[{type,count:s.access.get(type)!.size}]:[])})).sort((a,b)=>b.count-a.count||order(a.name,b.name)||order(a.id,b.id)),v=>v.count)};
}
export const discoveryMinimumVotes=100;
export const cultMinimumGap=10;
/** Midrank percentiles: ties share (number below + half other equals)/(N-1); singleton = .5. */
export function percentile(value:number,values:number[]) {
  return values.length<2?.5:(values.filter(v=>v<value).length+(values.filter(v=>v===value).length-1)/2)/(values.length-1);
}
export function discoveries(rows:Appearance[]) {
  const eligible=uniqueAppearances(rows).flatMap(row=>{
    const audience=compositeScore(row.movie,'audience'),votes=audienceVotes(row.movie,'audience');
    return audience!==null&&votes!==null&&votes>=discoveryMinimumVotes?[{row,audience,votes,critic:compositeScore(row.movie,'critic')}]:[];
  });
  const scores=eligible.map(f=>f.audience),votes=eligible.map(f=>f.votes);
  const hidden=eligible.map(f=>({...f,rank:percentile(f.audience,scores)*(1-percentile(f.votes,votes))*100})).sort((a,b)=>b.rank-a.rank||filmOrder(a.row,b.row));
  const cult=eligible.flatMap(f=>f.critic!==null&&f.audience-f.critic>=cultMinimumGap?[{...f,critic:f.critic,gap:f.audience-f.critic}]:[]).sort((a,b)=>b.gap-a.gap||filmOrder(a.row,b.row));
  return {eligible:eligible.length,hidden:withCutoffTies(hidden,v=>v.rank),cult:withCutoffTies(cult,v=>v.gap)};
}
export function collectionSpotlight(rows:Appearance[],data:MetricsEnrichment) {
  const films=uniqueAppearances(rows),collections=new Map<number,{id:number;name:string;films:Appearance[]}>();let checked=0,standalone=0;
  for(const row of films){const evidence=data.movies[row.movie.id]?.collection;
    if(evidence?.status==='checked_none'){checked++;standalone++;}
    if(evidence?.status==='checked_present'&&positive(evidence.collection_id)&&evidence.collection_name?.trim()){
      checked++;const item=collections.get(evidence.collection_id)??{id:evidence.collection_id,name:evidence.collection_name,films:[]};
      if(order(evidence.collection_name,item.name)<0)item.name=evidence.collection_name;
      item.films.push(row);collections.set(item.id,item);
    }
  }
  const values=[...collections.values()].sort((a,b)=>b.films.length-a.films.length||order(a.name,b.name)||a.id-b.id),members=values.reduce((n,c)=>n+c.films.length,0);
  return {total:films.length,checked,standalone,members,percentage:checked?members/checked*100:null,values};
}
/** Completion always compares cached TMDB parts with the entire active club History. */
export function localCalendarDate(now=new Date()):string {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function collectionCompletion(all:Appearance[],data:MetricsEnrichment,asOf=localCalendarDate()) {
  const history=uniqueAppearances(all),tmdbId=(row:Appearance)=>{
    const id=row.movie.external_ids.find(id=>id.provider==='tmdb')?.external_id;
    return id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))?Number(id):null;
  };
  const groups=collectionSpotlight(history.filter(row=>data.movies[row.movie.id]?.collection?.external_id===String(tmdbId(row))),data).values.filter(group=>group.films.length>=2);
  let pending=0;
  const values=groups.flatMap(group=>{
    const evidence=data.collections?.[group.id],cached=evidence?.status==='checked'?evidence.roster:null;
    const roster=cached?parseCollectionRoster(cached,group.id,cached.checked_at):null;
    if(!roster || !group.films.every(row=>roster.parts.some(part=>part.id===tmdbId(row)))){pending++;return [];}
    const members=new Map(roster.parts.map(part=>[part.id,part]));
    const films=history.filter(row=>members.has(tmdbId(row) ?? -1));
    const selected=new Set(films.map(tmdbId));
    const partOrder=(a:typeof roster.parts[number],b:typeof roster.parts[number])=>{
      return a.release_date && b.release_date ? order(a.release_date,b.release_date)||order(a.title ?? '',b.title ?? '')||a.id-b.id : order(a.title ?? '',b.title ?? '')||a.id-b.id;
    };
    // Dated films first, then undated titles: a transitive, stable ordering.
    const stable=(a:typeof roster.parts[number],b:typeof roster.parts[number])=>Number(!a.release_date)-Number(!b.release_date)||partOrder(a,b);
    films.sort((a,b)=>stable(members.get(tmdbId(a)!)!,members.get(tmdbId(b)!)!));
    const eligible=roster.parts.filter(part=>selected.has(part.id)||!part.release_date||part.release_date<=asOf);
    const missing=eligible.filter(part=>!selected.has(part.id)).sort(stable);
    return [{id:group.id,name:roster.name,films,total:eligible.length,missing,checked_at:roster.checked_at}];
  }).sort((a,b)=>b.films.length-a.films.length||order(a.name,b.name)||a.id-b.id);
  return {completed:values.filter(group=>!group.missing.length),unrequited:values.filter(group=>group.missing.length),pending};
}
export function awardsReport(rows:Appearance[],data:MetricsEnrichment) {
  const films=uniqueAppearances(rows);let checked=0,unquantified=0,unavailable=0;
  const values=films.flatMap(row=>{
    const evidence=data.movies[row.movie.id]?.awards;if(!evidence)return [];
    if(evidence.status.startsWith('checked_'))checked++;
    if(evidence.status==='checked_unavailable')unavailable++;
    if(evidence.status==='checked_unquantified')unquantified++;
    const count=(n:number|null)=>n!==null&&Number.isSafeInteger(n)&&n>=0;
    return evidence.status==='checked_quantified'&&(count(evidence.wins)||count(evidence.nominations))?[{row,...evidence,critic:compositeScore(row.movie,'critic'),audience:compositeScore(row.movie,'audience')}]:[];
  }).sort((a,b)=>(b.wins??-1)-(a.wins??-1)||(b.nominations??-1)-(a.nominations??-1)||filmOrder(a.row,b.row));
  return {total:films.length,checked,unquantified,unavailable,values};
}
