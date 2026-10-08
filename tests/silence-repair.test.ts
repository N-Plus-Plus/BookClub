import {afterEach,beforeEach,expect,it} from 'vitest';
import {disposableD1} from './d1';
import {silenceRepairSql,sourceId} from '../scripts/dev/repair-silence';
import {Repository} from '../worker/src/repository';
import {parseTmdbEnrichment} from '../worker/src/providers/enrichment';
import {tmdbEnrichmentFixture} from './enrichment-fixtures';
import {parseCollection,parseAwards} from '../shared/provider-evidence';
let local:ReturnType<typeof disposableD1>;
beforeEach(()=>{
  local=disposableD1();
  local.sqlite.prepare("INSERT INTO movies(id,title,year,director,runtime,import_source,import_key) VALUES(?,'Silence of the Lambs',2022,'Wrong director',64,'legacy-spreadsheet',?)").run(sourceId,sourceId);
  local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb','1064810')").run(sourceId);
  local.sqlite.exec("INSERT INTO members(id,display_name) VALUES('m','Member');INSERT INTO sessions(id,event_date) VALUES('history','2000-01-01');INSERT INTO builder_sets(id,owner_member_id) VALUES('draft','m')");
  local.sqlite.prepare("INSERT INTO session_movies VALUES('history',?,1); ").run(sourceId);
  local.sqlite.prepare("INSERT INTO builder_movies VALUES('draft',?,1)").run(sourceId);
  local.sqlite.prepare("INSERT INTO classics(movie_id,rank_seed,source) VALUES(?,12,'legacy-spreadsheet')").run(sourceId);
  local.sqlite.prepare("INSERT INTO seen_states(movie_id,member_id,seen) VALUES(?,'m',0)").run(sourceId);
  local.sqlite.prepare("INSERT INTO movie_import_refs(movie_id,import_source,source_ref) VALUES(?,'legacy-spreadsheet','Tracker:1')").run(sourceId);
  local.sqlite.prepare("INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,fetched_at,retrieved_via,import_source) VALUES('legacy',?,'imdb','rating',8,10,'2000','legacy-spreadsheet','legacy-spreadsheet'),('wrong',?,'tmdb','rating',9,10,'2026','tmdb',NULL)").run(sourceId,sourceId);
  local.sqlite.prepare("INSERT INTO movie_score_checks VALUES(?,'imdb:rating',0,'2026')").run(sourceId);
  local.sqlite.prepare("INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,fetched_at) VALUES('wrong',?,'tmdb','poster','wrong','2026')").run(sourceId);
  local.sqlite.prepare("INSERT INTO movie_genres VALUES(?,'Wrong genre')").run(sourceId);
});
afterEach(()=>local.sqlite.close());
const target=()=>{
  local.sqlite.exec("INSERT INTO movies(id,title,year,director,runtime) VALUES('correct','The Silence of the Lambs',1991,'Jonathan Demme',118);INSERT INTO movie_external_ids VALUES('correct','tmdb','274'),('correct','imdb','tt0102926')");
};
it.each([false,true])('repairs identity and relationships without wrong-provider contamination (merge=%s)',async merge=>{
  if(merge)target();
  const repo=new Repository(local.db);
  await repo.cacheCollection(sourceId,parseCollection({id:7,name:'Wrong series'},'1064810','2026-01-01T00:00:00Z'));
  if(merge) {await repo.cacheCollection('correct',parseCollection(null,'274','2026-01-02T00:00:00Z'));await repo.cacheAwards('correct',parseAwards('N/A','tt0102926','2026-01-02T00:00:00Z'));}
  await new Repository(local.db).cacheEnrichment(sourceId,parseTmdbEnrichment({...tmdbEnrichmentFixture(1064810),title:'Silence of the Lambs'},'2026-10-07T00:00:00Z')!);
  const plan=silenceRepairSql(local.sqlite),id=merge?'correct':sourceId;
  expect(local.sqlite.prepare('SELECT title_source FROM movies WHERE id=?').get(sourceId)?.title_source).toBe('tmdb');
  expect(plan.mode).toBe(merge?'merge':'in-place');expect(plan.survivor).toBe(id);
  local.sqlite.exec(plan.sql!);local.sqlite.exec(plan.sql!);
  expect(silenceRepairSql(local.sqlite).sql).toBeNull();
  expect(local.sqlite.prepare('SELECT title,year,director,runtime FROM movies WHERE id=?').get(id)).toEqual({title:'The Silence of the Lambs',year:1991,director:'Jonathan Demme',runtime:118});
  expect(local.sqlite.prepare('SELECT provider,external_id FROM movie_external_ids WHERE movie_id=? ORDER BY provider').all(id)).toEqual([{provider:'imdb',external_id:'tt0102926'},{provider:'tmdb',external_id:'274'}]);
  for(const t of ['session_movies','builder_movies','classics','classics_seed_allocations','seen_states','movie_import_refs','source_scores'])expect(local.sqlite.prepare(`SELECT movie_id FROM ${t}`).all()).toEqual([{movie_id:id}]);
  expect(local.sqlite.prepare('SELECT seen FROM seen_states').get()?.seen).toBe(1);
  expect(local.sqlite.prepare('SELECT id FROM source_scores').all()).toEqual([{id:'legacy'}]);
  for(const t of ['movie_assets','movie_genres','movie_score_checks','movie_provider_metadata','movie_provider_enrichment_state','movie_provider_credits'])expect(local.sqlite.prepare(`SELECT * FROM ${t}`).all()).toEqual([]);
  const receipt=JSON.parse(String(local.sqlite.prepare('SELECT snapshot_json FROM movie_identity_merge_receipts').get()!.snapshot_json));
  expect(receipt.source_scores).toHaveLength(2);expect(receipt.movie_provider_credits).toHaveLength(21);
  expect(receipt.movie_provider_collections).toHaveLength(merge?2:1);
  expect(local.sqlite.prepare('SELECT collection_id FROM movie_provider_collections').all()).toEqual(merge?[{collection_id:null}]:[]);
  expect(local.sqlite.prepare('SELECT awards_text FROM movie_provider_awards').all()).toEqual(merge?[{awards_text:null}]:[]);
  expect(local.sqlite.prepare('SELECT title_source FROM movies WHERE id=?').get(id)?.title_source).toBe(merge?'manual':'legacy-spreadsheet');
  expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});
it('preserves a healthy survivor and its cache/scores',async()=>{
  target();const repo=new Repository(local.db);
  await repo.cacheEnrichment('correct',parseTmdbEnrichment({...tmdbEnrichmentFixture(274),title:'The Silence of the Lambs'},'2026-10-07T00:00:00Z')!);
  const cache=local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all();
  local.sqlite.exec(silenceRepairSql(local.sqlite).sql!);
  expect(local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all()).toEqual(cache);
});
it.each(['wrong-id','wrong-year','ambiguous','wrong-survivor','unknown-reference'])('rejects unsafe preflight %s',kind=>{
  if(kind==='wrong-id')local.sqlite.exec("UPDATE movie_external_ids SET external_id='42'");
  if(kind==='wrong-year')local.sqlite.exec('UPDATE movies SET year=2021');
  if(kind==='ambiguous'){target();local.sqlite.exec("INSERT INTO movies(id,title) VALUES('other','Other');UPDATE movie_external_ids SET movie_id='other' WHERE provider='imdb'");}
  if(kind==='wrong-survivor'){target();local.sqlite.exec("UPDATE movies SET director='Other' WHERE id='correct'");}
  if(kind==='unknown-reference')local.sqlite.exec('CREATE TABLE unexpected(movie_id TEXT REFERENCES movies(id))');
  expect(()=>silenceRepairSql(local.sqlite)).toThrow('preflight conflict');
});
it.each(['score','identity-owner','history','member'])('snapshot race aborts atomically (%s)',kind=>{
  const sql=silenceRepairSql(local.sqlite).sql!;
  if(kind==='score')local.sqlite.exec('UPDATE source_scores SET raw_value=7');
  if(kind==='identity-owner')target();
  if(kind==='history')local.sqlite.exec('UPDATE session_movies SET position=2');
  if(kind==='member')local.sqlite.exec('UPDATE members SET active=0');
  expect(()=>local.sqlite.exec(sql)).toThrow('raced');
  expect(local.sqlite.prepare('SELECT year FROM movies WHERE id=?').get(sourceId)?.year).toBe(2022);
  expect(local.sqlite.prepare('SELECT * FROM movie_identity_operations').all()).toEqual([]);
});
