import { expect, it } from 'vitest';
import { classifyFilm,filmLocations } from '../shared/data-health';
import type { MovieDetail, Score } from '../shared/types';
import { rankMovie,requiredScores } from '../shared/ranking';
import { maintenanceContract } from '../shared/maintenance-contract';
import type { MaintenanceCoverage, MaintenanceOperation } from '../shared/maintenance-plan';
const members=[{id:'human',display_name:'Human',active:1,sort_order:1}];
const score=(key='imdb:rating'):Score=>({provider:key.split(':')[0],metric:key.split(':')[1],raw_value:80,raw_scale:100,normalized_value:80,vote_count:null,fetched_at:new Date().toISOString(),retrieved_via:'mdblist'});
function film():MovieDetail{return {id:'film',title:'Film',year:2000,release_date:'2000-01-01',runtime:100,director:'Director',genres:['Drama'],overview:'Overview',original_title:'Film',assets:[{provider:'tmdb',asset_type:'poster',reference:'/poster.jpg',width:null,height:null,preferred:1}],external_ids:[{provider:'imdb',external_id:'tt1234567'},{provider:'tmdb',external_id:'123'}],scores:requiredScores.map(key=>score(key)),seen:[],classic:false,ranking:null,appearances:[]};}
function coverage():MaintenanceCoverage{return {checks:[],negativeScores:[],enrichment:[],fields:[],fieldsSupported:true,unavailable:{omdb:null,tmdb:null,mdblist:null}};}
const locations=(m:MovieDetail,extra={builderCount:0,predictions:[] as string[],archivedCount:0})=>filmLocations(m,extra,new Map([['human','Human']]));
const issues=(m:MovieDetail,c=coverage())=>classifyFilm(m,c,locations(m),[]).issues;
it('keeps missing and invalid identities and each canonical deficiency separate',()=>{
  const m=film();m.external_ids=[{provider:'imdb',external_id:'wrong'}];m.release_date=null;m.year=null;m.runtime=0;m.director=null;m.genres=[];m.overview=null;m.assets=[];
  expect(issues(m).map(i=>i.code)).toEqual(expect.arrayContaining(['identity-imdb','identity-tmdb','missing-release','missing-year','missing-runtime','missing-director','missing-genres','missing-overview','missing-poster']));
});
it('distinguishes unchecked, failed, confirmed-unavailable and identity-obsolete evidence without outstanding confirmed requests',()=>{
  const m=film(),c=coverage();m.assets=[];
  expect(issues(m,c).find(i=>i.code==='missing-poster')?.state).toBe('unchecked');
  c.failures=[{movie_id:m.id,provider:'tmdb',operation:'tmdb-metadata',attempted_at:'2026-01-01'}];
  expect(issues(m,c).find(i=>i.code==='missing-poster')?.state).toBe('inconclusive');
  c.fields=[{movie_id:m.id,provider:'tmdb',operation:'tmdb-metadata',identity_provider:'tmdb',external_id:'123',fields:Object.fromEntries(maintenanceContract['tmdb-metadata'].fields.map(f=>[f.id,{state:f.id==='poster'?'checked_unavailable':'present',checked_at:new Date().toISOString()}]))}];
  expect(issues(m,c).find(i=>i.code==='missing-poster')).toMatchObject({state:'checked_unavailable',priority:'confirmed'});
  expect(issues(m,c).some(i=>i.code==='coverage-tmdb-metadata')).toBe(false);
  c.fields[0].external_id='999';expect(issues(m,c).find(i=>i.code==='missing-poster')?.state).toBe('inconclusive');
});
it('uses authoritative Classics ranking and History precedence, keeping missing Seen unranked and all Seen DQ',()=>{
  const m=film();m.classic=true;m.ranking=rankMovie(m.scores,[],members);
  expect(locations(m)).toContainEqual({kind:'unranked',label:'Unranked Classic'});
  m.ranking=rankMovie(m.scores,[{member_id:'human',seen:0,updated_at:''}],members);expect(locations(m)[0].kind).toBe('ranked');
  m.ranking=rankMovie(m.scores,[{member_id:'human',seen:1,updated_at:''}],members);expect(locations(m)[0].kind).toBe('dq');
  m.ranking=rankMovie(m.scores,[],members);m.appearances=[{id:'event',event_date:'',date_precision:'unknown',kind:'hosted',host_member_id:'human',position:1}];expect(locations(m).map(l=>l.kind)).toEqual(['history','dq']);
});
it('identifies no scores with and without ranking impact and imputed dimensions',()=>{
  const m=film();m.scores=[];expect(issues(m).find(i=>i.code==='no-ratings')?.priority).toBe('review');
  m.classic=true;m.ranking=rankMovie([],[],members);expect(issues(m).find(i=>i.code==='no-ratings')?.priority).toBe('blocking');
  m.scores=[score()];m.ranking=rankMovie(m.scores,[],members);expect(issues(m).find(i=>i.code==='rating-tmdb:rating')?.priority).toBe('actionable');
  const c=coverage();c.fieldsSupported=false;c.negativeScores=[{movie_id:'film',score_key:'tmdb:rating'}];expect(issues(m,c).find(i=>i.code==='rating-tmdb:rating')?.priority).toBe('confirmed');
});
it('retains simultaneous contexts and claims, including another film owning a claimed ID',()=>{
  const m=film();m.classic=true;m.ranking=rankMovie(m.scores,[],members);m.appearances=[{id:'one',kind:'hosted',host_member_id:'human',event_date:'',date_precision:'unknown',position:1},{id:'two',kind:'classics',host_member_id:null,event_date:'',date_precision:'unknown',position:1}];
  const loc=locations(m,{builderCount:2,predictions:['Human','Other'],archivedCount:1});expect(loc.map(l=>l.kind)).toEqual(['history','history','dq','builder','prediction','archived']);
  const result=classifyFilm(m,coverage(),loc,[{provider:'mdblist',identity_provider:'imdb',external_id:'tt9999999',fetched_at:'2026-01-01',owner_movie_id:'other'}]);expect(result.issues.find(i=>i.code.startsWith('claim'))).toMatchObject({label:'Conflicting IMDb identity',priority:'actionable'});
});
it('excludes fully healthy films and ordinary checked optional absences, and uses only authoritative metadata staleness',()=>{
  const m=film(),c=coverage();
  for(const operation of ['omdb-metadata','tmdb-metadata','tmdb-enrichment','mdblist-enrichment','tmdb-collections','omdb-awards'] as MaintenanceOperation[]){const provider=operation.startsWith('tmdb')?'tmdb':operation.startsWith('omdb')?'omdb':'mdblist';c.fields!.push({movie_id:m.id,provider,operation,identity_provider:provider==='tmdb'?'tmdb':'imdb',external_id:provider==='tmdb'?'123':'tt1234567',fields:Object.fromEntries(maintenanceContract[operation].fields.map(f=>[f.id,{state:f.optional?'checked_unavailable':'present',checked_at:new Date().toISOString()}]))});}
  expect(issues(m,c)).toEqual([]);
  const tmdb=c.fields!.find(f=>f.operation==='tmdb-metadata')!;Object.values(tmdb.fields).forEach(f=>{f.state='present';f.checked_at='2000-01-01';});
  expect(issues(m,c).find(i=>i.code==='coverage-tmdb-metadata')?.state).toBe('stale');
});
