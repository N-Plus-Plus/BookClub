import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { disposableD1 } from './d1';
it('migration 0007 leaves existing films unchecked and preserves all prior movie data',()=>{
  const local=disposableD1('0006_history_integrity.sql');try {
    local.sqlite.exec("INSERT INTO movies(id,title,year,import_source,import_key) VALUES('fictional','Fictional archive film',2000,'synthetic','Tracker:2:2')");
    const before=local.sqlite.prepare('SELECT * FROM movies').get();
    local.sqlite.exec(readFileSync('worker/migrations/0007_tmdb_metadata_checked.sql','utf8'));
    expect(local.sqlite.prepare('SELECT * FROM movies').get()).toEqual({...before,tmdb_metadata_checked_at:null});
    expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  }finally{local.sqlite.close();}
});
it('migration 0006 refuses pre-existing duplicate active slots without rewriting History',()=>{
  const local=disposableD1('0005_product_state.sql');try {
    local.sqlite.exec("INSERT INTO members(id,display_name,sort_order) VALUES('m','Fictional',1); INSERT INTO cycles(id,ordinal,rough_date) VALUES('c',1,'2000-01-01'); INSERT INTO sessions(id,event_date,host_member_id,cycle_id,cycle_slot) VALUES('a','2000-01-01','m','c',1),('b','2000-01-01','m','c',1)");
    expect(()=>local.sqlite.exec(readFileSync('worker/migrations/0006_history_integrity.sql','utf8'))).toThrow('UNIQUE');
    expect(local.sqlite.prepare('SELECT id,deleted_at FROM sessions ORDER BY id').all()).toEqual([{id:'a',deleted_at:null},{id:'b',deleted_at:null}]);
  }finally{local.sqlite.close();}
});
it('migrates existing snapshots, memberships and ungrouped events without losing history',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync('worker/migrations/0001_foundation.sql','utf8'));db.exec(readFileSync('worker/migrations/0002_auth.sql','utf8'));
    db.exec("INSERT INTO movies(id,title) VALUES('a','Fictional A'),('b','Fictional B'); INSERT INTO classics(movie_id) VALUES('b'),('a'); INSERT INTO sessions(id,event_date) VALUES('old','2000-01-01'); INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,fetched_at) VALUES('old-score','a','imdb','rating',8,10,'2000-01-01')");
    db.exec(readFileSync('worker/migrations/0003_cycles_scores.sql','utf8'));
    expect(db.prepare('SELECT id,raw_value,retrieved_via FROM source_scores').get()).toMatchObject({id:'old-score',raw_value:8,retrieved_via:'unspecified'});
    expect(db.prepare('SELECT cycle_id,kind,date_precision FROM sessions').get()).toMatchObject({cycle_id:null,kind:'hosted',date_precision:'exact'});
    expect(db.prepare('SELECT rank_seed FROM classics ORDER BY movie_id').all().map(r=>r.rank_seed)).toEqual([1,2]);
    db.exec("INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,fetched_at,retrieved_via) VALUES('same-time-api','a','imdb','rating',9,10,'2000-01-01','mdblist')");
    expect(db.prepare('SELECT count(*) n FROM source_scores').get()?.n).toBe(2);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {db.close();}
});

it('0013 adds constrained score observations without changing movies and cascades deletion',()=>{
 const local=disposableD1('0012_movie_director.sql');try {
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('check','Check')");const before=local.sqlite.prepare('SELECT * FROM movies').all();
 local.sqlite.exec(readFileSync('worker/migrations/0013_score_checks.sql','utf8'));
 expect(local.sqlite.prepare('SELECT * FROM movies').all()).toEqual(before);
 const insert=local.sqlite.prepare('INSERT INTO movie_score_checks VALUES(?,?,?,?)');insert.run('check','imdb:rating',0,'2026-10-06T00:00:00.000Z');
 expect(()=>insert.run('check','invalid',0,'2026-10-06T00:00:00.000Z')).toThrow();expect(()=>insert.run('check','tmdb:rating',2,'2026-10-06T00:00:00.000Z')).toThrow();
 local.sqlite.exec("DELETE FROM movies WHERE id='check'");expect(local.sqlite.prepare('SELECT * FROM movie_score_checks').all()).toEqual([]);
 }finally{local.sqlite.close();}
});
