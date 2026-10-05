import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { disposableD1 } from './d1';
import { ensureMergeReceipts, planMerge, applyMerge, planRemoval, applyRemoval, type Merge } from '../scripts/dev/tmdb-merge';
import { parseRound2, runRound2, round2Compatibility, captureBaseline } from '../scripts/dev/pair-tmdb-round2';
import { Repository } from '../worker/src/repository';
import type { ProviderMovie } from '../worker/src/providers/types';
let local:ReturnType<typeof disposableD1>;
const a={movie_id:'a',title:'Fictional Film',source_refs:['Should Watch:2']};
const b={movie_id:'b',title:'Fictional Film!',source_refs:['Tracker:2:2']};
const op:Merge={tmdb_id:'42',members:[a,b],kind:'group'};
const snapshot=():ProviderMovie=>({title:'Fictional Film',original_title:'Original',year:2001,release_date:'2001-01-01',runtime:100,overview:'Overview',genres:['Drama'],assets:[{provider:'tmdb',asset_type:'poster',reference:'https://image.tmdb.org/t/p/w500/test.jpg',width:null,height:null,preferred:1}],scores:[],external_ids:[{provider:'tmdb',external_id:'42'}],fetched_at:new Date().toISOString()});
beforeEach(async()=>{
 local=disposableD1();
 local.sqlite.exec("INSERT INTO members(id,display_name) VALUES('member','Member'); INSERT INTO movies(id,title,import_source,import_key) VALUES('a','Fictional Film','archive','a'),('b','Fictional Film!','archive','b'); INSERT INTO movie_import_refs(movie_id,import_source,source_ref) VALUES('a','archive','Should Watch:2'),('b','archive','Tracker:2:2');");
 await ensureMergeReceipts(local.db);
});
afterEach(()=>{local.sqlite.close();vi.unstubAllGlobals();});
const addDurable=()=>local.sqlite.exec(`
 INSERT INTO sessions(id,event_date) VALUES('event','2001-01-01');INSERT INTO session_movies VALUES('event','b',1),('event','a',2);
 INSERT INTO builder_sets(id,owner_member_id) VALUES('draft','member');INSERT INTO builder_movies VALUES('draft','b',1);
 INSERT INTO classics(movie_id,source,rank_seed) VALUES('a','archive',2),('b','archive',3);
 INSERT INTO seen_states(movie_id,member_id,seen,updated_at) VALUES('a','member',1,'2000-01-01'),('b','member',1,'2001-01-01');
 INSERT INTO seen_import_observations VALUES('a','archive','Should Watch:2','member',1,'2000-01-01'),('b','archive','Tracker:2:2','member',1,'2001-01-01');
 INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,fetched_at,source_ref) VALUES('score-a','a','legacy','imdb',7,10,'2000-01-01','Should Watch:2'),('score-b','b','legacy','imdb',8,10,'2000-01-01','Tracker:2:2');
 INSERT INTO import_applied_entities VALUES('archive','movies','b','original-fingerprint');
 INSERT INTO history_audit(id,action,changes_json) VALUES('audit','edit','{"movie_id":"b"}');
 `);
it('owner confirmation tolerates translated/alternate title and historical year; wrong ID fails',()=>{
 const p={...a,action:'pair' as const,tmdb_id:'42',confirmation:'owner_confirmed' as const,strict_year:false};
 expect(round2Compatibility(p,{...snapshot(),title:'Translated regional title',year:2010})).toBeNull();
 expect(round2Compatibility(p,{...snapshot(),external_ids:[{provider:'tmdb',external_id:'43'}]})).toBeTruthy();
});
it('corrected rejection succeeds using one response for metadata/artwork and skips on resume',async()=>{
 const manifest=parseRound2({version:2,pairings:[{...a,action:'pair',tmdb_id:'42',confirmation:'corrected_rejection',strict_year:true,expected_title:'Fictional Film',expected_year:2001}],merge_into_existing:[],merge_groups:[]});
 const fetch=vi.fn().mockResolvedValue(Response.json({id:42,title:'Fictional Film',original_title:'Original',release_date:'2001-01-01',runtime:100,genres:[{name:'Drama'}],poster_path:'/test.jpg',vote_average:7,vote_count:2}));vi.stubGlobal('fetch',fetch);
 const baseline=await captureBaseline(local.db);const save=async()=>{};
 const first=await runRound2(local.db,manifest,{apply:true,token:'synthetic',save,baseline});expect(first.accepted).toHaveLength(1);expect(first.provider_calls).toBe(1);
 const second=await runRound2(local.db,manifest,{apply:true,token:'synthetic',save,baseline,previous:first});expect(second.accepted).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);
 const movie=(await new Repository(local.db).catalog()).movies.find(m=>m.id==='a')!;expect(movie.assets).toHaveLength(1);expect(movie.tmdb_artwork_checked_at).toBe(movie.tmdb_metadata_checked_at);
});
it('existing TMDB owner wins and preserves appearances, Builder, Classics, observations, Seen, refs and immutable audit/fingerprints',async()=>{
 addDurable();local.sqlite.exec("INSERT INTO movie_external_ids VALUES('b','tmdb','42')");
 const plan=await planMerge(local.db,{tmdb_id:'42',members:[a],kind:'existing'});expect(plan.survivor).toBe('b');await applyMerge(local.db,plan);
 expect(local.sqlite.prepare('SELECT movie_id,position FROM session_movies ORDER BY position').all()).toEqual([{movie_id:'b',position:1},{movie_id:'b',position:2}]);
 expect(local.sqlite.prepare('SELECT movie_id FROM builder_movies').get()?.movie_id).toBe('b');
 expect(local.sqlite.prepare('SELECT movie_id,rank_seed FROM classics').all()).toEqual([{movie_id:'b',rank_seed:2}]);
 expect(local.sqlite.prepare('SELECT * FROM source_scores').all()).toHaveLength(2);expect(local.sqlite.prepare('SELECT * FROM seen_import_observations').all()).toHaveLength(2);
 expect(local.sqlite.prepare('SELECT seen,updated_at FROM seen_states').get()).toEqual({seen:1,updated_at:'2001-01-01'});
 expect(local.sqlite.prepare('SELECT source_ref FROM movie_import_refs').all()).toHaveLength(2);
 expect(local.sqlite.prepare('SELECT payload_hash FROM import_applied_entities').get()?.payload_hash).toBe('original-fingerprint');expect(local.sqlite.prepare('SELECT changes_json FROM history_audit').get()?.changes_json).toBe('{"movie_id":"b"}');
 expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);expect(local.sqlite.prepare("SELECT * FROM movie_external_ids WHERE provider='tmdb'").all()).toHaveLength(1);
 const receipt=local.sqlite.prepare('SELECT snapshot_json FROM local_movie_merge_receipts').get()!;expect(JSON.parse(String(receipt.snapshot_json)).classics).toHaveLength(2);
 expect((await planMerge(local.db,{tmdb_id:'42',members:[a],kind:'existing'})).already).toBe(true);
});
it('chooses richest survivor deterministically and TMDB owner overrides richness',async()=>{
 expect((await planMerge(local.db,op)).survivor).toBe('a');expect((await planMerge(local.db,{...op,members:[b,a]})).survivor).toBe('a');
 local.sqlite.exec("INSERT INTO sessions(id,event_date) VALUES('s','2000');INSERT INTO session_movies VALUES('s','b',1)");expect((await planMerge(local.db,op)).survivor).toBe('b');
 local.sqlite.exec("INSERT INTO movie_external_ids VALUES('a','tmdb','42')");expect((await planMerge(local.db,op)).survivor).toBe('a');
});
it('group merges/attaches transactionally and changed/missing receipts cannot masquerade as success',async()=>{
 addDurable();const plan=await planMerge(local.db,op);await applyMerge(local.db,plan,snapshot());expect((await planMerge(local.db,op)).already).toBe(true);
 await expect(planMerge(local.db,{...op,members:[{...a,source_refs:['Should Watch:999']},b]})).rejects.toThrow();
 expect((await new Repository(local.db).catalog()).movies).toHaveLength(1);
 local.sqlite.exec("DELETE FROM source_scores WHERE id='score-a'");await expect(planMerge(local.db,op)).rejects.toThrow('observations');
 local.sqlite.exec('DELETE FROM local_movie_merge_receipts');await expect(planMerge(local.db,op)).rejects.toThrow('receipt');
});
it('rolls back the whole merge after a later write failure',async()=>{
 addDurable();const plan=await planMerge(local.db,op);const before=await captureBaseline(local.db);
 local.sqlite.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON movies BEGIN SELECT RAISE(ABORT,'synthetic failure');END");
 await expect(applyMerge(local.db,plan,snapshot())).rejects.toThrow();expect(await captureBaseline(local.db)).toEqual(before);expect(local.sqlite.prepare('SELECT * FROM local_movie_merge_receipts').all()).toEqual([]);
});
it('rejects conflicting Seen and overlapping observation keys without mutation',async()=>{
 addDurable();local.sqlite.exec("UPDATE seen_states SET seen=0 WHERE movie_id='b'");await expect(planMerge(local.db,op)).rejects.toThrow('Seen');
 local.sqlite.exec("UPDATE seen_states SET seen=1;UPDATE source_scores SET source_ref='same'");await expect(planMerge(local.db,op)).rejects.toThrow('source_scores');
 expect(local.sqlite.prepare('SELECT * FROM movies').all()).toHaveLength(2);
});
it('fails closed for undiscovered FK relationships and raced preflight rows',async()=>{
 const plan=await planMerge(local.db,op);local.sqlite.exec("UPDATE movie_import_refs SET source_ref='Should Watch:99' WHERE movie_id='a'");await expect(applyMerge(local.db,plan,snapshot())).rejects.toThrow();expect(local.sqlite.prepare('SELECT * FROM movies').all()).toHaveLength(2);
 local.sqlite.exec('CREATE TABLE future_refs(movie_id TEXT REFERENCES movies(id))');await expect(planMerge(local.db,op)).rejects.toThrow('Unsupported');
});
it('fresh existing owner merges with no provider calls; different-film owner conflicts',async()=>{
 local.sqlite.prepare("INSERT INTO movie_external_ids VALUES('b','tmdb','42')").run();local.sqlite.prepare('UPDATE movies SET tmdb_metadata_checked_at=?,tmdb_artwork_checked_at=? WHERE id=?').run(new Date().toISOString(),new Date().toISOString(),'b');
 const manifest=parseRound2({version:2,pairings:[],merge_into_existing:[{...a,action:'merge_into_existing_tmdb_owner',tmdb_id:'42',confirmation:'round1_existing_owner_conflict'}],merge_groups:[]});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const result=await runRound2(local.db,manifest,{apply:true,save:async()=>{}});expect(result.merges_completed).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
});
it('cached successful details survive a failed merge and are reused on resume',async()=>{
 const manifest=parseRound2({version:2,pairings:[],merge_into_existing:[],merge_groups:[{action:'merge_group_then_pair',tmdb_id:'42',members:[a,b],confirmation:'owner_confirmed'}]});
 const fetch=vi.fn().mockResolvedValue(Response.json({id:42,title:'Translated',release_date:'2010-01-01',genres:[],vote_average:7,vote_count:1}));vi.stubGlobal('fetch',fetch);
 local.sqlite.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON movies BEGIN SELECT RAISE(ABORT,'failure');END");
 const baseline=await captureBaseline(local.db),options={apply:true,token:'synthetic',save:async()=>{},baseline};
 const first=await runRound2(local.db,manifest,options);expect(first.merge_conflicts).toHaveLength(1);expect(first.provider_calls).toBe(1);
 local.sqlite.exec('DROP TRIGGER fail_delete');const next=await runRound2(local.db,manifest,{...options,previous:first});expect(next.merge_groups_completed).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);
 const again=await runRound2(local.db,manifest,{...options,previous:next});expect(again.already_applied_merges).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);
});
it('provider cooldown stops subsequent calls and preflight writes neither receipts nor identity',async()=>{
 local.sqlite.exec('DROP TABLE local_movie_merge_receipts');
 const manifest=parseRound2({version:2,pairings:[a,b].map((m,i)=>({...m,action:'pair',tmdb_id:String(42+i),confirmation:'owner_confirmed',strict_year:false})),merge_into_existing:[],merge_groups:[]});
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:429,headers:{'Retry-After':'60'}}));vi.stubGlobal('fetch',fetch);
 await runRound2(local.db,manifest,{apply:false,save:async()=>{}});expect(fetch).not.toHaveBeenCalled();expect(local.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='local_movie_merge_receipts'").get()).toBeUndefined();
 const first=await runRound2(local.db,manifest,{apply:true,token:'synthetic',save:async()=>{}});expect(first.cooldown_events).toBe(1);expect(fetch).toHaveBeenCalledTimes(1);
 await runRound2(local.db,manifest,{apply:true,token:'synthetic',save:async()=>{}});expect(fetch).toHaveBeenCalledTimes(1);
});
it('authorised removal preserves receipt evidence, removes its appearance only, and rolls back a failed deletion',async()=>{
 addDurable();local.sqlite.exec("UPDATE movies SET title='The Untamed' WHERE id='b';DELETE FROM builder_movies;DELETE FROM classics WHERE movie_id='b';DELETE FROM classics_seed_allocations WHERE movie_id='b'");
 const op={...b,title:'The Untamed',appearance_count:1,classic:false,confirmation:'owner_confirmed' as const,action:'remove_from_active_catalogue' as const};
 const plan=await planRemoval(local.db,op),before=await captureBaseline(local.db);
 local.sqlite.exec("CREATE TRIGGER fail_remove BEFORE DELETE ON movies BEGIN SELECT RAISE(ABORT,'test failure');END");
 await expect(applyRemoval(local.db,plan)).rejects.toThrow();expect(await captureBaseline(local.db)).toEqual(before);
 local.sqlite.exec('DROP TRIGGER fail_remove');await applyRemoval(local.db,plan);
 expect(local.sqlite.prepare('SELECT movie_id,position FROM session_movies').all()).toEqual([{movie_id:'a',position:2}]);expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
 const receipt=local.sqlite.prepare('SELECT snapshot_json FROM local_movie_removal_receipts').get()!;expect(JSON.parse(String(receipt.snapshot_json)).source_scores).toHaveLength(1);expect((await planRemoval(local.db,op)).already).toBe(true);
});
it('blocks unapproved or unexpectedly related removals; final pairing records provider scores from its sole detail response',async()=>{
 const op={...a,title:'Time',appearance_count:0,classic:false,confirmation:'owner_confirmed' as const,action:'remove_from_active_catalogue' as const};
 await expect(planRemoval(local.db,{...op,title:'Other'})).rejects.toThrow('authorised');local.sqlite.exec("UPDATE movies SET title='Time' WHERE id='a';INSERT INTO builder_sets(id,owner_member_id) VALUES('draft','member');INSERT INTO builder_movies VALUES('draft','a',1)");await expect(planRemoval(local.db,op)).rejects.toThrow('Builder');
 const manifest=parseRound2({version:3,pairings:[{...b,action:'pair_or_merge_existing_owner',tmdb_kind:'movie',tmdb_id:'42',confirmation:'owner_confirmed',strict_year:false}],merge_groups:[],removals:[]});
 const fetch=vi.fn().mockResolvedValue(Response.json({id:42,title:'Owner-confirmed alternate title',release_date:'2024-01-01',genres:[],vote_average:7.5,vote_count:123}));vi.stubGlobal('fetch',fetch);
 const report=await runRound2(local.db,manifest,{apply:true,token:'synthetic',save:async()=>{}});expect(report.accepted).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);expect(local.sqlite.prepare("SELECT raw_value,vote_count FROM source_scores WHERE movie_id='b'").get()).toEqual({raw_value:7.5,vote_count:123});
});
