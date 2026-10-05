import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { disposableD1 } from './d1';
import { parseManifest, runPairings, preflight, compatibility } from '../scripts/dev/pair-tmdb';
import { Repository } from '../worker/src/repository';
import type { ProviderMovie } from '../worker/src/providers/types';
let local:ReturnType<typeof disposableD1>;
const p={movie_id:'synthetic',title:'The Fictional Film',source_refs:['Should Watch:2'],tmdb_id:'42',matched_title:'The Fictional Film',matched_year:2001,confidence:'high' as const};
const manifest=()=>parseManifest({version:1,matched_count:1,pairings:[p],manual_review:[{movie_id:'ignored'}]});
const response=()=>Response.json({id:42,title:p.title,original_title:'Original Fiction',release_date:'2001-02-03',runtime:100,overview:'Overview',genres:[{name:'Drama'}],poster_path:'/synthetic.jpg',backdrop_path:'/backdrop.jpg',external_ids:{imdb_id:'tt1234567'},vote_average:7,vote_count:100});
beforeEach(()=>{local=disposableD1();local.sqlite.exec("INSERT INTO movies(id,title,import_source,import_key) VALUES('synthetic','The Fictional Film','archive','synthetic'); INSERT INTO movie_import_refs(movie_id,import_source,source_ref) VALUES('synthetic','archive','Should Watch:2')");});
afterEach(()=>{local.sqlite.close();vi.unstubAllGlobals();});
it('preflights without calls/writes, applies one response atomically, and resumes without calls',async()=>{
 const fetch=vi.fn().mockImplementation(response);vi.stubGlobal('fetch',fetch);
 const save=vi.fn().mockResolvedValue(undefined);
 expect(await runPairings(local.db,manifest(),{apply:false,save})).toMatchObject({eligible:1,provider_calls:0,remaining_without_tmdb:1});expect(fetch).not.toHaveBeenCalled();
 const report=await runPairings(local.db,manifest(),{apply:true,token:'synthetic',save});expect(report.accepted).toHaveLength(1);expect(report.provider_calls).toBe(1);expect(report.remaining_without_tmdb).toBe(0);
 const movie=(await new Repository(local.db).catalog()).movies[0];expect(movie.assets).toHaveLength(2);expect(movie.runtime).toBe(100);expect(movie.genres).toEqual(['Drama']);expect(movie.tmdb_metadata_checked_at).toBe(movie.tmdb_artwork_checked_at);
 expect((await runPairings(local.db,manifest(),{apply:true,token:'synthetic',save})).already_applied).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);
});
it('rejects contradictory returned title/year without attaching',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:42,title:'Different Film',release_date:'1990-01-01'})));
 const report=await runPairings(local.db,manifest(),{apply:true,token:'synthetic',save:async()=>{}});expect(report.rejected).toHaveLength(1);expect(local.sqlite.prepare('SELECT * FROM movie_external_ids').all()).toEqual([]);
});
it('blocks missing movie, provenance mismatch, existing identity and other ownership',async()=>{
 expect(await preflight(local.db,{...p,movie_id:'missing'})).toHaveProperty('reason');
 expect(await preflight(local.db,{...p,source_refs:['Should Watch:3']})).toHaveProperty('reason');
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('other','Other');INSERT INTO movie_external_ids VALUES('other','tmdb','42')");expect(await preflight(local.db,p)).toHaveProperty('reason');
 local.sqlite.exec("DELETE FROM movie_external_ids;INSERT INTO movie_external_ids VALUES('synthetic','tmdb','43')");expect(await preflight(local.db,p)).toHaveProperty('reason');
 local.sqlite.exec("DELETE FROM movie_external_ids;INSERT INTO movie_external_ids VALUES('synthetic','imdb','tt1111111')");expect(await preflight(local.db,p)).toHaveProperty('reason');
});
it('rolls back identity and metadata on returned IMDb ownership conflict',async()=>{
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('other','Other');INSERT INTO movie_external_ids VALUES('other','imdb','tt1234567')");vi.stubGlobal('fetch',vi.fn().mockImplementation(response));
 const report=await runPairings(local.db,manifest(),{apply:true,token:'synthetic',save:async()=>{}});expect(report.conflicts).toHaveLength(1);expect(await new Repository(local.db).findExternal('tmdb','42')).toBeNull();
});
it('transactional provenance guard rolls back a raced change',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>{local.sqlite.exec("UPDATE movie_import_refs SET source_ref='Should Watch:3'");return response();}));
 const report=await runPairings(local.db,manifest(),{apply:true,token:'synthetic',save:async()=>{}});expect(report.conflicts).toHaveLength(1);expect(await new Repository(local.db).findExternal('tmdb','42')).toBeNull();
 expect(local.sqlite.prepare('SELECT runtime FROM movies').get()?.runtime).toBeNull();
});
it('persists cooldown and halts, then refuses a call during cooldown',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:429,headers:{'Retry-After':'60'}}));vi.stubGlobal('fetch',fetch);
 const options={apply:true,token:'synthetic',save:async()=>{}};
 expect((await runPairings(local.db,manifest(),options)).provider_failures).toHaveLength(1);
 expect((await runPairings(local.db,manifest(),options)).provider_calls).toBe(0);expect(fetch).toHaveBeenCalledTimes(1);
});
it('allows punctuation, original titles and minor spelling; rejects material differences',()=>{
 const m={title:'Fictional Film!',original_title:null,year:2001,external_ids:[{provider:'tmdb',external_id:'42'}]} as ProviderMovie;
 expect(compatibility(p,m)).toBeNull();expect(compatibility(p,{...m,title:'The Fictional Flim'})).toBeNull();expect(compatibility(p,{...m,title:'Unrelated',original_title:p.title})).toBeNull();expect(compatibility(p,{...m,year:2011})).toBeTruthy();
 expect(compatibility(p,{...m,title:'The Fictional Film: A Fictional Subtitle'})).toBeNull();
});
it('rejects duplicate IDs and ignores manual_review data',()=>{expect(()=>parseManifest({version:1,matched_count:2,pairings:[p,p]})).toThrow();expect(manifest().pairings).toHaveLength(1);});
