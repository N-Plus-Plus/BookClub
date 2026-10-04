import { describe,it,expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { copySnapshot, restoreExport, sanitise, sourceIdentity, validateConfig, validateIdentity, verifyForeignKeys } from '../scripts/dev/snapshot.ts';
import { allowedRefreshRequest } from '../scripts/dev/request-policy.ts';
import { authenticate } from '../worker/src/auth';
import type { Env } from '../worker/src/http';

const config = JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
function database() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('worker/migrations').sort()) db.exec(readFileSync(`worker/migrations/${file}`,'utf8'));
  return db;
}
describe('production to local refresh safety',() => {
  it('locks source and destination to exact identities, refusing remote binding',() => {
    validateConfig(config); validateIdentity({uuid:sourceIdentity.database_id,name:sourceIdentity.database_name});
    for (const mutate of [(c:any) => c.d1_databases[0].database_id='wrong',(c:any) => c.d1_databases[0].database_name='other',(c:any) => c.env.local.d1_databases[0].database_id=sourceIdentity.database_id,(c:any) => c.env.local.d1_databases[0].remote=true,(c:any) => c.env.local.vars.APP_ENV='production',(c:any) => c.env.local.vars.LOCAL_WRITE_BYPASS='false']) {
      const candidate = structuredClone(config); mutate(candidate); expect(() => validateConfig(candidate)).toThrow();
    }
    expect(() => validateIdentity({uuid:sourceIdentity.database_id,name:'other'})).toThrow();
  });
  it('copies durable state, preserves completed publication metadata and rotation without replaying triggers',() => {
    const source = database(), target = database();
    try {
      source.exec("INSERT INTO members(id,display_name,sort_order,role,avatar) VALUES('m','Fixture',1,'admin',3); INSERT INTO member_auth(member_id,authorized_email,google_sub,bound_at,last_login_at) VALUES('m','private@example.com','private-sub','now','now'); INSERT INTO auth_sessions VALUES('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','m','now','later'); INSERT INTO provider_cooldowns VALUES('tmdb','later','now'); INSERT INTO movies(id,title) VALUES('film','Fixture'); INSERT INTO cycles(id,ordinal,rough_date) VALUES('cycle',1,'2026-01-01'); INSERT INTO club_rotation(id,nominal_slot,version) VALUES(1,1,0); INSERT INTO builder_sets(id,owner_member_id) VALUES('saved','m'); INSERT INTO builder_movies VALUES('saved','film',1);");
      source.exec("INSERT INTO sessions(id,event_date,cycle_id,cycle_slot,kind,date_precision,host_member_id,completed_turn_version) VALUES('event','2026-01-01','cycle',1,'hosted','exact','m',0); INSERT INTO session_movies VALUES('event','film',1); INSERT INTO classics(movie_id) VALUES('film'); INSERT INTO seen_states(movie_id,member_id,seen) VALUES('film','m',1);");
      source.exec("INSERT INTO builder_sets(id,owner_member_id) VALUES('published','m'); INSERT INTO sessions(id,event_date,kind,date_precision,host_member_id,builder_id,builder_revision,published_by,planned_at) SELECT 'published-event','2026-01-02','hosted','exact','m',id,revision,owner_member_id,created_at FROM builder_sets WHERE id='published'");
      const result = copySnapshot(source,target);
      expect(result.authSessions).toBe(0);
      expect(target.prepare('SELECT * FROM provider_cooldowns').all()).toEqual([]);
      expect(target.prepare('SELECT authorized_email,google_sub,bound_at,last_login_at FROM member_auth').get()).toEqual({authorized_email:'m@bookclub.invalid',google_sub:null,bound_at:null,last_login_at:null});
      for (const table of ['members','movies','cycles','sessions','session_movies','builder_sets','builder_movies','classics','seen_states','club_rotation']) expect(target.prepare(`SELECT * FROM ${table}`).all()).toEqual(source.prepare(`SELECT * FROM ${table}`).all());
      expect(result.rotation).toEqual(source.prepare('SELECT * FROM club_rotation').get());
      expect(target.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger'").get()).toEqual(source.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger'").get());
      expect(target.prepare("SELECT name FROM seed_runs").all()).toEqual([{name:'demo-v1'}]);
    } finally {source.close(); target.close();}
  });
  it('rejects FK corruption and incompatible schemas before local replacement',() => {
    const source = database(), target = database();
    try {
      source.exec("PRAGMA foreign_keys=OFF; INSERT INTO session_movies VALUES('missing','missing',1)");
      expect(() => verifyForeignKeys(source)).toThrow(/foreign key/);
      expect(() => copySnapshot(source,target)).toThrow();
      source.exec('DELETE FROM session_movies; CREATE TABLE unreviewed(id TEXT)');
      expect(() => copySnapshot(source,target)).toThrow(/tables differ/);
    } finally {source.close();target.close();}
  });
  it('restores out-of-order D1 SQL exports but rejects dangling references',() => {
    const db = new DatabaseSync(':memory:');
    try {
      restoreExport(db,"CREATE TABLE child(parent_id TEXT REFERENCES parent(id)); INSERT INTO child VALUES('p'); CREATE TABLE parent(id TEXT PRIMARY KEY); INSERT INTO parent VALUES('p');");
      expect(db.prepare('SELECT * FROM child').all()).toEqual([{parent_id:'p'}]);
      expect(() => restoreExport(db,"INSERT INTO child VALUES('missing');")).toThrow(/foreign key/);
    } finally {db.close();}
  });
  it('refuses non-local frontend requests and requires deliberate confirmation',() => {
    expect(allowedRefreshRequest('POST','localhost:4173','http://localhost:4173','replace-local-only')).toBe(true);
    expect(allowedRefreshRequest('POST','localhost:5173','http://localhost:5173','replace-local-only')).toBe(false);
    expect(allowedRefreshRequest('POST','localhost:4173','https://n-plus-plus.github.io','replace-local-only')).toBe(false);
    expect(allowedRefreshRequest('POST','evil.example','http://localhost:4173','replace-local-only')).toBe(false);
    expect(allowedRefreshRequest('GET','localhost:4173','http://localhost:4173','replace-local-only')).toBe(false);
    expect(allowedRefreshRequest('POST','localhost:4173','http://localhost:4173',undefined)).toBe(false);
    expect(sanitise('auth_sessions',{token_hash:'secret'})).toBeNull();
  });
  it('keeps the helper and operator tooling outside the Worker/frontend production boundary',() => {
    const app = readFileSync('frontend/App.tsx','utf8');
    expect(app).toContain("import.meta.env.DEV && import.meta.env.MODE !== 'import-preview' ? lazy(() => import('./DevTools')) : null");
    expect(readFileSync('worker/src/index.ts','utf8')).not.toContain('/__dev/refresh');
    for (const file of readdirSync('frontend').filter(f => /\.(tsx?|css)$/.test(f))) {
      const contents = readFileSync(`frontend/${file}`,'utf8');
      expect(contents).not.toMatch(/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|scripts\/dev\/refresh|production-remote/);
    }
  });
  it('developer identity works only with both local gates',async () => {
    const request = new Request('http://localhost:8787/api/v1/auth/me',{headers:{'X-BookClub-Dev-Member':'m'}});
    const env = {APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',DB:{prepare:() => ({bind:() => ({first:async () => ({id:'m',role:'admin'})})})}} as unknown as Env;
    expect((await authenticate(request,env)).viewer?.id).toBe('m');
    await expect(authenticate(request,{...env,APP_ENV:'production'})).rejects.toThrow(/Sign in/);
    await expect(authenticate(request,{...env,LOCAL_WRITE_BYPASS:'false'})).rejects.toThrow(/Sign in/);
  });
});
