import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { ProductRepository } from '../worker/src/product-repository';
import { latestScores, rankMovie, sortClassics } from '../shared/ranking';
import { hydrateCatalog } from '../shared/catalog';
import { metadataCandidate, metadataGaps, tmdbIdentity } from '../shared/metadata';
import { metadataSql, metadataPrioritySql } from '../worker/src/metadata-sql';
import { ScoreService } from '../worker/src/score-service';
import { effectiveScoreSql } from '../worker/src/score-sql';
import type { SQLInputValue } from 'node:sqlite';
import worker from '../worker/src/index';
import type { Env } from '../worker/src/http';
import type { Movie, Score } from '../shared/types';
let local:ReturnType<typeof disposableD1>,repo:Repository,env:Env;
beforeEach(() => {
  local=disposableD1(); local.sqlite.exec(readFileSync('worker/seed.sql','utf8')); repo=new Repository(local.db);
  local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'");
  env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'};
});
afterEach(() => {local.sqlite.close();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function call<T>(path:string,method='GET',input?:unknown):Promise<T> {
  const response=await worker.fetch(new Request(`http://api/api/v1${path}`,{method,headers:{'X-BookClub-Dev-Member':'member-1'},...(input ? {body:JSON.stringify(input)} : {})}),env);
  expect(response.status,await response.clone().text()).toBeLessThan(300);
  return (await response.json() as {data:T}).data;
}
function append(id:string, score:Partial<Score>, ref:string) {
  const s={provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:null,fetched_at:'2026-01-01T00:00:00.000Z',retrieved_via:'mdblist',source_ordinal:null,legacy_preferred:0,...score};
  local.sqlite.prepare('INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,source_ref,source_ordinal,legacy_preferred) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(ref,id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via,ref,s.source_ordinal,s.legacy_preferred);
}
it('linear relationship assembly matches the previous filter assembler, without internal join fields',async () => {
  // Repeat appearances, null metadata and nonpreferred historical artwork are deliberate.
  local.sqlite.exec("INSERT INTO session_movies VALUES('demo-1','arrival',4)");
  const result=await repo.catalog();
  const all=(table:string,order='') => local.sqlite.prepare(`SELECT * FROM ${table} ${order}`).all() as Record<string,unknown>[];
  const scores=all('source_scores','ORDER BY fetched_at,id'),seen=all('seen_states'),memberships=all('classics'),genres=all('movie_genres','ORDER BY genre'),assets=all('movie_assets','ORDER BY preferred DESC,id'),ids=all('movie_external_ids');
  const fields=(rows:Record<string,unknown>[],movie:string,keys:string[]) => rows.filter(r=>r.movie_id===movie).map(r=>Object.fromEntries(keys.map(k=>[k,r[k]])));
  for(const movie of result.movies) {
    const expectedScores=fields(scores,movie.id,['provider','metric','raw_value','raw_scale','normalized_value','vote_count','fetched_at','retrieved_via','upstream_updated_at','source_ref','source_ordinal','legacy_preferred']) as unknown as Score[];
    const expectedSeen=fields(seen,movie.id,['member_id','seen','updated_at']) as unknown as Movie['seen'];
    const membership=fields(memberships,movie.id,['rank_seed','added_at','source'])[0] as unknown as Movie['classics_membership'];
    expect(movie).toMatchObject({scores:expectedScores,seen:expectedSeen,classic:Boolean(membership),classics_membership:membership ?? null,
      ranking:membership ? rankMovie(expectedScores,expectedSeen,result.members,membership.rank_seed) : null,
      genres:genres.filter(g=>g.movie_id===movie.id).map(g=>g.genre),
      assets:fields(assets,movie.id,['provider','asset_type','reference','width','height','preferred']),external_ids:fields(ids,movie.id,['provider','external_id'])});
    const {appearances,...detail}= (await repo.movieDetails([movie.id]))[0]; expect({...detail,external_ids:[...detail.external_ids].sort((a,b)=>a.provider.localeCompare(b.provider)),seen:[...detail.seen].sort((a,b)=>a.member_id.localeCompare(b.member_id))}).toEqual({...movie,external_ids:[...movie.external_ids].sort((a,b)=>a.provider.localeCompare(b.provider)),seen:[...movie.seen].sort((a,b)=>a.member_id.localeCompare(b.member_id))});
    expect(appearances.every(a=>!('movie_id' in a))).toBe(true);
  }
  for(const session of result.sessions) {
    const joins=local.sqlite.prepare('SELECT movie_id FROM session_movies WHERE session_id=? ORDER BY position').all(session.id);
    expect(session.movies.map(m=>m.id)).toEqual(joins.map(j=>j.movie_id));
    expect(await repo.session(session.id)).toEqual(session);
    expect(session.movies.every(m=>m===result.movies.find(f=>f.id===m.id))).toBe(true);
  }
});
it('compact transport resolves ordered references and removes obsolete captures with latestScores equivalence',async () => {
  append('arrival',{retrieved_via:'omdb',fetched_at:'2026-08-01',raw_value:9},'omdb-new');
  append('arrival',{fetched_at:'2026-01-02',raw_value:7},'mdb-latest');
  append('arrival',{fetched_at:'2026-01-03',raw_value:99},'mdb-invalid');
  append('arrival',{provider:'tmdb',retrieved_via:'tmdb',raw_value:7},'direct');
  append('arrival',{provider:'tmdb',retrieved_via:'mdblist',fetched_at:'2026-08-01',raw_value:9},'indirect');
  for(const [ref,preferred,ordinal] of [['legacy-a',0,10],['legacy-b',1,1],['legacy-c',1,2]] as const)
    append('arrival',{provider:'letterboxd',retrieved_via:'legacy-spreadsheet',legacy_preferred:preferred,source_ordinal:ordinal},ref);
  append('arrival',{provider:'metacritic',retrieved_via:'legacy-spreadsheet',source_ordinal:3,raw_value:7},'tie-z');
  append('arrival',{provider:'metacritic',retrieved_via:'legacy-spreadsheet',source_ordinal:3,raw_value:6},'tie-a');
  append('arrival',{provider:'custom',raw_scale:null,normalized_value:0},'normalised');
  const legacy=await repo.catalog(), compact=await repo.compactCatalog(), hydrated=hydrateCatalog(compact);
  for(const movie of hydrated.movies) {
    const previous=legacy.movies.find(m=>m.id===movie.id)!;
    expect(movie).toEqual({...previous,scores:latestScores(previous.scores)});
    expect(movie.ranking).toEqual(previous.ranking);
  }
  expect(compact.sessions.every(s=>!('movies' in s))).toBe(true);
  expect(compact.sessions.map(s=>s.movie_ids)).toEqual(legacy.sessions.map(s=>s.movies.map(m=>m.id)));
  for(const session of hydrated.sessions) for(const movie of session.movies) expect(movie).toBe(hydrated.movies.find(m=>m.id===movie.id));
  const json=JSON.stringify(compact);expect(json).not.toContain('mdb-invalid');expect(json).not.toContain('omdb-new');expect(json).not.toContain('indirect');
  expect(json.match(/"title":"Arrival"/g)).toHaveLength(1);
  expect(local.sqlite.prepare("SELECT count(*) AS count FROM source_scores WHERE movie_id='arrival'").get()!.count).toBeGreaterThan(hydrated.movies.find(m=>m.id==='arrival')!.scores.length);
});
const sessionMutation=async(path:string,method:string,input:unknown)=>(await call<import('../shared/types').JournalMutationResult>(path,method,input)).session!;
it('all partial and single-film routes, Event responses and Builder publication work with catalog disabled',async () => {
  const before=await repo.catalog();const forbidden=vi.spyOn(Repository.prototype,'catalog').mockRejectedValue(new Error('Full catalogue forbidden'));
  expect(await call('/members')).toEqual(before.members);expect(await call('/cycles')).toEqual(before.cycles);
  expect(await call('/movies')).toEqual(before.movies);expect(await call('/classics')).toEqual(sortClassics(before.movies.filter(m=>m.classic)));
  expect(await call('/sessions')).toEqual(before.sessions);expect(await call(`/sessions/${before.sessions[0].id}`)).toEqual(before.sessions[0]);
  await call('/movies/arrival');await call('/movies/arrival/seen/member-1','PUT',{seen:false});await call('/movies/arrival/classics','PUT',{classic:true});
  await call('/movies/arrival/refresh-scores','POST');await call('/movies','POST',{title:'Manual fixture'});
  await call('/movies/import','POST',{provider:'tmdb',externalId:'329865'}); // stored identity reuse; no provider request
  const event=await sessionMutation('/sessions','POST',{event_date:'2001-01-01',movie_ids:['arrival','moon','arrival'],complete_turn:false});
  expect(event.movies.map(m=>m.id)).toEqual(['arrival','moon','arrival']);
  const replaced=await sessionMutation(`/sessions/${event.id}`,'PUT',{event_date:'2001-01-02',movie_ids:['moon']});expect(replaced.movies.map(m=>m.id)).toEqual(['moon']);
  const builder=await new ProductRepository(local.db).saveBuilder('member-1',{movie_ids:['arrival','moon']});
  const published=await sessionMutation(`/builders/${builder.id}/publish`,'POST',{revision:0,event_date:'2001-01-03',cycle_id:null,cycle_slot:1,complete_turn:false});
  expect(published.movies.map(m=>m.id)).toEqual(['arrival','moon']);
  await call('/classics/enrich','POST',{limit:2});
  env.TMDB_READ_TOKEN='mock-only';vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:42,title:'Mock import',original_title:'Mock import',release_date:'2000-01-01',runtime:90,overview:'Fixture',genres:[],credits:{crew:[]},external_ids:{},vote_average:7,vote_count:5})));
  expect((await call<Movie>('/movies/import','POST',{provider:'tmdb',externalId:'42'})).title).toBe('Mock import');
  await call('/catalog/compact');expect(forbidden).not.toHaveBeenCalled();
});
it('compatibility enrichment candidates match rankability/identity selection without catalogue assembly',async () => {
  await repo.setClassic('arrival',true);
  const invalid=await repo.manualMovie({title:'Invalid identity'});await repo.setClassic(invalid,true);
  local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb','00042')").run(invalid);
  const long=await repo.manualMovie({title:'Long supported MDBList ID'});await repo.setClassic(long,true);
  local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb','123456789012')").run(long);
  const {mdbId}=await import('../worker/src/providers/mdblist');
  const movies=(await repo.catalog()).movies, candidates=movies.filter(m=>m.classic && !m.ranking?.rankable);
  const identified=candidates.filter(m=>mdbId(m.external_ids));
  expect(await repo.enrichmentCandidates(2)).toEqual({ids:identified.slice(0,2).map(m=>m.id),remaining:Math.max(0,identified.length-2),unidentified:candidates.length-identified.length});
  vi.spyOn(repo,'catalog').mockRejectedValue(new Error('forbidden'));
  expect((await new ScoreService(repo,env).enrich(2)).results).toHaveLength(Math.min(2,identified.length));
});
it('metadata applies LIMIT and aggregate counts in SQL rather than returning an all-library candidate set',async () => {
  for(let n=1;n<=40;n++) {
    local.sqlite.prepare('INSERT INTO movies(id,title,director,runtime) VALUES(?,?,?,?)').run(`fixture-${String(n).padStart(2,'0')}`,`Fixture ${n}`,n%2 ? null : 'Director',n%3 ? 100 : null);
    local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb',?)").run(`fixture-${String(n).padStart(2,'0')}`,String(n));
    if(n%2) local.sqlite.prepare('INSERT INTO movie_genres VALUES(?,?)').run(`fixture-${String(n).padStart(2,'0')}`,n%3 ? 'Sci-Fi' : 'not a genre');
  }
  const movies=(await repo.catalog()).movies,expected=movies.filter(metadataCandidate).sort((a,b)=>metadataGaps(b)-metadataGaps(a)||a.id.localeCompare(b.id));
  const prepare=local.db.prepare.bind(local.db), returned:{sql:string;count:number}[]=[];
  vi.spyOn(local.db,'prepare').mockImplementation(sql=>{
    const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>({...statement,bind:(...args)=>wrap(statement.bind(...args)),all:async()=>{const response=await statement.all();returned.push({sql,count:response.results.length});return response;}} as D1PreparedStatement);
    return wrap(prepare(sql));
  });
  expect((await repo.metadataCandidates(2)).map(m=>m.id)).toEqual(expected.slice(0,2).map(m=>m.id));
  expect(await repo.metadataCounts()).toEqual({remaining:expected.length,unidentified:movies.filter(m=>!tmdbIdentity(m)).length});
  const selection=returned.find(r=>r.sql.includes('FROM eligible'));expect(selection).toMatchObject({count:2});expect(selection!.sql).toMatch(/LIMIT \?/);
  expect(returned.some(r=>r.sql.includes('FROM movies m')&&!r.sql.includes('LIMIT'))).toBe(false);
});
it('one Builder read is direct and validation queries the deduplicated lineup once',async () => {
  const product=new ProductRepository(local.db);vi.spyOn(product,'builders').mockRejectedValue(new Error('All Builders forbidden'));
  const queries:string[]=[];const prepare=local.db.prepare.bind(local.db);vi.spyOn(local.db,'prepare').mockImplementation(sql=>{queries.push(sql);return prepare(sql);});
  const builder=await product.saveBuilder('member-1',{movie_ids:['arrival','moon','arrival']});
  expect(await product.builder('member-1',builder.id)).toEqual(builder);expect(product.builders).not.toHaveBeenCalled();
  expect(queries.filter(q=>q.startsWith('SELECT id FROM movies'))).toEqual(['SELECT id FROM movies WHERE id IN (SELECT value FROM json_each(?))']);
  await expect(product.saveBuilder('member-1',{movie_ids:['moon','missing','moon']})).rejects.toMatchObject({code:'INVALID_MOVIE'});
  await expect(product.builder('member-2',builder.id)).rejects.toMatchObject({status:404});
});
it('0014 preserves joins and replaces reverse full scans with the intended covering index',() => {
  const previous=disposableD1('0013_score_checks.sql');try {
    const query='SELECT sm.movie_id,s.id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=? AND s.deleted_at IS NULL';
    const plan=()=>previous.sqlite.prepare('EXPLAIN QUERY PLAN '+query).all('arrival').map(r=>r.detail).join(' ');
    previous.sqlite.exec(readFileSync('worker/seed.sql','utf8'));const before=previous.sqlite.prepare('SELECT * FROM session_movies').all();expect(plan()).toContain('SCAN sm');
    previous.sqlite.exec(readFileSync('worker/migrations/0014_session_movie_lookup.sql','utf8'));
    expect(plan()).toContain('USING COVERING INDEX session_movies_by_movie');expect(plan()).not.toContain('SCAN sm');
    expect(previous.sqlite.prepare('SELECT * FROM session_movies').all()).toEqual(before);expect(previous.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {previous.sqlite.close();}
  const meta=local.sqlite.prepare('EXPLAIN QUERY PLAN '+metadataSql(true,true)+` SELECT id FROM eligible WHERE identified AND candidate ORDER BY ${metadataPrioritySql} DESC LIMIT ?`).all(new Date().toISOString(),2).map(r=>r.detail).join(' ');
  expect(meta).not.toContain('CORRELATED');expect(meta).toContain('movie_external_ids');
});

it('Session response queries constrain all film data to that lineup and never read cycles or appearances',async()=>{
 const queries:string[]=[];const prepare=local.db.prepare.bind(local.db);vi.spyOn(local.db,'prepare').mockImplementation(sql=>{queries.push(sql);return prepare(sql);});
 const session=await repo.session('demo-1');expect(session.movies.length).toBeGreaterThan(0);
 const filmQueries=queries.filter(q=>q.startsWith('SELECT') && /FROM (movies|movie_assets|movie_external_ids|source_scores|seen_states|classics|movie_genres)\b/.test(q));
 expect(filmQueries).toHaveLength(7);expect(filmQueries.every(q=>q.includes('s.id=?'))).toBe(true);
 expect(queries.some(q=>q.includes('FROM cycles')||q.includes('s.host_member_id,sm.position'))).toBe(false);
});

it('0015 retains score lookup plans, effective ranking, hydration and maintenance results',async()=>{
 const previous=disposableD1('0014_session_movie_lookup.sql');try {
 previous.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
 const queries:{sql:string;values:SQLInputValue[]}[]=[],prepare=previous.db.prepare.bind(previous.db);
 vi.spyOn(previous.db,'prepare').mockImplementation(sql=>{
  const record={sql,values:[] as SQLInputValue[]};if(sql.includes('source_scores'))queries.push(record);
  const statement=prepare(sql);
  return {...statement,bind:(...values:SQLInputValue[])=>{record.values=values;return statement.bind(...values);}} as D1PreparedStatement;
 });
 const repo=new Repository(previous.db);
 const read=async()=>[await repo.catalog(),await repo.compactCatalog(),await repo.movies(),await repo.movies(true),await repo.movieDetails(['arrival','moon']),await repo.session('demo-1'),await repo.scoreMaintenanceStatus(),await repo.enrichmentCandidates(2)];
 const before=await read();
 queries.push({sql:effectiveScoreSql("AND ss.movie_id IN (?)"),values:['arrival']},
  {sql:'SELECT * FROM source_scores WHERE movie_id=? AND provider=? AND metric=? AND retrieved_via=? ORDER BY fetched_at DESC',values:['arrival','imdb','rating','mdblist']});
 const plans=()=>queries.map(q=>previous.sqlite.prepare('EXPLAIN QUERY PLAN '+q.sql).all(...q.values).map(r=>String(r.detail)).join('\n'));
 const oldPlans=plans();expect(oldPlans.some(p=>p.includes('USING INDEX scores_by_movie'))).toBe(true);
 previous.sqlite.exec(readFileSync('worker/migrations/0015_drop_redundant_score_index.sql','utf8'));
 const newPlans=plans();
 expect(newPlans).toEqual(oldPlans.map(p=>p.replaceAll('scores_by_movie','sqlite_autoindex_source_scores_2')));
 expect(newPlans.at(-1)).toContain('SEARCH source_scores USING INDEX sqlite_autoindex_source_scores_2 (movie_id=? AND provider=? AND metric=? AND retrieved_via=?)');
 expect(newPlans.at(-2)).toContain('SEARCH live USING INDEX sqlite_autoindex_source_scores_2 (movie_id=? AND provider=? AND metric=?)');
 expect(newPlans.at(-2)).toContain('SEARCH ss USING INDEX sqlite_autoindex_source_scores_2 (movie_id=?)');
 expect(await read()).toEqual(before);
 }finally{previous.sqlite.close();}
});
