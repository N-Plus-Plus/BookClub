import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { checkProduction } from '../scripts/prod-check.mjs';
it('checks working-tree release safety and public variables without remote access',()=>{
  const migrations=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','--','worker/migrations/*.sql'],{encoding:'utf8'}).trim().split(/\r?\n/).map(path=>path.split('/').at(-1)!).sort();
  expect(migrations.length).toBeGreaterThanOrEqual(8);
  expect(readdirSync('worker/migrations').filter(name=>name.endsWith('.sql')).sort()).toEqual(migrations);
  expect(migrations.every(name=>/^\d{4}_.+\.sql$/.test(name))).toBe(true);
  const sequence=migrations.map(name=>Number(name.slice(0,4)));
  expect(new Set(sequence).size).toBe(migrations.length);
  expect(sequence).toEqual(migrations.map((_,i)=>i+1));
  expect(checkProduction().migrationCount).toBe(migrations.length);
  const publicEnv={VITE_API_BASE_URL:'https://fictional-worker.example.invalid',VITE_GOOGLE_CLIENT_ID:'fictional.apps.googleusercontent.com'};
  expect(checkProduction(undefined,publicEnv,true).frontend).toBe(true);
  expect(()=>checkProduction(undefined,{},true)).toThrow('VITE_API_BASE_URL');
  expect(()=>checkProduction(undefined,{...publicEnv,VITE_API_BASE_URL:'http://localhost:8787'},true)).toThrow('HTTPS Worker');
  expect(()=>checkProduction(undefined,{...publicEnv,VITE_GOOGLE_CLIENT_ID:''},true)).toThrow('VITE_GOOGLE_CLIENT_ID');
  const root=mkdtempSync(join(tmpdir(),'bookclub-prod-check-'));
  try {
    mkdirSync(join(root,'worker/migrations'),{recursive:true});
    for(const name of migrations) copyFileSync(`worker/migrations/${name}`,join(root,'worker/migrations',name));
    copyFileSync('worker/wrangler.import-preview.jsonc',join(root,'worker/wrangler.import-preview.jsonc'));
    const original=JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
    const check=(vars:Record<string,string>)=>{writeFileSync(join(root,'worker/wrangler.jsonc'),JSON.stringify({...original,vars:{...original.vars,...vars}}));return ()=>checkProduction(root);};
    expect(check({APP_ENV:'local'})).toThrow('APP_ENV');expect(check({LOCAL_WRITE_BYPASS:'true'})).toThrow('BYPASS');expect(check({ALLOWED_ORIGINS:'http://localhost:5173'})).toThrow('CORS');
    expect(check({})()).toMatchObject({migrationCount:migrations.length});
    const missing=migrations[1];
    rmSync(join(root,'worker/migrations',missing));
    expect(()=>checkProduction(root)).toThrow('contiguous');
    copyFileSync(`worker/migrations/${missing}`,join(root,'worker/migrations',missing));
    for(const invalid of ['0001_duplicate.sql','invalid_number.sql']) {
      writeFileSync(join(root,'worker/migrations',invalid),'-- invalid migration numbering\n');
      expect(()=>checkProduction(root)).toThrow('contiguous');
      rmSync(join(root,'worker/migrations',invalid));
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});
