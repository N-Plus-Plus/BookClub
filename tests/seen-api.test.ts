import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../worker/src/index';
import { Repository } from '../worker/src/repository';
import { rankMovie } from '../shared/ranking';
import { disposableD1 } from './d1';
import type { Env } from '../worker/src/http';
import type { MovieDetail } from '../shared/types';
let local: ReturnType<typeof disposableD1>, env: Env;
beforeEach(()=>{local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'};});
afterEach(()=>{vi.restoreAllMocks();local.sqlite.close();});
const call=(path:string,seen?:boolean|null)=>worker.fetch(new Request(`http://api/api/v1${path}`,{method:seen===undefined?'GET':'PUT',headers:{'X-BookClub-Dev-Member':'member-1'},...(seen===undefined?{}:{body:JSON.stringify({seen})})}),env);
it('loads only selected-film relationships for Seen PUT and ordinary detail, preserving the MovieDetail contract',async()=>{
 const repo=new Repository(local.db);await repo.setClassic('arrival',true);
 const catalog=await repo.catalog();const previous=(await repo.movieDetails(['arrival']))[0];
 const full=vi.spyOn(Repository.prototype,'catalog').mockRejectedValue(new Error('Full catalogue read forbidden'));
 const narrow=vi.spyOn(Repository.prototype,'movieDetails');
 const queries:{sql:string;values:unknown[]}[]=[];const prepare=local.db.prepare.bind(local.db);
 vi.spyOn(local.db,'prepare').mockImplementation(sql=>{
   const statement=prepare(sql),bind=statement.bind.bind(statement);
   vi.spyOn(statement,'bind').mockImplementation((...values)=>{queries.push({sql,values});return bind(...values);});return statement;
 });
 const response=await call('/movies/arrival/seen/member-1',false);expect(response.status,await response.clone().text()).toBe(200);
 const movie=(await response.json() as {data:MovieDetail}).data;
 expect(movie.id).toBe('arrival');expect(movie.seen.find(s=>s.member_id==='member-1')?.seen).toBe(1);
 expect(movie.ranking).toEqual(rankMovie(movie.scores,movie.seen,catalog.members,movie.classics_membership!.rank_seed));
 expect(movie.appearances).toEqual(previous.appearances);expect(movie.appearances.length).toBeGreaterThan(0);
 for(const field of ['scores','genres','assets','external_ids','classics_membership'] as const) expect(movie[field]).toEqual(previous[field]);
 const relationships=queries.filter(q=>/SELECT.*FROM (movies|movie_assets|movie_external_ids|source_scores|seen_states|classics|movie_genres|session_movies)\b/.test(q.sql));
 expect(relationships.length).toBe(10); // existence guard, transactional History guard and eight selected relationships
 for(const query of relationships) {expect(query.values).toContain('arrival');expect(query.sql).toMatch(/WHERE .*?(id=\?|IN \(\?\))/);}
 expect(queries.some(q=>/FROM cycles|FROM sessions ORDER/.test(q.sql))).toBe(false);
 expect(narrow).toHaveBeenCalledExactlyOnceWith(['arrival']);expect(full).not.toHaveBeenCalled();
 const read=await call('/movies/arrival');expect(read.status).toBe(200);expect((await read.json() as {data:MovieDetail}).data).toEqual(movie);expect(full).not.toHaveBeenCalled();
 const undo=await call('/movies/arrival/seen/member-1',null);expect(undo.status).toBe(200);expect((await undo.json() as {data:MovieDetail}).data.seen.find(s=>s.member_id==='member-1')?.seen).toBe(1);
 expect((await call('/movies/nonexistent')).status).toBe(404);
});
