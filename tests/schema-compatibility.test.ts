import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { ProductRepository } from '../worker/src/product-repository';
import { hashToken } from '../worker/src/auth';
import worker from '../worker/src/index';
import type { Env } from '../worker/src/http';
import type { ProviderMovie } from '../worker/src/providers/types';
const old = '0009_tmdb_artwork_checked.sql';
const actor = {id:'member-1',display_name:'Member 1',sort_order:1,role:'admin' as const,avatar:null};
const metadata:ProviderMovie = {title:'Film',original_title:null,year:2000,release_date:null,runtime:100,overview:null,director:'Director',genres:['Drama'],assets:[],external_ids:[{provider:'tmdb',external_id:'42'}],scores:[],fetched_at:'2026-10-05T00:00:00Z'};
it.each([old,undefined])('reads/auth/events and metadata work with schema %s',async migration=>{
 const local=disposableD1(migration);
 try {
  local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'; INSERT INTO member_auth(member_id,authorized_email,google_sub) VALUES('member-1','fixture@example.invalid','fixture-sub')");
  local.sqlite.prepare('INSERT INTO auth_sessions(token_hash,member_id,created_at,expires_at) VALUES(?,?,?,?)').run(await hashToken('a'.repeat(64)),'member-1','2026-01-01','2200-01-01');
  const env:Env={DB:local.db,APP_ENV:'production',LOCAL_WRITE_BYPASS:'false',ALLOWED_ORIGINS:'https://n-plus-plus.github.io'};
  for(const path of ['/auth/me','/catalog','/movies/moon','/rotation','/sessions','/classics']) {
   const response=await worker.fetch(new Request('https://api/api/v1'+path,{headers:{Authorization:'Bearer '+ 'a'.repeat(64)}}),env);
   expect(response.status,path).toBe(200);
  }
  const repo=new Repository(local.db),product=new ProductRepository(local.db);
  expect((await product.rotation())!.human_order).toEqual({});
  expect((await repo.catalog()).movies.every(movie=>movie.director===null)).toBe(true);
  expect(await repo.metadataCounts()).toHaveProperty('remaining');
  await repo.metadataCandidates(10);
  const id=await repo.importMovie(metadata);
  await repo.enrichMetadata(id,'42',{...metadata,director:'Changed'});
  local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'imdb','tt0000042');
  await repo.enrichOmdbMetadata(id,'tt0000042',{year:2001,runtime:101,director:'OMDb Director',genres:['Drama']});
  expect((await repo.catalog()).movies.find(movie=>movie.id===id)!.director).toBe(migration ? null : 'OMDb Director');
  local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');
  const turn=(await product.rotation())!;
  const session=await product.saveSession({event_date:'2030-01-01',cycle_slot:1,cycle_id:null,complete_turn:true,turn_version:turn.version,movie_ids:['moon']},actor);
  expect((await repo.catalog()).sessions.find(s=>s.id===session)!.host_member_id).toBe('member-1');
  expect((await product.rotation())!.nominal_slot).toBe(2);
  if(migration) {
   await expect(product.saveSession({event_date:'2030-01-02',cycle_slot:3,cycle_id:null,movie_ids:['moon']},actor)).rejects.toMatchObject({status:503,code:'SCHEMA_UPGRADE_REQUIRED'});
   const before=local.sqlite.prepare('SELECT total_changes() n').get()!.n;
   await expect(product.swapRotation(actor,{target_member_id:'member-3',version:(await product.rotation())!.version})).rejects.toMatchObject({status:503,code:'SCHEMA_UPGRADE_REQUIRED'});
   expect(local.sqlite.prepare('SELECT total_changes() n').get()!.n).toBe(before);
  } else {
   const version=(await product.rotation())!.version;
   await product.swapRotation(actor,{target_member_id:'member-3',version});
   expect((await product.rotation())!.human_order).toEqual({'2':'member-3','3':'member-2'});
   await expect(product.swapRotation(actor,{target_member_id:'member-4',version})).rejects.toMatchObject({status:409});
  }
 } finally {local.sqlite.close();}
});
it('fresh request repositories discover capabilities after ordered migrations without a global cache',async()=>{
 const local=disposableD1(old);
 try {
  local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  await new Repository(local.db).catalog();
  for(const name of readdirSync('worker/migrations').filter(name=>name.endsWith('.sql')&&name>old).sort())local.sqlite.exec(readFileSync('worker/migrations/'+name,'utf8'));
  local.sqlite.exec("UPDATE movies SET director='After migration' WHERE id='moon'");
  expect((await new Repository(local.db).catalog()).movies.find(movie=>movie.id==='moon')!.director).toBe('After migration');
 } finally {local.sqlite.close();}
});
