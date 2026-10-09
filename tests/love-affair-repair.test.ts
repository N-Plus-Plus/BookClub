import {afterEach,beforeEach,expect,it} from 'vitest';
import {disposableD1} from './d1';
import {loveAffairRepairSql,sourceId} from '../scripts/dev/repair-love-affair';
import {Repository} from '../worker/src/repository';
import {parseTmdbEnrichment} from '../worker/src/providers/enrichment';
import {tmdbEnrichmentFixture} from './enrichment-fixtures';
let local:ReturnType<typeof disposableD1>;
beforeEach(()=>{
  local=disposableD1();
  local.sqlite.prepare("INSERT INTO movies(id,title,year,director,runtime,import_source,import_key) VALUES(?,'Love Affair',1974,'Wrong director',64,'legacy-spreadsheet',?)").run(sourceId,sourceId);
  local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb','1037212')").run(sourceId);
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
  local.sqlite.exec("INSERT INTO movies(id,title,year,director,runtime) VALUES('correct','Love Affair',1939,'Leo McCarey',88);INSERT INTO movie_external_ids VALUES('correct','tmdb','43739'),('correct','imdb','tt0031593')");
};
it.each([false,true])('repairs identity and relationships without wrong-provider contamination (merge=%s)',async merge=>{
  if(merge)target();
  await new Repository(local.db).cacheEnrichment(sourceId,parseTmdbEnrichment({...tmdbEnrichmentFixture(1037212),title:'Love Affair'},'2026-10-07T00:00:00Z')!);
  const plan=loveAffairRepairSql(local.sqlite),id=merge?'correct':sourceId;
  expect(local.sqlite.prepare('SELECT title_source FROM movies WHERE id=?').get(sourceId)?.title_source).toBe('tmdb');
  expect(plan.mode).toBe(merge?'merge':'in-place');expect(plan.survivor).toBe(id);
  local.sqlite.exec(plan.sql!);local.sqlite.exec(plan.sql!);
  expect(loveAffairRepairSql(local.sqlite).sql).toBeNull();
  expect(local.sqlite.prepare('SELECT title,year,director,runtime FROM movies WHERE id=?').get(id)).toEqual({title:'Love Affair',year:1939,director:'Leo McCarey',runtime:88});
  expect(local.sqlite.prepare('SELECT provider,external_id FROM movie_external_ids WHERE movie_id=? ORDER BY provider').all(id)).toEqual([{provider:'imdb',external_id:'tt0031593'},{provider:'tmdb',external_id:'43739'}]);
  for(const t of ['session_movies','builder_movies','classics','classics_seed_allocations','seen_states','movie_import_refs','source_scores'])expect(local.sqlite.prepare(`SELECT movie_id FROM ${t}`).all()).toEqual([{movie_id:id}]);
  expect(local.sqlite.prepare('SELECT seen FROM seen_states').get()?.seen).toBe(1);
  expect(local.sqlite.prepare('SELECT id FROM source_scores').all()).toEqual([{id:'legacy'}]);
  for(const t of ['movie_assets','movie_genres','movie_score_checks','movie_provider_metadata','movie_provider_enrichment_state','movie_provider_credits'])expect(local.sqlite.prepare(`SELECT * FROM ${t}`).all()).toEqual([]);
  const receipt=JSON.parse(String(local.sqlite.prepare('SELECT snapshot_json FROM movie_identity_merge_receipts').get()!.snapshot_json));
  expect(receipt.source_scores).toHaveLength(2);expect(receipt.movie_provider_credits).toHaveLength(22);
  expect(local.sqlite.prepare('SELECT title_source FROM movies WHERE id=?').get(id)?.title_source).toBe(merge?'manual':'legacy-spreadsheet');
  expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});
it('preserves a healthy survivor and its cache/scores',async()=>{
  target();const repo=new Repository(local.db);
  await repo.cacheEnrichment('correct',parseTmdbEnrichment({...tmdbEnrichmentFixture(43739),title:'Love Affair'},'2026-10-07T00:00:00Z')!);
  const cache=local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all();
  local.sqlite.exec(loveAffairRepairSql(local.sqlite).sql!);
  expect(local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all()).toEqual(cache);
});
it.each(['wrong-id','wrong-year','ambiguous','wrong-survivor','unknown-reference'])('rejects unsafe preflight %s',kind=>{
  if(kind==='wrong-id')local.sqlite.exec("UPDATE movie_external_ids SET external_id='42'");
  if(kind==='wrong-year')local.sqlite.exec('UPDATE movies SET year=2021');
  if(kind==='ambiguous'){target();local.sqlite.exec("INSERT INTO movies(id,title) VALUES('other','Other');UPDATE movie_external_ids SET movie_id='other' WHERE provider='imdb'");}
  if(kind==='wrong-survivor'){target();local.sqlite.exec("UPDATE movies SET director='Other' WHERE id='correct'");}
  if(kind==='unknown-reference')local.sqlite.exec('CREATE TABLE unexpected(movie_id TEXT REFERENCES movies(id))');
  expect(()=>loveAffairRepairSql(local.sqlite)).toThrow('preflight conflict');
});
it.each(['score','identity-owner','history','member'])('snapshot race aborts atomically (%s)',kind=>{
  const sql=loveAffairRepairSql(local.sqlite).sql!;
  if(kind==='score')local.sqlite.exec('UPDATE source_scores SET raw_value=7');
  if(kind==='identity-owner')target();
  if(kind==='history')local.sqlite.exec('UPDATE session_movies SET position=2');
  if(kind==='member')local.sqlite.exec('UPDATE members SET active=0');
  expect(()=>local.sqlite.exec(sql)).toThrow('raced');
  expect(local.sqlite.prepare('SELECT year FROM movies WHERE id=?').get(sourceId)?.year).toBe(1974);
  expect(local.sqlite.prepare('SELECT * FROM movie_identity_operations').all()).toEqual([]);
});
it('preserves candidate Seen answers and does not fabricate History',()=>{
  local.sqlite.exec('DELETE FROM session_movies;DELETE FROM sessions');
  const seen=local.sqlite.prepare('SELECT * FROM seen_states').all();
  local.sqlite.exec(loveAffairRepairSql(local.sqlite).sql!);
  expect(local.sqlite.prepare('SELECT * FROM seen_states').all()).toEqual(seen);
  expect(local.sqlite.prepare('SELECT * FROM sessions').all()).toEqual([]);
  expect(local.sqlite.prepare('SELECT * FROM session_movies').all()).toEqual([]);
  expect(local.sqlite.prepare('SELECT rank_seed FROM classics').get()?.rank_seed).toBe(12);
  expect(local.sqlite.prepare('SELECT rank_seed FROM classics_seed_allocations').get()?.rank_seed).toBe(12);
});
it('rejects a different source canonical ID even with the expected presentation and wrong provider ID',()=>{
  local.sqlite.exec('PRAGMA foreign_keys=OFF');
  local.sqlite.prepare('UPDATE movies SET id=?,import_key=? WHERE id=?').run('other','other',sourceId);
  local.sqlite.prepare('UPDATE movie_external_ids SET movie_id=? WHERE movie_id=?').run('other',sourceId);
  expect(()=>loveAffairRepairSql(local.sqlite)).toThrow('preflight conflict');
});
it('a verified existing survivor may own just one correct ID; both are unique after merge',()=>{
  target();local.sqlite.exec("DELETE FROM movie_external_ids WHERE provider='imdb'");
  local.sqlite.exec(loveAffairRepairSql(local.sqlite).sql!);
  expect(local.sqlite.prepare('SELECT movie_id,provider,external_id FROM movie_external_ids ORDER BY provider').all()).toEqual([{movie_id:'correct',provider:'imdb',external_id:'tt0031593'},{movie_id:'correct',provider:'tmdb',external_id:'43739'}]);
  expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});
