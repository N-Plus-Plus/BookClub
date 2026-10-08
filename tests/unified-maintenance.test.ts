import { afterEach, expect, it, vi } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { UnifiedMaintenanceService } from '../worker/src/unified-maintenance';
import { planMaintenance, type MaintenanceCoverage } from '../shared/maintenance-plan';
import { tmdbEnrichmentFixture, mdbEnrichmentFixture } from './enrichment-fixtures';
import type { Env } from '../worker/src/http';

const fixtures:ReturnType<typeof disposableD1>[]=[];
function fixture(count=1) {
  const local=disposableD1();fixtures.push(local);
  for(let i=1;i<=count;i++) {
    const id=`film-${String(i).padStart(3,'0')}`;
    local.sqlite.prepare('INSERT INTO movies(id,title) VALUES(?,?)').run(id,`Film ${i}`);
    local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb',?)").run(id,String(i));
    local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'imdb',?)").run(id,`tt${String(i).padStart(7,'0')}`);
    local.sqlite.prepare("INSERT INTO classics(movie_id,source) VALUES(?,'member-added')").run(id);
  }
  const env:Env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'false',ALLOWED_ORIGINS:'http://localhost:4173',TMDB_READ_TOKEN:'fictional',MDBLIST_API_KEY:'fictional',OMDB_API_KEY:'fictional'};
  const repo=new Repository(local.db),service=new UnifiedMaintenanceService(repo,env);
  return {local,env,repo,service};
}
afterEach(()=>{for(const f of fixtures.splice(0))f.sqlite.close();vi.unstubAllGlobals();});
const counters={mdblist:0,tmdb:0,omdb:0};
function upstream(empty=false) {
  Object.assign(counters,{mdblist:0,tmdb:0,omdb:0});
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo | URL,init?:RequestInit)=>{
    const url=new URL(String(input));
    if(url.hostname==='api.mdblist.com') {
      counters.mdblist++;
      const body=JSON.parse(String(init?.body));
      return Response.json(body.ids.map((imdb:string)=>({...mdbEnrichmentFixture(imdb,Number(imdb.slice(2))),ids:{imdb,tmdb:Number(imdb.slice(2))},keywords:empty?[]:[{id:1,name:'keyword'}],ratings:empty?[]:mdbEnrichmentFixture().ratings})));
    }
    if(url.hostname==='www.omdbapi.com') {counters.omdb++;return Response.json({Response:'True',imdbID:url.searchParams.get('i'),Title:empty?'N/A':'OMDb title',Year:empty?'N/A':'2000',Runtime:empty?'N/A':'100 min',Director:empty?'N/A':'A director',Genre:empty?'N/A':'Drama',imdbRating:empty?'N/A':'8',Metascore:empty?'N/A':'80'});}
    counters.tmdb++;const id=Number(url.pathname.split('/').at(-1));
    const tmdb=tmdbEnrichmentFixture(id);tmdb.external_ids.imdb_id=`tt${String(id).padStart(7,'0')}`;
    if(empty)Object.assign(tmdb,{production_countries:[],spoken_languages:[],production_companies:[],credits:{cast:[],crew:[]},keywords:{keywords:[]},release_dates:{results:[]},budget:0,revenue:0,popularity:0,tagline:null,vote_average:null,vote_count:0,original_title:null,runtime:null,genres:[]});
    return Response.json(tmdb);
  }));
}
it('coordinates 36 refresh films with reproducible request savings and preserves independent provider refresh scope',async()=>{
  const {repo,service}=fixture(36);upstream();
  const catalog=await repo.catalog(),coverage=await service.status(null),plan=planMaintenance(catalog,coverage,'refresh');
  const startedAt=new Date().toISOString();
  for(const batch of plan.batches) {const result=await service.execute('refresh',batch,startedAt);expect(result.results).toHaveLength(batch.length);expect(result.stopped).toBeUndefined();}
  expect(counters).toEqual({mdblist:4,omdb:36,tmdb:36});
  const naive=36+36+36+4+4;expect(naive).toBe(116);expect(Object.values(counters).reduce((a,b)=>a+b,0)).toBe(76);
  for(const c of plan.calls) {expect(counters[c.provider]).toBeGreaterThanOrEqual(c.min);expect(counters[c.provider]).toBeLessThanOrEqual(c.max);}
  expect((await repo.movieDetails(['film-001']))[0].scores.length).toBe(6);
});
it('successful empty provider checks are durable and a repeated Populate makes zero requests',async()=>{
  const {repo,service,local}=fixture();upstream(true);
  let plan=planMaintenance(await repo.catalog(),await service.status(null),'populate');
  for(const batch of plan.batches)expect((await service.execute('populate',batch,new Date().toISOString())).stopped).toBeUndefined();
  expect(counters).toEqual({mdblist:1,omdb:1,tmdb:1});
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movie_score_checks WHERE available=0').get()?.n).toBe(6);
  plan=planMaintenance(await repo.catalog(),await service.status(null),'populate');expect(plan.units).toHaveLength(0);
  expect(planMaintenance(await repo.catalog(),await service.status(null),'refresh').units).toHaveLength(3);
});
it('does not refresh stale successful metadata or empty enrichment in Populate, and keeps non-score catalogue scope',async()=>{
  const {repo,service,local}=fixture();upstream(true);
  local.sqlite.exec('DELETE FROM classics');
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'populate');
  expect(plan.units.every(u=>!u.operations.includes('scores'))).toBe(true);
  for(const batch of plan.batches)await service.execute('populate',batch,new Date().toISOString());
  local.sqlite.exec("UPDATE movies SET tmdb_metadata_checked_at='2000-01-01',tmdb_artwork_checked_at='2000-01-01'");
  expect(planMaintenance(await repo.catalog(),await service.status(null),'populate').units).toHaveLength(0);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(0);
});
it('fails safely before upstream calls on missing schema, malformed capture or identity conflict',async()=>{
  const {repo,service,local}=fixture();upstream();
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'refresh');
  const tmdb=plan.units.find(u=>u.provider==='tmdb')!;
  const conflict={...tmdb,identity:{...tmdb.identity,external_id:'99'}};
  expect((await service.execute('refresh',[conflict],new Date().toISOString())).results[0].status).toBe('failed');expect(counters.tmdb).toBe(0);
  local.sqlite.exec('DROP TABLE movie_maintenance_coverage');
  await expect(service.execute('refresh',[tmdb],new Date().toISOString())).rejects.toMatchObject({code:'SCHEMA_UPGRADE_REQUIRED'});expect(counters.tmdb).toBe(0);
});
it('respects persisted cooldown and quota reserve while retaining committed batch results',async()=>{
  const {repo,service}=fixture();upstream();
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'refresh');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([mdbEnrichmentFixture('tt0000001',1)],{headers:{'X-RateLimit-Remaining':'25','X-RateLimit-Reset':'60'}})));
  const result=await service.execute('refresh',[plan.units.find(u=>u.provider==='mdblist')!],new Date().toISOString());
  expect(result.stopped).toBe(true);expect(result.results[0].status).toBe('updated');expect(await repo.providerCooldown('mdblist',true)).toBeGreaterThan(0);
  expect((await service.status(null)).unavailable.mdblist).toContain('Cooling down');
});
it('uses read-only coverage and excludes missing identities/unavailable credentials from plans',async()=>{
  const {repo,service,local,env}=fixture();
  await repo.setProviderCooldown('tmdb',0);
  const before=local.sqlite.prepare('SELECT count(*) AS n FROM provider_cooldowns').get()?.n;
  env.MDBLIST_API_KEY=undefined;local.sqlite.exec("DELETE FROM movie_external_ids WHERE provider='imdb'");
  const coverage:MaintenanceCoverage=await service.status(null);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM provider_cooldowns').get()?.n).toBe(before);
  const plan=planMaintenance(await repo.catalog(),coverage,'refresh');expect(plan.units.every(u=>u.provider==='tmdb')).toBe(true);expect(plan.blocked).toBe(1);
});
it('malformed TMDB captures retain earlier canonical/cache data and record only inconclusive failure',async()=>{
  const {repo,service,local}=fixture();upstream();
  const unit=planMaintenance(await repo.catalog(),await service.status(null),'refresh',['tmdb-metadata','tmdb-enrichment']).units[0];
  await service.execute('refresh',[unit],new Date().toISOString());
  const before=local.sqlite.prepare('SELECT title,runtime,tmdb_metadata_checked_at FROM movies').get();
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(1),runtime:'malformed'})));
  const result=await service.execute('refresh',[unit],new Date().toISOString());
  expect(result.results[0].status).toBe('failed');expect(local.sqlite.prepare('SELECT title,runtime,tmdb_metadata_checked_at FROM movies').get()).toEqual(before);
  expect((await service.status(null)).failures).toHaveLength(2);
});
it('Populate preserves populated OMDb scalars/genres while Refresh applies supplied updates',async()=>{
  const {repo,service,local}=fixture();upstream();
  local.sqlite.exec("UPDATE movies SET year=1990,runtime=90,director='Stored director';INSERT INTO movie_genres VALUES('film-001','Comedy')");
  const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['omdb-metadata']).units[0];
  await service.execute('populate',[unit],new Date().toISOString());
  expect(local.sqlite.prepare('SELECT year,runtime,director FROM movies').get()).toEqual({year:1990,runtime:90,director:'Stored director'});
  expect(local.sqlite.prepare('SELECT genre FROM movie_genres').get()?.genre).toBe('Comedy');
  expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['omdb-metadata']).units).toHaveLength(0);
  await service.execute('refresh',[unit],new Date().toISOString());expect(local.sqlite.prepare('SELECT year,runtime FROM movies').get()).toEqual({year:2000,runtime:100});
});
it('Refresh records fresh confirmed absence while retaining older usable score observations',async()=>{
  const {repo,service,local}=fixture();upstream(true);
  await repo.appendScores('film-001',[{provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:100,fetched_at:'2000-01-01T00:00:00.000Z',retrieved_via:'omdb'}]);
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'refresh'),startedAt=new Date().toISOString();
  for(const batch of plan.batches)await service.execute('refresh',batch,startedAt);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movie_score_checks WHERE available=0').get()?.n).toBe(6);
  expect(local.sqlite.prepare('SELECT raw_value,fetched_at FROM source_scores').get()).toEqual({raw_value:8,fetched_at:'2000-01-01T00:00:00.000Z'});
});
it('recognises stored TMDB artwork as positive evidence when an older artwork marker is absent',async()=>{
  const {repo,service}=fixture();
  const catalog=await repo.catalog(),movie=catalog.movies[0];
  Object.assign(movie,{original_title:'Original',release_date:'2000-01-01',runtime:100,director:'Director',overview:'Overview',genres:['Drama'],tmdb_metadata_checked_at:'2000-01-01',tmdb_artwork_checked_at:null,assets:['poster','backdrop'].map(asset_type=>({provider:'tmdb',asset_type,reference:'/stored',preferred:1,width:null,height:null}))});
  const coverage=await service.status(null);
  expect(planMaintenance(catalog,coverage,'populate',['tmdb-metadata']).units).toHaveLength(0);
  movie.assets.pop();expect(planMaintenance(catalog,coverage,'populate',['tmdb-metadata']).units).toHaveLength(1);
});
