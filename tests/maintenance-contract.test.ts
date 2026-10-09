import { afterEach,describe,expect,it,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { maintenanceContract,collectedDescription,collectedFieldStates,maintainedScoreKeys,scoreProviderKeys,type FieldCheck } from '../shared/maintenance-contract';
import { planMaintenance,operationCoverage,maintenanceOperations,operationCounts,type MaintenanceCoverage,type MaintenanceOperation } from '../shared/maintenance-plan';
import { requiredScores } from '../shared/ranking';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { FieldCoverageRepository } from '../worker/src/field-coverage-repository';
import { UnifiedMaintenanceService } from '../worker/src/unified-maintenance';
import { UnifiedMaintenance } from '../frontend/UnifiedMaintenance';
import { CollectionRosterMaintenance } from '../frontend/CollectionRosterMaintenance';
import { loadUnifiedCheckpoint,reconcileUnifiedCheckpoint } from '../frontend/unified-maintenance';
import { tmdbEnrichmentFixture,mdbEnrichmentFixture } from './enrichment-fixtures';
import { mdbCheckedKeys } from '../worker/src/providers/mdblist';
import { OmdbProvider } from '../worker/src/providers/omdb';
import { TmdbProvider } from '../worker/src/providers/tmdb';
import type { Env } from '../worker/src/http';
const at='2026-01-01T00:00:00.000Z';
const locals:ReturnType<typeof disposableD1>[]=[];
function fixture(last?:string){
 const local=disposableD1(last);locals.push(local);
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('film','Canonical title');INSERT INTO movie_external_ids VALUES('film','tmdb','42'),('film','imdb','tt0000042');INSERT INTO classics(movie_id,source) VALUES('film','member-added')");
 const repo=new Repository(local.db),env:Env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'false',ALLOWED_ORIGINS:'http://localhost:4173',TMDB_READ_TOKEN:'fictional',MDBLIST_API_KEY:'fictional',OMDB_API_KEY:'fictional'};
 return {...local,repo,service:new UnifiedMaintenanceService(repo,env)};
}
afterEach(()=>{locals.splice(0).forEach(l=>l.sqlite.close());vi.unstubAllGlobals();vi.restoreAllMocks();});
const empty=():MaintenanceCoverage=>({fields:[],fieldsSupported:true,checks:[],enrichment:[],negativeScores:[],failures:[],unavailable:{mdblist:null,omdb:null,tmdb:null}});
const filmOperations=maintenanceOperations.filter(o=>o!=='scores');
const matrix=filmOperations.flatMap(operation=>maintenanceContract[operation].fields.map(field=>({operation,field})));
describe('every declared film-operation field',()=>{
 it.each(matrix)('$operation / $field.id: unchecked, present, unavailable, inconclusive, identity and Refresh',async({operation,field})=>{
  const {repo}=fixture(),catalog=await repo.catalog(),coverage=empty(),movie=catalog.movies[0];
  const provider=maintenanceContract[operation].providers[0];
  const identity=provider==='tmdb'?{provider:'tmdb',external_id:'42'}:{provider:'imdb',external_id:'tt0000042'};
  const fields:Record<string,FieldCheck>=Object.fromEntries(maintenanceContract[operation].fields.map(f=>[f.id,{state:'present',checked_at:at}]));
  coverage.fields!.push({movie_id:'film',provider,operation,...{identity_provider:identity.provider,external_id:identity.external_id},fields});
  expect(planMaintenance(catalog,coverage,'populate',[operation]).units).toHaveLength(0);
  expect(planMaintenance(catalog,coverage,'refresh',[operation]).units).toHaveLength(1);
  fields[field.id]={state:'checked_unavailable',checked_at:at};
  expect(operationCoverage(movie,operation,coverage)).toBe(field.optional?'checked_unavailable':'unchecked');
  expect(planMaintenance(catalog,coverage,'populate',[operation]).units).toHaveLength(field.optional?0:1);
  delete fields[field.id];
  expect(planMaintenance(catalog,coverage,'populate',[operation]).units).toHaveLength(1);
  coverage.failures!.push({movie_id:'film',provider,operation,attempted_at:at});
  expect(operationCoverage(movie,operation,coverage)).toBe('inconclusive');
  fields[field.id]={state:'present',checked_at:at};coverage.fields![0].external_id='changed';
  expect(planMaintenance(catalog,coverage,'populate',[operation]).units).toHaveLength(1);
  coverage.unavailable[provider]='Cooling down';
  expect(planMaintenance(catalog,coverage,'populate',[operation]).units).toHaveLength(0);
  movie.external_ids=[];expect(operationCoverage(movie,operation,coverage)).toBe('unidentifiable');
 });
 it.each(matrix)('$operation / $field.id: validated state and persistence share the failed transaction',async({operation,field})=>{
  const {db,sqlite}=fixture(),provider=maintenanceContract[operation].providers[0],identity=provider==='tmdb'?{provider:'tmdb',external_id:'42'}:{provider:'imdb',external_id:'tt0000042'};
  const value=field.kind==='number'?5:field.kind==='family'?[{id:1}]:'usable';
  const fields=new FieldCoverageRepository(db);
  for(const [input,state] of (field.optional?[[value,'present'],[null,'checked_unavailable']]:[[value,'present']]) as [unknown,string][]){
   const statements=await fields.statements('film',provider,operation,identity,{[field.id]:input},at);
   await expect(db.batch([...statements,db.prepare("INSERT INTO movies(id,title) VALUES('film','duplicate')")])).rejects.toThrow();
   expect(sqlite.prepare('SELECT * FROM movie_maintenance_fields').all()).toEqual([]);
   await db.batch(statements);
   expect(JSON.parse(String(sqlite.prepare('SELECT checks_json FROM movie_maintenance_fields').get()?.checks_json))[field.id]).toEqual({state,checked_at:at});
   sqlite.exec('DELETE FROM movie_maintenance_fields');
  }
  expect(collectedFieldStates(operation,{[field.id]:{malformed:true}})).toEqual({});
  const wrong=await fields.statements('film',provider,operation,{...identity,external_id:'wrong'},{[field.id]:value},at);
  await expect(db.batch(wrong)).rejects.toThrow();expect(sqlite.prepare('SELECT * FROM movie_maintenance_fields').all()).toEqual([]);
 });
});
it('declares nine maintained ratings while preserving the six Watch Order dimensions',()=>{
 expect(maintainedScoreKeys).toHaveLength(9);expect(requiredScores).toHaveLength(6);
 expect(maintainedScoreKeys.filter(k=>!requiredScores.includes(k as typeof requiredScores[number]))).toEqual(['metacritic:user','trakt:rating','rogerebert:rating']);
 expect(scoreProviderKeys.omdb).toHaveLength(3);expect(scoreProviderKeys.tmdb).toEqual(['tmdb:rating']);
});
it.each(maintainedScoreKeys)('%s only activates capable providers and conclusively absent ratings stay skipped',async key=>{
 const {repo}=fixture(),catalog=await repo.catalog(),coverage=empty(),movie=catalog.movies[0];
 movie.scores=maintainedScoreKeys.filter(k=>k!==key).map(k=>({provider:k.split(':')[0],metric:k.split(':')[1],raw_value:80,raw_scale:100,normalized_value:80,vote_count:null,fetched_at:at,retrieved_via:'mdblist'}));
 const plan=planMaintenance(catalog,coverage,'populate',['scores']);
 expect(plan.units.map(u=>u.provider)).toEqual((['mdblist','omdb','tmdb'] as const).filter(p=>(scoreProviderKeys[p] as readonly string[]).includes(key)));
 for(const unit of plan.units)coverage.fields!.push({movie_id:'film',provider:unit.provider,operation:'scores',identity_provider:unit.identity.provider,external_id:unit.identity.external_id,fields:{[key]:{state:'checked_unavailable',checked_at:at}}});
 expect(planMaintenance(catalog,coverage,'populate',['scores']).units).toEqual([]);
 expect(planMaintenance(catalog,coverage,'refresh',['scores']).units).toHaveLength(3);
 coverage.fields!.forEach(f=>f.external_id='changed');expect(planMaintenance(catalog,coverage,'populate',['scores']).units.length).toBeGreaterThan(0);
});
it('one valid TMDB response captures every declared family incidentally, including checked-empty artwork and optional zero scalars',async()=>{
 const {repo,service}=fixture();
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),belongs_to_collection:null,budget:0,revenue:0,tagline:null})));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-metadata']).units[0];
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('updated');
 const coverage=await service.status(null);
 expect(planMaintenance(await repo.catalog(),coverage,'populate',['tmdb-metadata','tmdb-enrichment','tmdb-collections']).units).toEqual([]);
 expect(coverage.fields?.find(f=>f.operation==='tmdb-metadata')?.fields.poster.state).toBe('checked_unavailable');
 expect(coverage.fields?.find(f=>f.operation==='tmdb-enrichment')?.fields.budget.state).toBe('checked_unavailable');
});
it('successful coalesced scores survive malformed enrichment without falsely completing it',async()=>{
 const {repo,service,sqlite}=fixture();
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{...mdbEnrichmentFixture(),keywords:{bad:true}}])));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['scores','mdblist-enrichment']).units.find(u=>u.provider==='mdblist')!;
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('failed');
 expect(sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(6);
 const coverage=await service.status(null);expect(coverage.fields?.find(f=>f.operation==='scores')?.fields['trakt:rating'].state).toBe('checked_unavailable');
 expect(operationCoverage((await repo.catalog()).movies[0],'mdblist-enrichment',coverage)).toBe('inconclusive');
});
it('missing provider title cannot be hidden by a canonical title; conclusive N/A does complete OMDb metadata',async()=>{
 const {repo,service}=fixture();
 const raw={Response:'True',imdbID:'tt0000042',Year:'N/A',Runtime:'N/A',Director:'N/A',Genre:'N/A'};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(raw)));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['omdb-metadata']).units[0];
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('failed');
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['omdb-metadata']).units).toHaveLength(1);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...raw,Title:'N/A'})));
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('no_change');
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['omdb-metadata']).units).toEqual([]);
 expect((await repo.catalog()).movies[0].title).toBe('Canonical title');
});
it('MDBList empty keywords, absent title/runtime and no new identity claims are conclusive',async()=>{
 const {repo,service}=fixture();
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{...mdbEnrichmentFixture(),title:null,runtime:null,keywords:[],ids:{imdb:'tt0000042'}}])));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['mdblist-enrichment']).units[0];
 expect((await service.execute('populate',[unit],at)).results[0].status).not.toBe('failed');
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['mdblist-enrichment']).units).toEqual([]);
});
it('malformed known score values never manufacture a successful negative check',async()=>{
 expect(mdbCheckedKeys({ratings:[{source:'trakt',value:'bad'}]})).not.toContain('trakt:rating');
 expect(mdbCheckedKeys({ratings:[]})).toEqual(maintainedScoreKeys);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'True',imdbID:'tt0000042',imdbRating:'bad',Metascore:'N/A',Ratings:[{Source:'Rotten Tomatoes',Value:'broken'}]})));
 expect((await new OmdbProvider('fictional').details('tt0000042')).scoreCheckedKeys).toEqual(['metacritic:critic']);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),vote_average:'broken'})));
 expect((await new TmdbProvider('fictional').details('42')).scoreCheckedKeys).toEqual([]);
});
it('legacy snapshots preserve conclusive relationships and positive scalars, while uncertain absent scalars stay eligible',async()=>{
 const {repo,service,sqlite}=fixture('0022_collection_rosters.sql');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),belongs_to_collection:null})));
 await repo.enrichMetadata('film','42',await new TmdbProvider('fictional').details('42'));
 sqlite.exec(readFileSync('worker/migrations/0023_maintenance_fields.sql','utf8'));
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-enrichment']).units).toEqual([]);
 sqlite.exec('UPDATE movie_provider_metadata SET budget=NULL WHERE provider=\'tmdb\'');
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-enrichment']).units).toHaveLength(1);
 sqlite.exec(readFileSync('worker/migrations/0023_maintenance_fields.sql','utf8'));
 expect(sqlite.prepare('SELECT count(*) AS n FROM movie_maintenance_fields').get()?.n).toBe(0);
});
it('a changed TMDB identity invalidates success rather than rebuilding it from old canonical timestamps',async()=>{
 const {repo,service,sqlite}=fixture();vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),belongs_to_collection:null})));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-metadata']).units[0];await service.execute('populate',[unit],at);
 sqlite.exec("UPDATE movie_external_ids SET external_id='99' WHERE provider='tmdb'");
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-metadata']).units).toHaveLength(1);
});
it('old frozen checkpoints retain six-score scope and new checkpoints retain only their planned dimensions',async()=>{
 const {repo}=fixture(),catalog=await repo.catalog(),coverage=empty();
 const old={version:1,intent:'refresh',operation:'scores',startedAt:at,completed:0,pending:[{movieId:'film',provider:'mdblist',identity:{provider:'imdb',external_id:'tt0000042'},operations:['scores']}]};
 const load=(value:unknown)=>loadUnifiedCheckpoint('fixture',{getItem:()=>JSON.stringify(value),removeItem:()=>{}});
 const saved=load(old)!;expect(saved.pending[0].scoreKeys).toEqual(requiredScores);
 expect(new Set(reconcileUnifiedCheckpoint(saved,catalog,coverage).pending[0].scoreKeys)).toEqual(new Set(requiredScores));
 const newPlan=planMaintenance(catalog,coverage,'refresh',['scores']);
 expect(load({...old,pending:[newPlan.units[0]]})?.pending[0].scoreKeys).toEqual(maintainedScoreKeys);
 expect(load({...old,pending:[{...newPlan.units[0],provider:'omdb',scoreKeys:['trakt:rating']}] })).toBeNull();
});
it('the Admin inventories and disclosure scopes are generated by the coverage declaration',async()=>{
 const {repo}=fixture(),catalog=await repo.catalog();
 const html=renderToStaticMarkup(createElement(UnifiedMaintenance,{catalog,writesEnabled:true,onUpdated:async()=>{}}));
 for(const operation of maintenanceOperations)expect(html).toContain(collectedDescription(operation).replaceAll('&','&amp;'));
 expect(html).toContain('all seven film-level operations');expect(html).toContain('Nine maintained ratings');
 const roster=renderToStaticMarkup(createElement(CollectionRosterMaintenance,{writesEnabled:true}));
 expect(roster).toContain(collectedDescription('collection-rosters'));expect(roster).toContain('after their seven film operations');
 expect(Object.keys(maintenanceContract)).toHaveLength(8);
 expect(maintenanceContract['collection-rosters'].fields).toHaveLength(8);
 expect(planMaintenance(catalog,empty(),'refresh').units.every(u=>u.operations.every(o=>o!=='collection-rosters' as MaintenanceOperation))).toBe(true);
});

it.each(maintainedScoreKeys)('%s: append-only observation and absence coverage fail atomically on identity movement',async key=>{
 const {repo,sqlite}=fixture(),identity={provider:'imdb',external_id:'tt0000042'};
 const score={provider:key.split(':')[0],metric:key.split(':')[1],raw_value:80,raw_scale:100,normalized_value:80,vote_count:null,fetched_at:at,retrieved_via:'mdblist'};
 sqlite.exec("CREATE TRIGGER reject_field BEFORE INSERT ON movie_maintenance_fields BEGIN SELECT RAISE(ABORT,'synthetic persistence failure'); END");
 await expect(repo.appendScores('film',[score],identity,'mdblist',[key])).rejects.toThrow();
 expect(sqlite.prepare('SELECT * FROM source_scores').all()).toEqual([]);expect(sqlite.prepare('SELECT * FROM movie_maintenance_fields').all()).toEqual([]);
 sqlite.exec('DROP TRIGGER reject_field');await repo.appendScores('film',[score],identity,'mdblist',[key]);
 expect(JSON.parse(String(sqlite.prepare('SELECT checks_json FROM movie_maintenance_fields').get()?.checks_json))[key].state).toBe('present');
 await repo.appendScores('film',[],identity,'mdblist',[key]);expect(sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(1);
 expect(JSON.parse(String(sqlite.prepare('SELECT checks_json FROM movie_maintenance_fields').get()?.checks_json))[key].state).toBe('checked_unavailable');
 sqlite.exec("UPDATE movie_external_ids SET external_id='tt0000099' WHERE provider='imdb'");
 await expect(repo.appendScores('film',[],identity,'mdblist',[key])).rejects.toThrow();
});
it('persists all nine actual MDBList observations through the unified API without unsupported fallbacks',async()=>{
 const {repo,service}=fixture(),fetch=vi.fn(async()=>Response.json([{...mdbEnrichmentFixture(),ratings:[...mdbEnrichmentFixture().ratings,{source:'metacriticuser',value:8},{source:'trakt',value:85},{source:'rogerebert',value:4}]}]));vi.stubGlobal('fetch',fetch);
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['scores']).units[0];
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('updated');
 expect((await repo.catalog()).movies[0].scores).toHaveLength(9);
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['scores']).units).toEqual([]);expect(fetch).toHaveBeenCalledOnce();
});
it('completed provider coverage skips Populate during cooldown but Refresh is temporarily blocked',async()=>{
 const {repo}=fixture(),catalog=await repo.catalog(),coverage=empty();
 coverage.fields!.push({movie_id:'film',provider:'tmdb',operation:'tmdb-metadata',identity_provider:'tmdb',external_id:'42',fields:Object.fromEntries(maintenanceContract['tmdb-metadata'].fields.map(f=>[f.id,{state:'present',checked_at:at}]))});
 coverage.unavailable.tmdb='Cooling down';
 expect(planMaintenance(catalog,coverage,'populate',['tmdb-metadata']).units).toEqual([]);
 expect(planMaintenance(catalog,coverage,'refresh',['tmdb-metadata'])).toMatchObject({units:[],blocked:1});
});
it('a legacy financial zero is conclusive, while a legacy null remains ambiguous',async()=>{
 const {repo,service,sqlite}=fixture('0022_collection_rosters.sql');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),budget:0,revenue:0,belongs_to_collection:null})));
 await repo.enrichMetadata('film','42',await new TmdbProvider('fictional').details('42'));
 sqlite.exec(readFileSync('worker/migrations/0023_maintenance_fields.sql','utf8'));
 const coverage=await service.status(null);expect(coverage.fields?.find(f=>f.operation==='tmdb-enrichment')?.fields.budget.state).toBe('checked_unavailable');
 expect(planMaintenance(await repo.catalog(),coverage,'populate',['tmdb-enrichment']).units).toEqual([]);
});
it('partial metadata cannot turn protected canonical values into fresh provider coverage',async()=>{
 const {repo,service,sqlite}=fixture();sqlite.exec("UPDATE movies SET overview='Protected overview'");
 const raw=tmdbEnrichmentFixture();const {overview,...partial}=raw;expect(overview).toBeNull();
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...partial,belongs_to_collection:null})));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-metadata']).units[0];
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('failed');
 expect((await service.status(null)).fields?.find(f=>f.operation==='tmdb-metadata')?.fields.overview).toBeUndefined();
 expect(planMaintenance(await repo.catalog(),await service.status(null),'populate',['tmdb-metadata']).units).toHaveLength(1);
});
it('malformed TMDB enrichment scalars preserve other validated evidence and remain actionable',async()=>{
 const {repo,service}=fixture();vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),budget:'bad',belongs_to_collection:null})));
 const unit=planMaintenance(await repo.catalog(),await service.status(null),'populate',['scores','tmdb-enrichment']).units.find(u=>u.provider==='tmdb')!;
 expect((await service.execute('populate',[unit],at)).results[0].status).toBe('failed');
 const coverage=await service.status(null),fields=coverage.fields?.find(f=>f.operation==='tmdb-enrichment')?.fields;
 expect(fields?.budget).toBeUndefined();expect(fields?.countries.state).toBe('present');expect(fields?.watch_offers.state).toBe('checked_unavailable');
 expect((await repo.catalog()).movies[0].scores).toHaveLength(1);expect(planMaintenance(await repo.catalog(),coverage,'populate',['tmdb-enrichment']).units).toHaveLength(1);
});

it('score operation counts agree with zero actionable work when only the unchecked provider is cooling down',async()=>{
 const {repo}=fixture(),catalog=await repo.catalog(),coverage=empty();
 catalog.movies[0].scores=maintainedScoreKeys.filter(key=>key!=='imdb:rating').map(key=>({provider:key.split(':')[0],metric:key.split(':')[1],raw_value:80,raw_scale:100,normalized_value:80,vote_count:null,fetched_at:at,retrieved_via:'mdblist'}));
 coverage.checks.push({movie_id:'film',provider:'omdb',domain:'scores',identity_provider:'imdb',external_id:'tt0000042',checked_at:at,absent:['imdb:rating']});coverage.unavailable.mdblist='Cooling down';
 expect(operationCounts(catalog,'scores',coverage)).toEqual({actionable:0,present:0,unavailable:0,blocked:1});
 expect(planMaintenance(catalog,coverage,'populate',['scores'])).toMatchObject({units:[],blocked:1});
});
