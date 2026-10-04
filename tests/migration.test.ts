import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
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
