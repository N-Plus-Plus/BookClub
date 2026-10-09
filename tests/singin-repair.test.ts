import { afterEach, beforeEach, expect, it } from 'vitest';
import { disposableD1 } from './d1';
import { repairSql, survivor, duplicate } from '../scripts/dev/repair-singin';
import { Repository } from '../worker/src/repository';
import { parseTmdbEnrichment } from '../worker/src/providers/enrichment';
import { tmdbEnrichmentFixture } from './enrichment-fixtures';
let local:ReturnType<typeof disposableD1>;
beforeEach(()=>{
  local=disposableD1();
  local.sqlite.prepare('INSERT INTO movies(id,title,year) VALUES(?,?,1952)').run(survivor,"Singin' in the Rain");
  local.sqlite.prepare("INSERT INTO movies(id,title,year,import_source,import_key) VALUES(?,'Singing in the rain',2025,'legacy-spreadsheet',?)").run(duplicate,duplicate);
  local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb','872'),(?,'imdb','tt0045152'),(?,'tmdb','1438810')").run(survivor,survivor,duplicate);
  local.sqlite.prepare("INSERT INTO classics(movie_id,source,rank_seed) VALUES(?,'legacy-spreadsheet',95)").run(duplicate);
  local.sqlite.exec("INSERT INTO members(id,display_name,sort_order) VALUES('m','Fictional',1)");
  local.sqlite.exec("INSERT INTO cycles(id,ordinal,rough_date) VALUES('cycle',34,'2023-07-01'); INSERT INTO sessions(id,event_date,cycle_id,kind,date_precision,cycle_slot) VALUES('history','2023-07-23','cycle','classics','cycle_rough',5)");
  local.sqlite.prepare("INSERT INTO session_movies VALUES('history',?,2)").run(survivor);
  local.sqlite.prepare("INSERT INTO seen_states(movie_id,member_id,seen) VALUES(?,'m',0)").run(duplicate);
  local.sqlite.prepare("INSERT INTO movie_import_refs(movie_id,import_source,source_ref) VALUES(?,'legacy-spreadsheet','fictional')").run(duplicate);
  local.sqlite.prepare("INSERT INTO seen_import_observations VALUES(?,'legacy-spreadsheet','fictional','m',0,'2026-01-01')").run(duplicate);
  local.sqlite.prepare("INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,fetched_at,retrieved_via,import_source) VALUES('legacy',?,'imdb','rating',83,'2026-01-01','legacy-spreadsheet','legacy-spreadsheet'),('wrong',?,'tmdb','rating',9,'2026-01-01','tmdb',NULL)").run(duplicate,duplicate);
  local.sqlite.prepare("INSERT INTO movie_score_checks VALUES(?,'tmdb:rating',1,'2026-01-01')").run(duplicate);
  local.sqlite.prepare("INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,fetched_at) VALUES('wrong',?,'tmdb','poster','wrong','2026-01-01')").run(duplicate);
  local.sqlite.prepare("INSERT INTO movie_genres VALUES(?,'Music')").run(duplicate);
});
afterEach(()=>local.sqlite.close());
it('preserves user/import/seed observations and canonical metadata while discarding wrong-identity state, with repeat safety',()=>{
  const target=local.sqlite.prepare('SELECT * FROM movies WHERE id=?').get(survivor);
  const sql=repairSql(local.sqlite)!;local.sqlite.exec(sql);local.sqlite.exec(sql);
  expect(repairSql(local.sqlite)).toBeNull();
  expect(local.sqlite.prepare('SELECT * FROM movies WHERE id=?').get(survivor)).toEqual(target);
  expect(local.sqlite.prepare('SELECT * FROM movies WHERE id=?').get(duplicate)).toBeUndefined();
  for(const table of ['classics','classics_seed_allocations','seen_states','movie_import_refs','seen_import_observations','source_scores'])expect(local.sqlite.prepare(`SELECT movie_id FROM ${table}`).all()).toEqual([{movie_id:survivor}]);
  expect(local.sqlite.prepare('SELECT rank_seed FROM classics').get()).toEqual({rank_seed:95});
  expect(local.sqlite.prepare('SELECT * FROM session_movies').all()).toEqual([{session_id:'history',movie_id:survivor,position:2}]);
  for(const table of ['movie_score_checks','movie_assets','movie_genres'])expect(local.sqlite.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
  const receipt=local.sqlite.prepare('SELECT snapshot_json FROM movie_identity_merge_receipts').get()!;
  expect(JSON.parse(String(receipt.snapshot_json)).source_scores).toHaveLength(2);
  expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
});
it('atomically rejects raced Seen evidence without changing either movie',()=>{
  const sql=repairSql(local.sqlite)!;
  local.sqlite.exec('UPDATE seen_states SET seen=1');
  expect(()=>local.sqlite.exec(sql)).toThrow('raced');
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movies').get()?.n).toBe(2);
  expect(local.sqlite.prepare('SELECT * FROM movie_identity_operations').all()).toEqual([]);
});
it('archives and discards wrong-identity cache while preserving the survivor cache',async()=>{
  const repo=new Repository(local.db);
  await repo.cacheEnrichment(duplicate,parseTmdbEnrichment({...tmdbEnrichmentFixture(1438810),title:'Singing in the rain'},'2026-10-07T00:00:00Z')!);
  await repo.cacheEnrichment(survivor,parseTmdbEnrichment({...tmdbEnrichmentFixture(872),title:"Singin' in the Rain"},'2026-10-06T00:00:00Z')!);
  const cache=local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state WHERE movie_id=?').all(survivor);
  local.sqlite.exec(repairSql(local.sqlite)!);
  expect(local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all()).toEqual(cache);
  expect(local.sqlite.prepare('SELECT * FROM movie_provider_credits').all()).toHaveLength(22);
  const receipt=JSON.parse(String(local.sqlite.prepare('SELECT snapshot_json FROM movie_identity_merge_receipts').get()!.snapshot_json));expect(receipt.movie_provider_credits).toHaveLength(22);
});
it('fails closed for unfamiliar movie dependencies',()=>{
  local.sqlite.exec('CREATE TABLE unexpected(movie_id TEXT REFERENCES movies(id))');
  expect(()=>repairSql(local.sqlite)).toThrow('preflight conflict');
});
it('rejects conflicting survivor Seen and identities',()=>{
  local.sqlite.prepare("INSERT INTO seen_states(movie_id,member_id,seen) VALUES(?,'m',1)").run(survivor);
  expect(()=>repairSql(local.sqlite)).toThrow('preflight conflict');
});
it('optionally re-establishes History Seen while archiving the original candidate answers',()=>{
  local.sqlite.exec(repairSql(local.sqlite,true)!);
  expect(local.sqlite.prepare('SELECT seen FROM seen_states').all()).toEqual([{seen:1}]);
  const receipt=JSON.parse(String(local.sqlite.prepare('SELECT snapshot_json FROM movie_identity_merge_receipts').get()!.snapshot_json));
  expect(receipt.seen_states[0].seen).toBe(0);
  expect(repairSql(local.sqlite,true)).toBeNull();
});
