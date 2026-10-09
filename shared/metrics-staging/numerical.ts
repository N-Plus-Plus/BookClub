import type { Catalog } from '../types';
import { compositeScore, uniqueAppearances, tiedExtreme, type Appearance, type MetricsFilter } from '../metrics';
import { contributorScopes, filterContributorScopes } from '../metrics-enrichment';

export const mean = (values:number[]) => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
export const positive = (value:number|null|undefined):value is number => typeof value === 'number' && Number.isFinite(value) && value>0;
export function paired(row:Appearance) {
  const critic=compositeScore(row.movie,'critic'),audience=compositeScore(row.movie,'audience');
  return critic === null || audience === null ? null : {critic,audience,difference:audience-critic};
}
export function scoreMeans(rows:Appearance[]) {
  const critics=rows.map(row=>compositeScore(row.movie,'critic')).filter((n):n is number=>n!==null);
  const audiences=rows.map(row=>compositeScore(row.movie,'audience')).filter((n):n is number=>n!==null);
  return {critic:mean(critics),audience:mean(audiences),criticCount:critics.length,audienceCount:audiences.length};
}
/** Structural five-turn evidence, stricter than the chronological Home milestone. */
export function cycleScorecards(catalog:Catalog,all:Appearance[],rows:Appearance[]) {
  return catalog.cycles.filter(cycle=>{
    const sessions=catalog.sessions.filter(s=>!s.deleted_at && s.cycle_id===cycle.id);
    if(sessions.length!==5)return false;
    for(let slot=1;slot<=5;slot++) {
      const matches=sessions.filter(s=>s.cycle_slot===slot);
      if(matches.length!==1)return false;
      const s=matches[0],classics=slot===(cycle.classics_first===1?1:5);
      if(s.kind!==(classics?'classics':'hosted') || (classics?s.host_member_id!==null:!s.host_member_id))return false;
      // Imported positional History is completion evidence; modern turns require explicit completion.
      if(s.completed_turn_version==null && !(cycle.import_source && cycle.import_key))return false;
    }
    return all.some(row=>row.session.cycle_id===cycle.id);
  }).sort((a,b)=>b.ordinal-a.ordinal || b.id.localeCompare(a.id)).map(cycle=>({cycle,...scoreMeans(rows.filter(row=>row.session.cycle_id===cycle.id))}));
}
export function contributorSpreads(catalog:Catalog,all:Appearance[],filter:MetricsFilter,dimension:'year'|'runtime') {
  const groups=contributorScopes(catalog,all).map((scope,index)=>{
    const values=scope.rows.map(row=>row.movie[dimension]).filter((n):n is number=>positive(n) && (dimension!=='year' || Number.isInteger(n) && n>=1000 && n<=9999));
    const average=mean(values),sd=average===null?null:Math.sqrt(values.reduce((sum,n)=>sum+(n-average)**2,0)/values.length);
    const low=average===null?null:dimension==='year'?average-(sd??0):Math.min(...values);
    const high=average===null?null:dimension==='year'?average+(sd??0):Math.max(...values);
    return {...scope,colour:index%2===0?'jeans':'lavender',count:values.length,mean:average,sd,low,high,oldest:values.length?Math.min(...values):null,newest:values.length?Math.max(...values):null};
  });
  const ends=groups.flatMap(g=>g.oldest===null||g.newest===null?[]:[g.oldest,g.newest]);
  const minimum=ends.length?Math.floor(Math.min(...ends)):0,maximum=ends.length?Math.ceil(Math.max(...ends)):1;
  return {groups:filterContributorScopes(groups,filter),minimum,maximum:maximum===minimum?minimum+1:maximum};
}
export function contributorLeaning(catalog:Catalog,all:Appearance[],filter:MetricsFilter) {
  return filterContributorScopes(contributorScopes(catalog,all),filter).map(scope=>{
    let critic=0,audience=0,neutral=0;
    for(const row of scope.rows){const scores=paired(row);if(scores){if(scores.difference>0)audience++;else if(scores.difference<0)critic++;else neutral++;}}
    const count=critic+audience+neutral;
    return {...scope,critic,audience,neutral,count,leaning:count?(audience-critic)/count*100:null};
  });
}
export function receptionExtremes(rows:Appearance[]) {
  const films=uniqueAppearances(rows).flatMap(row=>{const scores=paired(row);return scores?[{row,...scores,gap:Math.abs(scores.difference)}]:[];});
  return {aligned:tiedExtreme(films,f=>f.gap,'min'),misaligned:tiedExtreme(films,f=>f.gap)};
}
export function classicsViewed(catalog:Catalog) {
  const humans=catalog.members.filter(m=>m.sort_order>=1&&m.sort_order<=4).sort((a,b)=>a.sort_order-b.sort_order);
  const pool=[...new Map(catalog.movies.filter(m=>m.classic).map(m=>[m.id,m])).values()].filter(movie=>humans.length===4&&humans.every(member=>{
    const answers=movie.seen.filter(s=>s.member_id===member.id);return answers.length===1 && (answers[0].seen===0||answers[0].seen===1);
  }));
  const values=humans.map(member=>({member,count:pool.filter(m=>m.seen.some(s=>s.member_id===member.id&&s.seen===1)).length}));
  return {pool:pool.length,most:pool.length?tiedExtreme(values,v=>v.count):null,least:pool.length?tiedExtreme(values,v=>v.count,'min'):null};
}
