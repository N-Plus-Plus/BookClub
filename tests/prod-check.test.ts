import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { checkProduction } from '../scripts/prod-check.mjs';
it('checks tracked release safety and public variables without remote access',()=>{
  expect(checkProduction().migrationCount).toBe(6);
  const publicEnv={VITE_API_BASE_URL:'https://fictional-worker.example.invalid',VITE_GOOGLE_CLIENT_ID:'fictional.apps.googleusercontent.com'};
  expect(checkProduction(undefined,publicEnv,true).frontend).toBe(true);
  expect(()=>checkProduction(undefined,{},true)).toThrow('VITE_API_BASE_URL');
  expect(()=>checkProduction(undefined,{...publicEnv,VITE_API_BASE_URL:'http://localhost:8787'},true)).toThrow('HTTPS Worker');
  expect(()=>checkProduction(undefined,{...publicEnv,VITE_GOOGLE_CLIENT_ID:''},true)).toThrow('VITE_GOOGLE_CLIENT_ID');
  const root=mkdtempSync(join(tmpdir(),'bookclub-prod-check-'));
  try {
    mkdirSync(join(root,'worker/migrations'),{recursive:true});
    for(const name of readdirSync('worker/migrations')) copyFileSync(`worker/migrations/${name}`,join(root,'worker/migrations',name));
    copyFileSync('worker/wrangler.import-preview.jsonc',join(root,'worker/wrangler.import-preview.jsonc'));
    const original=JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
    const check=(vars:Record<string,string>)=>{writeFileSync(join(root,'worker/wrangler.jsonc'),JSON.stringify({...original,vars:{...original.vars,...vars}}));return ()=>checkProduction(root);};
    expect(check({APP_ENV:'local'})).toThrow('APP_ENV');expect(check({LOCAL_WRITE_BYPASS:'true'})).toThrow('BYPASS');expect(check({ALLOWED_ORIGINS:'http://localhost:5173'})).toThrow('CORS');
    expect(check({})()).toMatchObject({migrationCount:6});rmSync(join(root,'worker/migrations/0006_history_integrity.sql'));
    expect(()=>checkProduction(root)).toThrow('contiguous');
  } finally {rmSync(root,{recursive:true,force:true});}
});
