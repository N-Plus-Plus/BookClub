import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Static tracked configuration only. No Cloudflare, credentials or private files. */
export function checkProduction(root = process.cwd(), publicEnv = process.env, frontend = false) {
  const config = JSON.parse(readFileSync(resolve(root,'worker/wrangler.jsonc'),'utf8'));
  const fail = message => { throw new Error(message); };
  if (config.vars?.APP_ENV !== 'production' || config.vars?.LOCAL_WRITE_BYPASS !== 'false') fail('Production must use APP_ENV=production and LOCAL_WRITE_BYPASS=false.');
  const origins = config.vars?.ALLOWED_ORIGINS?.split(',').map(v=>v.trim()) ?? [];
  if (origins.length !== 2 || !['https://n-plus-plus.github.io','https://bookclub.nissen.nexus'].every(origin=>origins.includes(origin)) || origins.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin || ['localhost','127.0.0.1','[::1]'].includes(url.hostname); }
    catch { return true; }
  })) fail('Production CORS must contain exactly both cutover HTTPS origins and no local, insecure or wildcard origins.');
  const db = config.d1_databases?.find(d=>d.binding==='DB');
  if (db?.database_id !== 'df848632-a192-4c64-9bfb-25c59d3aa631' || db.database_name !== 'bookclub-prod' || db.migrations_dir !== 'migrations') fail('Production DB binding or migrations path is missing or incorrect.');
  const staticConfig = JSON.parse(readFileSync(resolve(root,'wrangler.frontend.jsonc'),'utf8'));
  if (staticConfig.name !== 'bookclub-frontend' || staticConfig.workers_dev !== false || staticConfig.preview_urls !== false) fail('Frontend Worker name or public surfaces are incorrect.');
  if (typeof staticConfig.assets?.directory !== 'string' || resolve(root,staticConfig.assets.directory) !== resolve(root,'dist') || staticConfig.assets.not_found_handling !== 'single-page-application') fail('Frontend assets must resolve to dist with SPA fallback.');
  if (staticConfig.routes?.length !== 1 || staticConfig.routes[0].pattern !== 'bookclub.nissen.nexus' || staticConfig.routes[0].custom_domain !== true) fail('Frontend Custom Domain must be exactly bookclub.nissen.nexus.');
  // An allow-list prevents runtime code, bindings, secrets and environment overrides.
  const staticKeys = ['$schema','name','compatibility_date','workers_dev','preview_urls','assets','routes'];
  if (Object.keys(staticConfig).some(key=>!staticKeys.includes(key)) || Object.keys(staticConfig.assets).some(key=>!['directory','not_found_handling'].includes(key))) fail('Frontend must be assets-only without runtime or provider bindings.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(staticConfig.compatibility_date ?? '')) fail('Frontend compatibility_date is required.');
  if (!/^\s*base:\s*['"]\/['"]\s*,\s*$/m.test(readFileSync(resolve(root,'vite.config.ts'),'utf8'))) fail('Vite production and preview base must be / .');
  if (config.env?.local?.vars?.ALLOWED_ORIGINS !== 'http://localhost:4173') fail('Local CORS must remain localhost only.');
  const migrations = readdirSync(resolve(root,'worker/migrations')).filter(n=>n.endsWith('.sql')).sort();
  if (migrations.length < 8 || migrations.some((name,i)=>!name.startsWith(`${String(i+1).padStart(4,'0')}_`))) fail('Migrations must be contiguous from 0001 through at least 0008.');
  const preview = JSON.parse(readFileSync(resolve(root,'worker/wrangler.import-preview.jsonc'),'utf8'));
  const local = preview.env?.import_preview;
  if (preview.d1_databases?.length || local?.vars?.APP_ENV !== 'local' || local.vars.LOCAL_WRITE_BYPASS !== 'true' || local.d1_databases?.some(d=>d.database_id===db.database_id)) fail('Import preview must remain isolated and local.');
  if (frontend) {
    try {
      const url = new URL(publicEnv.VITE_API_BASE_URL);
      if (url.protocol !== 'https:' || url.origin !== publicEnv.VITE_API_BASE_URL || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) fail('invalid');
    } catch { fail('Set VITE_API_BASE_URL to a production HTTPS Worker origin without a path or trailing slash.'); }
    if (! /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(publicEnv.VITE_GOOGLE_CLIENT_ID ?? '')) fail('Set the public VITE_GOOGLE_CLIENT_ID to a Google Web Application client ID.');
  }
  return {migrationCount:migrations.length,frontend};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result=checkProduction(process.cwd(),process.env,process.argv.includes('--frontend'));
    console.log(`Static production checks passed (${result.migrationCount} migrations${result.frontend ? ', public frontend variables checked' : ''}). Remote bindings, secrets, GIS and live data are unverified. Run pnpm build separately.`);
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
