import { afterEach, expect, it, vi } from 'vitest';
import type { UserConfigFnObject } from 'vite';
import config from '../vite.config';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

afterEach(() => vi.unstubAllEnvs());
it('owns local development mode, root base and IPv4 port 4173 even under a production parent',() => {
  vi.stubEnv('NODE_ENV','production');
  const local = (config as UserConfigFnObject)({command:'serve',mode:'development',isPreview:false});
  expect(process.env.NODE_ENV).toBe('development');
  expect(local.server).toMatchObject({host:'127.0.0.1',port:4173,strictPort:true});
  expect(local.base).toBe('/');
  expect(local.define?.['import.meta.env.VITE_API_BASE_URL']).toBe('"http://localhost:8787"');
  const worker = JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
  expect(worker.env.local.vars).toMatchObject({APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'});
  const preview = (config as UserConfigFnObject)({command:'serve',mode:'import-preview',isPreview:false});
  expect(preview.base).toBe('/');
  expect(preview.server?.proxy).toBeUndefined();
  expect(preview.define).toEqual(local.define);
  expect(JSON.parse(readFileSync('worker/wrangler.import-preview.jsonc','utf8')).env.import_preview.vars.ALLOWED_ORIGINS).toBe('http://localhost:4173');
});
it('preserves the production root base and public build configuration',() => {
  vi.stubEnv('NODE_ENV','production');
  const production = (config as UserConfigFnObject)({command:'build',mode:'production',isPreview:false});
  expect(production.base).toBe('/');
  expect((config as UserConfigFnObject)({command:'serve',mode:'production',isPreview:true}).base).toBe('/');
  expect(production.define).toBeUndefined();
  expect(process.env.NODE_ENV).toBe('production');
});
it('ordinary startup seed leaves a refreshed snapshot unchanged',() => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of readdirSync('worker/migrations').sort()) db.exec(readFileSync(`worker/migrations/${file}`,'utf8'));
    db.exec("INSERT INTO members(id,display_name,sort_order,role,avatar) VALUES('snapshot-member','Snapshot',1,'admin',2); INSERT INTO movies(id,title) VALUES('snapshot-film','Current snapshot'); INSERT INTO club_rotation(id,nominal_slot,version) VALUES(1,1,42); INSERT INTO seed_runs(name) VALUES('demo-v1');");
    const before = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name}) => [name,db.prepare(`SELECT * FROM ${name}`).all()]);
    db.exec(readFileSync('worker/seed.sql','utf8'));
    for (const [name,rows] of before) expect(db.prepare(`SELECT * FROM ${name}`).all()).toEqual(rows);
  } finally {db.close();}
});
