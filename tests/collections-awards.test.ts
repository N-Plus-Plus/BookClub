import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { disposableD1 } from './d1';
import { parseAwards, parseAwardCounts, parseCollection } from '../shared/provider-evidence';
import { Repository } from '../worker/src/repository';
import { UnifiedMaintenanceService } from '../worker/src/unified-maintenance';
import { MetricsRepository } from '../worker/src/metrics-repository';
import { planMaintenance, operationCoverage, type MaintenanceOperation } from '../shared/maintenance-plan';
import { TmdbProvider } from '../worker/src/providers/tmdb';
import { OmdbProvider } from '../worker/src/providers/omdb';
import { EnrichmentService } from '../worker/src/enrichment-service';
import { ScoreService } from '../worker/src/score-service';
import { copySnapshot } from '../scripts/dev/snapshot';
import { tmdbEnrichmentFixture } from './enrichment-fixtures';
import { loadUnifiedCheckpoint, reconcileUnifiedCheckpoint, type UnifiedCheckpoint } from '../frontend/unified-maintenance';
import type { Env } from '../worker/src/http';

const at='2026-01-01T00:00:00.000Z';
const fixtures:ReturnType<typeof disposableD1>[]=[];
function fixture(last?:string) {
  const local=disposableD1(last);fixtures.push(local);
  local.sqlite.exec("INSERT INTO movies(id,title) VALUES('film','Original title');INSERT INTO movie_external_ids VALUES('film','tmdb','42'),('film','imdb','tt0000042');INSERT INTO classics(movie_id,source) VALUES('film','member-added')");
  const repo=new Repository(local.db),env:Env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'false',ALLOWED_ORIGINS:'http://localhost:4173',TMDB_READ_TOKEN:'fictional',OMDB_API_KEY:'fictional'};
  return {local,repo,env,service:new UnifiedMaintenanceService(repo,env)};
}
afterEach(()=>{fixtures.splice(0).forEach(f=>f.sqlite.close());vi.unstubAllGlobals();vi.restoreAllMocks();});
function upstream(collection:unknown=null,awards:unknown='N/A') {
  const fetch=vi.fn(async(input:RequestInfo | URL)=>String(input).includes('omdbapi') ? Response.json({Response:'True',imdbID:'tt0000042',Title:'OMDb title',Awards:awards,imdbRating:'8',Metascore:'80'}) : Response.json({...tmdbEnrichmentFixture(),belongs_to_collection:collection}));
  vi.stubGlobal('fetch',fetch);return fetch;
}
it('validates positive collections, explicit negatives and malformed or missing evidence',()=>{
  expect(parseCollection({id:7,name:'  A collection  '},'42',at)).toMatchObject({collection_id:7,collection_name:'A collection'});
  expect(parseCollection(null,'42',at)).toMatchObject({collection_id:null,collection_name:null});
  for(const v of [undefined,[],{},'none',{id:0,name:'A'},{id:-1,name:'A'},{id:1.2,name:'A'},{id:'7',name:'A'},{id:7,name:' '},{id:7,name:3}]) expect(parseCollection(v,'42',at)).toBeUndefined();
});
it.each([
  ['Won 2 Oscars. 12 wins & 30 nominations.',12,30],
  ['Nominated for 3 BAFTAs. 0 wins & 5 nominations.',0,5],
  ['Won 1 Oscar. Another 2 wins & 3 nominations.',null,null],
  ['Won 2 Oscars.',null,null],
  ['2 wins. 3 nominations.',2,3],
  ['0 wins & 0 nominations.',0,0],
  ['10 wins & 20 nominations. 5 wins & 6 nominations.',null,null],
  ['Winner of many awards',null,null],
])('parses conservative aggregate counts from %s', (text,wins,nominations)=>expect(parseAwardCounts(text)).toEqual({wins,nominations}));
it('retains original awards wording and distinguishes unavailable, unquantified, missing and malformed',()=>{
  expect(parseAwards('  Won an Oscar.  ','tt0000042',at)).toMatchObject({awards_text:'  Won an Oscar.  ',wins:null,nominations:null});
  expect(parseAwards('N/A','tt0000042',at)).toMatchObject({awards_text:null,wins:null,nominations:null});
  for(const v of [undefined,null,42,{},[], '', ' ', 'bad\u0000text']) expect(parseAwards(v,'tt0000042',at)).toBeUndefined();
});
it('requires the response identity for both adapters and awards capture',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(99),belongs_to_collection:null})));
  await expect(new TmdbProvider('fictional').details('42')).rejects.toMatchObject({code:'IDENTITY_CONFLICT'});
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'True',imdbID:'tt0000099',Awards:'N/A'})));
  await expect(new OmdbProvider('fictional').details('tt0000042')).rejects.toThrow();
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'True',Awards:'N/A'})));
  expect((await new OmdbProvider('fictional').details('tt0000042')).awards).toBeUndefined();
});
it('coalesces all TMDB and OMDb operations and repeats Populate without requests',async()=>{
  const {repo,service,local}=fixture(),fetch=upstream({id:7,name:'Series'},'Won 1 Oscar. 3 wins & 5 nominations.');
  const operations:MaintenanceOperation[]=['tmdb-metadata','tmdb-enrichment','tmdb-collections','omdb-metadata','omdb-awards','scores'];
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'populate',operations);
  expect(plan.units).toHaveLength(2);expect(plan.calls.filter(c=>c.provider!=='mdblist')).toEqual([{provider:'omdb',min:1,max:2},{provider:'tmdb',min:1,max:1}]);
  for(const batch of plan.batches) expect((await service.execute('populate',batch,at)).results[0].status).toBe('updated');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(local.sqlite.prepare('SELECT collection_id FROM movie_provider_collections').get()?.collection_id).toBe(7);
  expect(local.sqlite.prepare('SELECT wins,nominations FROM movie_provider_awards').get()).toEqual({wins:3,nominations:5});
  const coverage=await service.status(null);expect(planMaintenance(await repo.catalog(),coverage,'populate',operations).units).toHaveLength(0);
  for(const batch of plan.batches) expect((await service.execute('populate',batch,at)).results[0].status).toBe('skipped');
  expect(fetch).toHaveBeenCalledTimes(2);expect((await repo.movieDetails(['film']))[0].title).toBe('OMDb title');
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(3);
});
it('Refresh replaces positives with valid negatives and back again while failures preserve validated evidence',async()=>{
  const {repo,service,local}=fixture();
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'refresh',['tmdb-collections','omdb-awards']);
  for(const [collection,awards] of [[{id:7,name:'Series'},'3 wins & 5 nominations.'],[null,'N/A'],[{id:9,name:'New series'},'Unquantified prize']] as const) {
    upstream(collection,awards);for(const batch of plan.batches)expect((await service.execute('refresh',batch,at)).results[0].status).not.toBe('failed');
    expect(local.sqlite.prepare('SELECT collection_id FROM movie_provider_collections').get()?.collection_id).toBe(collection?.id ?? null);
    expect(local.sqlite.prepare('SELECT awards_text FROM movie_provider_awards').get()?.awards_text).toBe(awards==='N/A'?null:awards);
    expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-collections','omdb-awards']).units).toEqual([]);
  }
  const before=[local.sqlite.prepare('SELECT * FROM movie_provider_collections').get(),local.sqlite.prepare('SELECT * FROM movie_provider_awards').get()];
  for(const malformed of [true,false]) {
    if(malformed)upstream({id:-1,name:'Bad'},null);else vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('synthetic outage');}));
    for(const batch of plan.batches) expect((await service.execute('refresh',batch,at)).results[0].status).toBe('failed');
    expect([local.sqlite.prepare('SELECT * FROM movie_provider_collections').get(),local.sqlite.prepare('SELECT * FROM movie_provider_awards').get()]).toEqual(before);
  }
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(0);
});
it('an inconclusive first attempt remains eligible and cannot become a negative check',async()=>{
  const {repo,service,local}=fixture();upstream({},42);
  const plan=planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-collections','omdb-awards']);
  for(const batch of plan.batches)expect((await service.execute('populate',batch,at)).results[0].status).toBe('failed');
  expect((await service.status(null)).evidence).toEqual([]);
  expect(operationCoverage((await repo.catalog()).movies[0],'omdb-awards',await service.status(null))).toBe('inconclusive');
  expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-collections','omdb-awards']).units).toHaveLength(2);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(0);
});
it('guards writes against identity races, is idempotent and cascades on deletion',async()=>{
  const {repo,local}=fixture();const c=parseCollection(null,'42',at)!;
  await repo.cacheCollection('film',c);await repo.cacheCollection('film',c);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movie_provider_collections').get()?.n).toBe(1);
  const before=local.sqlite.prepare('SELECT * FROM movie_provider_collections').get();
  local.sqlite.exec("UPDATE movie_external_ids SET external_id='43' WHERE provider='tmdb'");
  await expect(repo.cacheCollection('film',c)).rejects.toThrow();expect(local.sqlite.prepare('SELECT * FROM movie_provider_collections').get()).toEqual(before);
  await expect(repo.cacheAwards('film',{...parseAwards('2 wins','tt0000042',at)!,wins:100})).rejects.toMatchObject({code:'INVALID_PROVIDER_RESPONSE'});
  await repo.cacheAwards('film',parseAwards('N/A','tt0000042',at));
  local.sqlite.exec("DELETE FROM movies WHERE id='film'");
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movie_provider_collections').get()?.n).toBe(0);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movie_provider_awards').get()?.n).toBe(0);
});
it('captures incidentally through imports, compatibility enrichment, metadata and score fallback',async()=>{
  const {repo,env,local}=fixture();upstream({id:7,name:'Series'},'2 wins & 3 nominations.');
  await new EnrichmentService(repo,env).maintain('tmdb',['film']);
  expect(local.sqlite.prepare('SELECT collection_id FROM movie_provider_collections').get()?.collection_id).toBe(7);
  await new ScoreService(repo,env).maintain('metadata',['film']);
  expect(local.sqlite.prepare('SELECT wins FROM movie_provider_awards').get()?.wins).toBe(2);
  local.sqlite.exec('DELETE FROM movie_provider_collections;DELETE FROM movie_provider_awards');
  await new ScoreService(repo,env).refresh('film');
  expect(local.sqlite.prepare('SELECT collection_id FROM movie_provider_collections').get()?.collection_id).toBe(7);
  expect(local.sqlite.prepare('SELECT wins FROM movie_provider_awards').get()?.wins).toBe(2);
  local.sqlite.exec("DELETE FROM movies WHERE id='film'");
  await repo.importMovie(await new TmdbProvider('fictional').details('42'));
  expect(local.sqlite.prepare('SELECT collection_id FROM movie_provider_collections').get()?.collection_id).toBe(7);
});
it('supports older schemas without incidental failures and copies pre/post migration snapshots',async()=>{
  const old=fixture('0020_maintenance_coverage.sql'),target=disposableD1();fixtures.push(target);
  expect(await old.repo.cacheCollection('film',parseCollection(null,'42',at))).toBe(false);
  const fetch=upstream();
  const units=planMaintenance(await old.repo.catalog(),await old.service.status(null),'refresh',['tmdb-collections']).units;
  await expect(old.service.execute('refresh',units,at)).rejects.toMatchObject({code:'SCHEMA_UPGRADE_REQUIRED'});expect(fetch).not.toHaveBeenCalled();
  await old.service.execute('refresh',[{...units[0],operations:['tmdb-metadata']}],at);expect(fetch).toHaveBeenCalledOnce();
  expect(await new MetricsRepository(old.local.db).enrichment()).toEqual({movies:{}});
  copySnapshot(old.local.sqlite,target.sqlite);expect(target.sqlite.prepare('SELECT count(*) AS n FROM movie_provider_collections').get()?.n).toBe(0);
  old.local.sqlite.exec(readFileSync('worker/migrations/0021_collections_awards.sql','utf8'));
  await old.repo.cacheCollection('film',parseCollection(null,'42',at));await old.repo.cacheAwards('film',parseAwards('0 wins & 0 nominations.','tt0000042',at));
  copySnapshot(old.local.sqlite,target.sqlite);expect(target.sqlite.prepare('SELECT wins FROM movie_provider_awards').get()?.wins).toBe(0);
});
it('loads old frozen aggregate checkpoints without adding new operations and reconciles saved new evidence',async()=>{
  const {repo,service}=fixture();const catalog=await repo.catalog(),coverage=await service.status(null);
  const pending=planMaintenance(catalog,coverage,'refresh',['tmdb-metadata','omdb-metadata']).units;
  const saved:UnifiedCheckpoint={version:1,intent:'refresh',operation:'all',startedAt:at,pending,completed:0};
  const storage={getItem:()=>JSON.stringify(saved),removeItem:vi.fn()};
  const loaded=loadUnifiedCheckpoint('old',storage)!;expect(loaded).toEqual(saved);
  expect(reconcileUnifiedCheckpoint(loaded,catalog,coverage).pending.flatMap(u=>u.operations)).toEqual(['tmdb-metadata','omdb-metadata']);
  const evidencePending=planMaintenance(catalog,coverage,'refresh',['tmdb-collections','omdb-awards']).units;
  await repo.cacheCollection('film',parseCollection(null,'42',at));await repo.cacheAwards('film',parseAwards('N/A','tt0000042',at));
  expect(reconcileUnifiedCheckpoint({...saved,pending:evidencePending},catalog,await service.status(null)).pending).toEqual([]);
});
it.each(['collections','awards'] as const)('preserves successful %s evidence after a later database failure',async kind=>{
  const {repo,local}=fixture();
  await repo.cacheCollection('film',parseCollection({id:7,name:'Series'},'42',at));await repo.cacheAwards('film',parseAwards('2 wins & 3 nominations.','tt0000042',at));
  const table=`movie_provider_${kind}`,before=local.sqlite.prepare(`SELECT * FROM ${table}`).get();
  local.sqlite.exec(`CREATE TRIGGER reject_evidence BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'synthetic failure');END`);
  await expect(kind==='collections'?repo.cacheCollection('film',parseCollection(null,'42','2026-02-01T00:00:00Z')):repo.cacheAwards('film',parseAwards('N/A','tt0000042','2026-02-01T00:00:00Z'))).rejects.toThrow();
  expect(local.sqlite.prepare(`SELECT * FROM ${table}`).get()).toEqual(before);
});
it('retains the frozen operation after a partially committed malformed combined response',async()=>{
  const {repo,service}=fixture();upstream({},'N/A');
  const catalog=await repo.catalog(),coverage=await service.status(null);
  const pending=planMaintenance(catalog,coverage,'refresh',['scores','tmdb-enrichment','tmdb-collections']).units.filter(u=>u.provider==='tmdb');
  expect((await service.execute('refresh',pending,at)).results[0].status).toBe('failed');
  const resumed=reconcileUnifiedCheckpoint({version:1,intent:'refresh',operation:'all',startedAt:at,pending,completed:0},await repo.catalog(),await service.status(null));
  expect(resumed.pending).toHaveLength(1);expect(resumed.pending[0].operations).toEqual(['tmdb-collections']);
});
