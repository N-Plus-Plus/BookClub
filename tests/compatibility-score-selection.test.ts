import { readFileSync } from 'node:fs';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { ScoreService } from '../worker/src/score-service';
import { requiredScores } from '../shared/ranking';
let local:ReturnType<typeof disposableD1>,repo:Repository;
beforeEach(()=>{
  local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  local.sqlite.exec("DELETE FROM classics;UPDATE sessions SET deleted_at='2026-01-01';INSERT INTO builder_sets(id,owner_member_id) VALUES('private-set','member-1')");
  repo=new Repository(local.db);
});
afterEach(()=>{local.sqlite.close();vi.unstubAllGlobals();});
async function film(scope:'builder'|'history'|'classic',complete=true){
  const id=await repo.manualMovie({title:'Synthetic candidate'});
  local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'imdb','tt1234567')").run(id);
  if(scope==='builder')local.sqlite.prepare("INSERT INTO builder_movies VALUES('private-set',?,1)").run(id);
  if(scope==='classic')await repo.setClassic(id,true);
  if(scope==='history'){
    local.sqlite.exec("INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES('active','2026-01-01','hosted','member-1')");
    local.sqlite.prepare("INSERT INTO session_movies VALUES('active',?,1)").run(id);
  }
  if(complete)await repo.appendScores(id,requiredScores.map(key=>{
    const [provider,metric]=key.split(':');
    return {provider,metric,raw_value:80,raw_scale:100,normalized_value:80,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'mdblist'};
  }));
  return id;
}
it.each(['builder','history'] as const)('excludes complete %s-only scores despite unanswered Seen',async scope=>{
  await film(scope);expect(await repo.enrichmentCandidates(10)).toEqual({ids:[],remaining:0,unidentified:0});
});
it('selects missing Builder scores, removes last-set eligibility and restores it through History',async()=>{
  const id=await film('builder',false);expect((await repo.enrichmentCandidates(10)).ids).toEqual([id]);
  local.sqlite.exec("DELETE FROM builder_sets WHERE id='private-set'");expect((await repo.enrichmentCandidates(10)).ids).toEqual([]);
  local.sqlite.exec("INSERT INTO sessions(id,event_date,kind,host_member_id) VALUES('active','2026-01-01','hosted','member-1')");
  local.sqlite.prepare("INSERT INTO session_movies VALUES('active',?,1)").run(id);
  expect((await repo.enrichmentCandidates(10)).ids).toEqual([id]);
});
it.each([false,true])('retains incomplete Classics Seen readiness, including Builder overlap=%s',async builder=>{
  const id=await film('classic');
  if(builder)local.sqlite.prepare("INSERT INTO builder_movies VALUES('private-set',?,1)").run(id);
  expect((await repo.enrichmentCandidates(10)).ids).toEqual([id]);
  local.sqlite.prepare('INSERT INTO seen_states(movie_id,member_id,seen) SELECT ?,id,0 FROM members WHERE active=1').run(id);
  expect((await repo.enrichmentCandidates(10)).ids).toEqual([]);
});
it('does not retry a successful compatibility collection because Builder Seen is unanswered',async()=>{
  const id=await film('builder',false);
  const fetch=vi.fn().mockResolvedValue(Response.json([{imdb_id:'tt1234567',ratings:[{source:'imdb',value:8},{source:'tomatoes',value:80},{source:'popcorn',value:80},{source:'letterboxd',value:8},{source:'metacritic',value:80},{source:'tmdb',value:80}]}]));
  vi.stubGlobal('fetch',fetch);
  const service=new ScoreService(repo,{DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173',MDBLIST_API_KEY:'fictional'});
  expect((await service.enrich(10)).results.map(r=>r.movie.id)).toEqual([id]);
  expect((await service.enrich(10)).results).toEqual([]);expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps invalid identity unresolved and respects conclusive unavailable dimensions without changing Classics',async()=>{
  const id=await film('builder',false);
  local.sqlite.prepare("UPDATE movie_external_ids SET external_id='invalid' WHERE movie_id=?").run(id);
  expect(await repo.enrichmentCandidates(10)).toEqual({ids:[],remaining:0,unidentified:1});
  await repo.saveScoreChecks(id,requiredScores.map(key=>({key,available:false})));
  expect(await repo.enrichmentCandidates(10)).toEqual({ids:[],remaining:0,unidentified:0});
  await repo.setClassic(id,true);expect((await repo.enrichmentCandidates(10)).unidentified).toBe(1);
});
