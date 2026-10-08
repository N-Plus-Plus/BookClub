import { availabilityProviderName } from '../availability-provider-name';
import { order } from '../metrics-enrichment/facts';
import type { Catalog } from '../types';
import { compositeScore, audienceVotes, uniqueAppearances, withCutoffTies, type Appearance, type MetricsFilter } from '../metrics';
import { normalizedGenres } from '../genres';
import { contributorScopes, filterContributorScopes, metricsTalentReader, australianClassification, classificationCategories, emptyEnrichmentMovie, type MetricsEnrichment } from '../metrics-enrichment';
import { positive, paired, scoreMeans } from './numerical';

const filmOrder=(a:Appearance,b:Appearance)=>order(a.movie.title,b.movie.title)||order(a.movie.id,b.movie.id);
export function sharedStars(catalog:Catalog,all:Appearance[],data:MetricsEnrichment,filter:MetricsFilter) {
  const scopes=contributorScopes(catalog,all),read=metricsTalentReader(data,'Cast');
  const humanIndices=scopes.flatMap((s,i)=>s.filter.kind==='member'?[i]:[]);
  const actors=new Map<string,{id:string;label:string;appearances:number;films:Map<string,Appearance>;contributors:Set<number>}>();
  scopes.forEach((scope,index)=>{for(const row of scope.rows)for(const person of read(row)){
    let actor=actors.get(person.id);if(!actor){actor={...person,appearances:0,films:new Map(),contributors:new Set()};actors.set(person.id,actor);}
    if(order(person.label,actor.label)<0)actor.label=person.label;
    actor.appearances++;actor.films.set(row.movie.id,row);actor.contributors.add(index);
  }});
  const selected=filterContributorScopes(scopes,filter);
  return [...actors.values()].filter(a=>a.contributors.size>=3 && (filter.kind==='all'||[...a.contributors].some(i=>selected.includes(scopes[i])))).map(a=>({id:a.id,label:a.label,appearances:a.appearances,films:[...a.films.values()].sort(filmOrder),contributors:[...a.contributors].sort().map(i=>scopes[i]),tier:humanIndices.length===4&&humanIndices.every(i=>a.contributors.has(i))?0:a.contributors.size>=4?1:2})).sort((a,b)=>a.tier-b.tier||b.appearances-a.appearances||b.films.length-a.films.length||order(a.label,b.label)||order(a.id,b.id));
}
export function partnerships(rows:Appearance[],data:MetricsEnrichment) {
  return (['Writer','Composer','Cinematographer'] as const).map(role=>{
    const read=metricsTalentReader(data,role),directors=metricsTalentReader(data,'Director');
    const pairs=new Map<string,{id:string;director:string;partner:string;films:Appearance[]}>();
    for(const row of uniqueAppearances(rows))for(const director of directors(row))for(const partner of read(row)){
      // The entire canonical name-only director credit is one identity; do not guess delimiters.
      const id=JSON.stringify([director.id,partner.id]);
      const pair=pairs.get(id)??{id,director:director.label,partner:partner.label,films:[]};pair.films.push(row);pairs.set(id,pair);
    }
    return {role,values:[...pairs.values()].sort((a,b)=>b.films.length-a.films.length||order(a.director,b.director)||order(a.partner,b.partner)||order(a.id,b.id))};
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
  const films=uniqueAppearances(rows),services=new Map<string,{id:string;name:string;films:Set<string>;access:Map<string,Set<string>>}>();
  for(const row of films)for(const offer of row.movie.au_watch_offers??[]){
    if(!offer.service_id||!offer.name.trim())continue;
    const name=availabilityProviderName(offer.name.trim()),id=name.toLowerCase();
    const old=services.get(id)??{id,name,films:new Set<string>(),access:new Map<string,Set<string>>()};
    if(order(name,old.name)<0)old.name=name;
    old.films.add(row.movie.id);const set=old.access.get(offer.access_type)??new Set<string>();set.add(row.movie.id);old.access.set(offer.access_type,set);services.set(old.id,old);
  }
  return {population:films.length,values:[...services.values()].map(s=>({id:s.id,name:s.name,count:s.films.size,percentage:films.length?s.films.size/films.length*100:0,access:['subscription','free','ads','rent','buy'].flatMap(type=>s.access.has(type)?[{type,count:s.access.get(type)!.size}]:[])})).sort((a,b)=>b.count-a.count||order(a.name,b.name)||order(a.id,b.id))};
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
