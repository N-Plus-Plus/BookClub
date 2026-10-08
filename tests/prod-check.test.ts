import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {imageAssets} from '../scripts/assets/manifest.mjs';
import {prepareAssets} from '../scripts/assets/prepare.mjs';
import sharp from 'sharp';
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
    copyFileSync('wrangler.frontend.jsonc',join(root,'wrangler.frontend.jsonc'));
    copyFileSync('vite.config.ts',join(root,'vite.config.ts'));
    const original=JSON.parse(readFileSync('worker/wrangler.jsonc','utf8'));
    const check=(vars:Record<string,string>)=>{writeFileSync(join(root,'worker/wrangler.jsonc'),JSON.stringify({...original,vars:{...original.vars,...vars}}));return ()=>checkProduction(root);};
    expect(check({APP_ENV:'local'})).toThrow('APP_ENV');expect(check({LOCAL_WRITE_BYPASS:'true'})).toThrow('BYPASS');expect(check({ALLOWED_ORIGINS:'http://localhost:5173'})).toThrow('CORS');
    expect(check({})()).toMatchObject({migrationCount:migrations.length});
    for (const origin of ['https://n-plus-plus.github.io','https://bookclub.nissen.nexus','*','https://*.nissen.nexus','http://bookclub.nissen.nexus','http://localhost:4173','https://n-plus-plus.github.io/BookClub/']) {
      expect(check({ALLOWED_ORIGINS:origin})).toThrow('CORS');
    }
    check({})();
    const frontend=JSON.parse(readFileSync('wrangler.frontend.jsonc','utf8'));
    for (const patch of [{name:'wrong'},{workers_dev:true},{assets:{directory:'./public',not_found_handling:'single-page-application'}},{assets:{directory:'./dist'}},{routes:[{pattern:'other.nissen.nexus',custom_domain:true}]},{routes:[{pattern:'bookclub.nissen.nexus',custom_domain:false}]},{d1_databases:[]},{services:[]},{vars:{GOOGLE_CLIENT_ID:'forbidden'}},{main:'worker/src/index.ts'}]) {
      writeFileSync(join(root,'wrangler.frontend.jsonc'),JSON.stringify({...frontend,...patch}));
      expect(()=>checkProduction(root)).toThrow('Frontend');
    }
    rmSync(join(root,'wrangler.frontend.jsonc'));
    expect(()=>checkProduction(root)).toThrow();
    copyFileSync('wrangler.frontend.jsonc',join(root,'wrangler.frontend.jsonc'));
    writeFileSync(join(root,'vite.config.ts'),readFileSync('vite.config.ts','utf8').replace("base: '/'","base: '/BookClub/'"));
    expect(()=>checkProduction(root)).toThrow('Vite');
    copyFileSync('vite.config.ts',join(root,'vite.config.ts'));
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

it('retires every active GitHub Pages publication workflow',()=>{
  expect(existsSync('.github/workflows/pages.yml')).toBe(false);
  if (existsSync('.github/workflows')) for (const file of readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name))) {
    expect(readFileSync(join('.github/workflows',file),'utf8')).not.toMatch(/actions\/(?:deploy-pages|upload-pages-artifact|configure-pages)|gh\s+workflow\s+run\s+pages/);
  }
});
it('builds root asset references with lightweight artwork from clean generated output',async()=>{
  const root=mkdtempSync(join(tmpdir(),'bookclub-build-'));
  const output=join(root,'dist');
  try {
    cpSync('assets/source',join(root,'assets/source'),{recursive:true});
    cpSync('public',join(root,'public'),{recursive:true});
    expect(await prepareAssets({root})).toMatchObject({encoded:32,reused:0});
    execFileSync(process.execPath,['--input-type=module','--eval',"import {build} from 'vite'; await build({publicDir:process.argv[1],build:{outDir:process.argv[2]}});",join(root,'generated/public'),output],{env:{...process.env,NODE_ENV:'production',VITE_API_BASE_URL:'https://fictional-worker.example.invalid',VITE_GOOGLE_CLIENT_ID:'fictional.apps.googleusercontent.com'},stdio:'pipe'});
    const html=readFileSync(join(output,'index.html'),'utf8');
    expect(html).not.toContain('/BookClub/');
    const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match=>match[1]);
    expect(assets.some(path=>path.endsWith('.js'))).toBe(true);
    expect(assets.some(path=>path.endsWith('.css'))).toBe(true);
    for(const asset of assets) expect(existsSync(join(output,asset.slice(1)))).toBe(true);
    expect(readdirSync(join(output,'assets')).some(name=>name.endsWith('.woff2'))).toBe(true);
    for(const asset of imageAssets) {
      const file=join(output,asset.output);
      expect(existsSync(file)).toBe(true);
      const metadata=await sharp(file).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBeLessThanOrEqual(asset.size);
      expect(metadata.height).toBeLessThanOrEqual(asset.size);
      expect(readFileSync(file)).not.toEqual(readFileSync(join('assets/source',asset.source)));
    }
    expect(existsSync(join(output,'assets/source'))).toBe(false);
    for(const removed of ['buttons/closedrawer.png','buttons/dq.png','buttons/next.png','buttons/prev.png','buttons/ranked.png','buttons/resort.png','buttons/unranked.png','favicons','newFav/fav0.png']) expect(existsSync(join(output,removed))).toBe(false);
    for(const avatar of ['a',...Array.from({length:20},(_,i)=>String(i))]) expect(existsSync(join(output,'avatars',`${avatar}.png`))).toBe(true);
    for(const file of readdirSync(join(output,'assets')).filter(name=>/\.(js|css)$/.test(name))) expect(readFileSync(join(output,'assets',file),'utf8')).not.toContain('/BookClub/');
  } finally {rmSync(root,{recursive:true,force:true});}
},30000);
