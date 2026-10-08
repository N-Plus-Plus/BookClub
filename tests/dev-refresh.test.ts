import { applicationCss } from './helpers/application-css';
import { describe,it,expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { copySnapshot, maintenanceSchemas, restoreExport, safeSnapshotError, sanitise, sourceIdentity, validateConfig, validateIdentity, verifyForeignKeys } from '../scripts/dev/snapshot.ts';
import { allowedRefreshRequest } from '../scripts/dev/request-policy.ts';
import { authenticate } from '../worker/src/auth';
import type { Env } from '../worker/src/http';

const config = JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
function database(lastMigration = '0012') {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('worker/migrations').filter(file => file.slice(0,4) <= lastMigration).sort()) db.exec(readFileSync(`worker/migrations/${file}`,'utf8'));
  return db;
}
describe('production to local refresh safety',() => {
  it('copies the reviewed 0009 schema into 0012, retiring event text and retaining migration defaults',() => {
    const source = database('0009'), target = database('0012');
    try {
      source.exec("INSERT INTO members(id,display_name,sort_order) VALUES('m','Fixture',1); INSERT INTO movies(id,title) VALUES('film','Film title'); INSERT INTO club_rotation(id,nominal_slot,version) VALUES(1,1,7); INSERT INTO sessions(id,event_date,kind,date_precision,host_member_id,title,notes,swap_note) VALUES('event','2026-01-01','hosted','exact','m','Retired title','Retired notes','Retired swap'); INSERT INTO session_movies VALUES('event','film',1)");
      const changes = {before:{title:'Old',notes:null,swap_note:'Old swap',eventDate:'2025-12-31',movies:[{title:'Film title'}]},after:{title:'New',notes:'New notes',swap_note:null,eventDate:'2026-01-01'},reason:'preserved'};
      source.prepare("INSERT INTO history_audit(id,session_id,actor_member_id,action,changes_json) VALUES('audit','event','m','edit',?)").run(JSON.stringify(changes));
      const untouched = '{"after":{"eventDate":"2026-01-01"}}';
      source.prepare("INSERT INTO history_audit(id,session_id,actor_member_id,action,changes_json) VALUES('untouched','event','m','edit',?)").run(untouched);
      copySnapshot(source,target);
      const event = target.prepare('SELECT * FROM sessions').get()!;
      expect(event.id).toBe('event');
      for (const column of ['title','notes','swap_note']) expect(event).not.toHaveProperty(column);
      expect(target.prepare('SELECT * FROM session_movies').all()).toEqual(source.prepare('SELECT * FROM session_movies').all());
      expect(target.prepare('SELECT title,director FROM movies').get()).toEqual({title:'Film title',director:null});
      expect(target.prepare('SELECT human_order,version FROM club_rotation').get()).toEqual({human_order:'{}',version:7});
      expect(JSON.parse(String(target.prepare("SELECT changes_json FROM history_audit WHERE id='audit'").get()!.changes_json))).toEqual({before:{eventDate:'2025-12-31',movies:[{title:'Film title'}]},after:{eventDate:'2026-01-01'},reason:'preserved'});
      expect(target.prepare("SELECT changes_json FROM history_audit WHERE id='untouched'").get()!.changes_json).toBe(untouched);
      expect(source.prepare("SELECT changes_json FROM history_audit WHERE id='audit'").get()!.changes_json).toBe(JSON.stringify(changes));
      verifyForeignKeys(target);
    } finally {source.close();target.close();}
  });
  it('rejects unreviewed source columns even alongside retired columns and rolls back the destination',() => {
    for (const [table,column] of [['sessions','unexpected'],['movies','notes']]) {
      const source = database('0009'), target = database('0012');
      try {
        source.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
        target.exec("INSERT INTO movies(id,title,director) VALUES('existing','Keep me','Existing director')");
        const triggers = target.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
        expect(() => copySnapshot(source,target)).toThrow(`Source columns incompatible: ${table}.`);
        expect(target.prepare('SELECT id,title,director FROM movies').all()).toEqual([{id:'existing',title:'Keep me',director:'Existing director'}]);
        expect(target.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all()).toEqual(triggers);
        expect(target.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(1);
      } finally {source.close();target.close();}
    }
  });
  it('preserves reviewed production maintenance journals and receipts outside the migration ledger',() => {
    const source = database('0009'), target = database();
    try {
      for (const sql of Object.values(maintenanceSchemas)) source.exec(sql);
      source.exec("INSERT INTO movies(id,title) VALUES('survivor','Fixture'); INSERT INTO movie_identity_operations(operation_key,manifest_hash,sql_hash) VALUES('operation','manifest-hash','sql-hash'); INSERT INTO movie_identity_merge_receipts(source_movie_id,survivor_movie_id,tmdb_id,operation_hash,snapshot_json) VALUES('removed','survivor','123','operation-hash','{\"movies\":[]}'); INSERT INTO movie_identity_removal_receipts(source_movie_id,operation_hash,snapshot_json) VALUES('deleted','operation-hash','{}')");
      const result = copySnapshot(source,target);
      for (const table of Object.keys(maintenanceSchemas)) {
        expect(target.prepare(`SELECT * FROM ${table}`).all()).toEqual(source.prepare(`SELECT * FROM ${table}`).all());
        expect(result.localCounts[table]).toBe(1);
      }
      verifyForeignKeys(target);
    } finally {source.close();target.close();}
  });
  it('rejects drift in reviewed maintenance tables and rolls back their creation',() => {
    for (const table of Object.keys(maintenanceSchemas)) {
      const source = database(), target = database();
      try {
        source.exec(maintenanceSchemas[table]);
        source.exec(`ALTER TABLE ${table} ADD COLUMN unexpected TEXT`);
        target.exec("INSERT INTO movies(id,title) VALUES('existing','Keep me')");
        expect(() => copySnapshot(source,target)).toThrow(`Source columns incompatible: ${table}.`);
        expect(target.prepare("SELECT name FROM sqlite_master WHERE name=?").get(table)).toBeUndefined();
        expect(target.prepare('SELECT id FROM movies').all()).toEqual([{id:'existing'}]);
      } finally {source.close();target.close();}
    }
  });
  it('reports restore and copy operations while suppressing private error details',() => {
    const source = database(), target = database();
    try {
      expect(safeSnapshotError(new Error('CHECK constraint failed: private row text'))).toBe('CHECK constraint failed');
      expect(safeSnapshotError(new Error('private SQL or credentials'))).toBe('details suppressed');
      expect(() => restoreExport(source,"SELECT nonexistent('private value')")).toThrow(/restoreExport \/ execute exported SQL: ERR_SQLITE_ERROR/);
      source.exec("INSERT INTO members(id,display_name) VALUES('M','Fixture one'),('m','Fixture two'); INSERT INTO member_auth(member_id,authorized_email) VALUES('M','one@example.invalid'),('m','two@example.invalid')");
      expect(() => copySnapshot(source,target)).toThrow('copySnapshot / destination table member_auth / insert sanitised rows: UNIQUE constraint failed');
      expect(target.prepare('SELECT * FROM members').all()).toEqual([]);
    } finally {source.close();target.close();}
  });
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
    expect(app).toContain("const localLogin = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview'");
    expect(app).toContain("localLogin && health?.environment === 'local' && !health.authenticationRequired");
    expect(app).toContain('isAdminPage && DevTools && localDevelopment && catalog');
    expect(app).toContain('onChanged={load}');
    expect(app).toContain('demo={Boolean(health?.demo)} localDevelopment={localDevelopment}');
    expect(readFileSync('frontend/AppShell.tsx','utf8')).toContain('localDevelopment && demo');
    const css = applicationCss();
    expect(css).toContain('.app-layout { position: relative;');
    expect(css).toMatch(/\.demo-label \{ position: absolute;[^}]*top: \.5rem;[^}]*left: \.5rem;[^}]*color: var\(--straw\);[^}]*margin: 0;/);
    expect(css).toContain('--straw: var(--sunflower)');
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
