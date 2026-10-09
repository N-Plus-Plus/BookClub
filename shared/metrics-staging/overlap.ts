import { order, themeReader } from '../metrics-enrichment/facts';
import type { Catalog } from '../types';
import { normalizedGenres } from '../genres';
import { uniqueAppearances, withCutoffTies, type Appearance } from '../metrics';
import { contributorScopes, frequency, type MetricsEnrichment } from '../metrics-enrichment';

/** At most 2^19 nodes across the finite vocabulary. Support is anti-monotone:
 * once a prefix falls below the current fifth-place count, none of its supersets can qualify. */
export function genreCombinations(rows:Appearance[]) {
  const signatures=new Map<string,{genres:string[];count:number}>();
  for(const row of uniqueAppearances(rows)){
    const genres=normalizedGenres(row.movie.genres),key=genres.join('|');
    if(genres.length>=2)signatures.set(key,{genres,count:(signatures.get(key)?.count??0)+1});
  }
  const population=[...signatures.values()],vocabulary=[...new Set(population.flatMap(s=>s.genres))].sort(order);
  let threshold=1;const leaders:number[]=[],result:{label:string;count:number}[]=[];
  const walk=(prefix:string[],from:number,supported:typeof population)=>{
    for(let i=from;i<vocabulary.length;i++){
      const genre=vocabulary[i],subset=supported.filter(s=>s.genres.includes(genre)),count=subset.reduce((n,s)=>n+s.count,0);
      if(count<threshold)continue;
      const combination=[...prefix,genre];
      if(combination.length>=2){result.push({label:combination.join(' + '),count});leaders.push(count);leaders.sort((a,b)=>b-a);leaders.length=Math.min(5,leaders.length);if(leaders.length===5)threshold=leaders[4];}
      walk(combination,i+1,subset);
    }
  };
  walk([],0,population);
  return withCutoffTies(result.filter(v=>v.count>=threshold).sort((a,b)=>b.count-a.count||order(a.label,b.label)),v=>v.count);
}
export function genreOverlap(catalog:Catalog,all:Appearance[]) {
  const scopes=contributorScopes(catalog,all);
  const distributions=scopes.map(scope=>{
    const counts=new Map<string,number>();
    for(const row of scope.rows){const genres=normalizedGenres(row.movie.genres);for(const genre of genres)counts.set(genre,(counts.get(genre)??0)+1/genres.length);}
    return counts;
  });
  const values=distributions.map(a=>distributions.map(b=>{
    const normA=Math.sqrt([...a.values()].reduce((n,v)=>n+v*v,0)),normB=Math.sqrt([...b.values()].reduce((n,v)=>n+v*v,0));
    if(!normA||!normB)return null;
    return Math.min(100,Math.max(0,[...a].reduce((n,[k,v])=>n+v*(b.get(k)??0),0)/normA/normB*100));
  }));
  const colours=values.map(row=>row.map(()=>null as string|null));
  const palette=['emerald','grass','avacado','sunflower','pumpkin','carrot','grapefruit','ruby','rose','lavender'];
  const pairs=values.flatMap((row,a)=>row.flatMap((value,b)=>b>a&&value!==null?[{a,b,value}]:[]));
  pairs.sort((x,y)=>y.value-x.value||x.a-y.a||x.b-y.b).forEach(({a,b},rank)=>{colours[a][b]=colours[b][a]=palette[rank];});
  return {scopes,values,colours};
}
export function firstSharedTheme(catalog:Catalog,all:Appearance[],data:MetricsEnrichment) {
  const scopes=contributorScopes(catalog,all),read=themeReader(data);
  const lists=scopes.map(scope=>frequency(scope.rows,read).values.map((fact,index)=>({...fact,rank:index+1})));
  const candidates=lists.map(a=>lists.map(b=>{
    const byId=new Map(b.map(f=>[f.id,f]));
    const common=a.flatMap(f=>{const other=byId.get(f.id);return other?[{id:f.id,label:order(f.label,other.label)<=0?f.label:other.label,rankA:f.rank,rankB:other.rank,countA:f.count,countB:other.count}]:[];});
    return common.sort((x,y)=>Math.max(x.rankA,x.rankB)-Math.max(y.rankA,y.rankB) || x.rankA+x.rankB-y.rankA-y.rankB || order(x.label,y.label)||order(x.id,y.id));
  }));
  const pairs=candidates.flatMap((row,a)=>row.flatMap((list,b)=>b>a?[{a,b,list,index:0}]:[]));
  // Advance every conflicting pair simultaneously, including previously uncontested pairs
  // when another pair reaches their term. Each preference list is finite.
  while(true){
    const terms=new Map<string,typeof pairs>();
    for(const pair of pairs){const candidate=pair.list[pair.index];if(!candidate)continue;
      const key=candidate.label.toLocaleLowerCase('en-AU');
      const matches=terms.get(key)??[];matches.push(pair);terms.set(key,matches);
    }
    const conflicts=[...terms.values()].filter(matches=>matches.length>1).flat();
    if(!conflicts.length)break;
    for(const pair of conflicts)pair.index++;
  }
  type Candidate=typeof candidates[number][number][number];
  const values:(Candidate|null)[][]=scopes.map(()=>scopes.map(()=>null));
  for(const {a,b,list,index} of pairs){const value=list[index]??null;values[a][b]=value;
    values[b][a]=value?{...value,rankA:value.rankB,rankB:value.rankA,countA:value.countB,countB:value.countA}:null;
  }
  return {scopes,values};
}
