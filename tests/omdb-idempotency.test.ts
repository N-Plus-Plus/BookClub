import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { ScoreService } from '../worker/src/score-service';
import { parseOmdbMetadata } from '../worker/src/providers/omdb';
import { maintainScores } from '../frontend/score-maintenance';
import type { Env } from '../worker/src/http';
let local: ReturnType<typeof disposableD1>, repo: Repository, id: string, env: Env;
const metadata = {year:1999,runtime:100,director:'Director',genres:['Drama','Sci-Fi']};
const row = () => local.sqlite.prepare('SELECT * FROM movies WHERE id=?').get(id);
const genres = () => local.sqlite.prepare('SELECT genre FROM movie_genres WHERE movie_id=? ORDER BY genre').all(id).map(r=>r.genre);
beforeEach(async()=>{
 local=disposableD1(); repo=new Repository(local.db);
 id=await repo.manualMovie({title:'Film',year:1999,runtime:100});await repo.setClassic(id,true);
 local.sqlite.prepare("UPDATE movies SET director='Director',overview='Keep',updated_at='2000-01-01' WHERE id=?").run(id);
 local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'imdb','tt0000001')").run(id);
 for(const g of metadata.genres) local.sqlite.prepare('INSERT INTO movie_genres VALUES(?,?)').run(id,g);
 local.sqlite.exec(`CREATE TABLE observed_writes(kind TEXT,genre TEXT);
 CREATE TRIGGER observe_movie AFTER UPDATE ON movies BEGIN INSERT INTO observed_writes VALUES('movie',NULL); END;
 CREATE TRIGGER observe_delete AFTER DELETE ON movie_genres BEGIN INSERT INTO observed_writes VALUES('delete',OLD.genre); END;
 CREATE TRIGGER observe_insert AFTER INSERT ON movie_genres BEGIN INSERT INTO observed_writes VALUES('insert',NEW.genre); END;`);
 env={DB:local.db,APP_ENV:'local',OMDB_API_KEY:'fictional'} as Env;
});
afterEach(()=>{local.sqlite.close();vi.restoreAllMocks();vi.unstubAllGlobals();});
const writes = () => local.sqlite.prepare('SELECT * FROM observed_writes').all();
it('successful identical/reordered metadata makes zero mutations, preserves updated_at and aggregates as no change',async()=>{
 const before=row(); const prepare=vi.spyOn(local.db,'prepare');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'True',Year:'1999',Runtime:'100 min',Director:'Director',Genre:'Sci-Fi, Drama, Drama'})));
 const response=await new ScoreService(repo,env).maintain('metadata',[id]);
 expect(response.results[0].providers[0]).toMatchObject({status:'success',count:0});
 expect(writes()).toEqual([]);expect(row()).toEqual(before);
 expect(prepare.mock.calls.filter(([sql])=>/^(UPDATE|DELETE|INSERT)/.test(sql))).toEqual([]);
 const run=await maintainScores({ids:[id],batch:async()=>response,stopped:()=>false,progress:async()=>{}});
 expect(run).toMatchObject({updated:0,noChange:1,failed:0});
});
it('changes only supplied changed scalars, preserving all other movie fields and genre rows',async()=>{
 const before=row();expect(await repo.enrichOmdbMetadata(id,'tt0000001',{...metadata,runtime:101})).toBe(true);
 expect(writes()).toEqual([{kind:'movie',genre:null}]);
 expect(row()).toEqual({...before,runtime:101,updated_at:expect.any(String)});expect(row()!.updated_at).not.toBe(before!.updated_at);
});
it('treats canonical genre aliases as equivalent and preserves unknown IMDb genres',async()=>{
 local.sqlite.prepare("INSERT INTO movie_genres VALUES(?,'Film-Noir')").run(id);local.sqlite.exec('DELETE FROM observed_writes');
 expect(await repo.enrichOmdbMetadata(id,'tt0000001',{...metadata,genres:['Science Fiction','Drama','Film-Noir']})).toBe(false);
 expect(writes()).toEqual([]);
});
it('diffs authoritative nonempty sets without rewriting unchanged genre rows or the movie timestamp',async()=>{
 const before=row();expect(await repo.enrichOmdbMetadata(id,'tt0000001',{...metadata,genres:['Drama','Comedy']})).toBe(true);
 expect(genres()).toEqual(['Comedy','Drama']);expect(row()).toEqual(before);
 expect(writes()).toEqual([{kind:'delete',genre:'Sci-Fi'},{kind:'insert',genre:'Comedy'}]);
});
it('preserves unavailable/N/A/null fields without no-op writes',async()=>{
 const before=row();expect(await repo.enrichOmdbMetadata(id,'tt0000001',parseOmdbMetadata({Response:'True',Year:'N/A',Runtime:'N/A',Director:' N/A ',Genre:' N/A '}))).toBe(false);
 expect(writes()).toEqual([]);expect(row()).toEqual(before);expect(genres()).toEqual(['Drama','Sci-Fi']);
});
it('checks identity even for a no-op and refuses all changes after reassignment',async()=>{
 const other=await repo.manualMovie({title:'Other'});
 local.sqlite.prepare("UPDATE movie_external_ids SET movie_id=? WHERE movie_id=? AND provider='imdb'").run(other,id);
 await expect(repo.enrichOmdbMetadata(id,'tt0000001',metadata)).rejects.toMatchObject({code:'IDENTITY_CONFLICT'});
 expect(writes()).toEqual([]);
});
it('guards movie and genre mutations transactionally against identity movement after preflight',async()=>{
 const other=await repo.manualMovie({title:'Other'}),batch=local.db.batch.bind(local.db),before=row();
 vi.spyOn(local.db,'batch').mockImplementationOnce(async statements=>{
  local.sqlite.prepare("UPDATE movie_external_ids SET movie_id=? WHERE movie_id=? AND provider='imdb'").run(other,id);
  return batch(statements);
 });
 await expect(repo.enrichOmdbMetadata(id,'tt0000001',{...metadata,year:2001,genres:['Comedy']})).rejects.toMatchObject({code:'IDENTITY_CONFLICT'});
 expect(row()).toEqual(before);expect(genres()).toEqual(['Drama','Sci-Fi']);expect(writes()).toEqual([]);
});
it('provider and database failures cannot report successful change',async()=>{
 const fetch=vi.fn(async()=>new Response(null,{status:503}));vi.stubGlobal('fetch',fetch);
 expect((await new ScoreService(repo,env).maintain('metadata',[id])).results[0].providers[0]).toMatchObject({status:'failed',count:0,blocking:true});
 fetch.mockImplementation(async()=>Response.json({Response:'True',Year:'2001'}));
 vi.spyOn(repo,'enrichOmdbMetadata').mockRejectedValueOnce(new Error('Database failed'));
 expect((await new ScoreService(repo,env).maintain('metadata',[id])).results[0].providers[0]).toMatchObject({status:'failed',count:0});
 expect(writes()).toEqual([]);
});
it('deleted and newly out-of-scope queued IDs give explicit scope errors before provider calls',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await repo.setClassic(id,false);
 await expect(new ScoreService(repo,env).maintain('metadata',[id])).rejects.toMatchObject({status:422,code:'INVALID_SCOPE',message:expect.stringContaining('queued film')});
 local.sqlite.prepare('DELETE FROM movies WHERE id=?').run(id);
 await expect(new ScoreService(repo,env).maintain('metadata',[id])).rejects.toMatchObject({status:422,code:'INVALID_SCOPE'});
 expect(fetch).not.toHaveBeenCalled();
});

it('a failed genre mutation rolls back scalar and genre changes and reports no successful change',async()=>{
 const before=row();local.sqlite.exec("CREATE TRIGGER reject_genre BEFORE INSERT ON movie_genres WHEN NEW.genre='Comedy' BEGIN SELECT RAISE(ABORT,'Fixture failure'); END;");
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'True',Year:'2001',Genre:'Comedy'})));
 const result=await new ScoreService(repo,env).maintain('metadata',[id]);
 expect(result.results[0].providers[0]).toMatchObject({status:'failed',count:0,blocking:true});
 expect(row()).toEqual(before);expect(genres()).toEqual(['Drama','Sci-Fi']);expect(writes()).toEqual([]);
});
