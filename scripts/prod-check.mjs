import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Static tracked configuration only. No Cloudflare, credentials or private files. */
export function checkProduction(root = process.cwd(), publicEnv = process.env, frontend = false) {
  const config = JSON.parse(readFileSync(resolve(root,'worker/wrangler.jsonc'),'utf8'));
  const fail = message => { throw new Error(message); };
  if (config.vars?.APP_ENV !== 'production' || config.vars?.LOCAL_WRITE_BYPASS !== 'false') fail('Production must use APP_ENV=production and LOCAL_WRITE_BYPASS=false.');
  const origins = config.vars?.ALLOWED_ORIGINS?.split(',').map(v=>v.trim()) ?? [];
  if (!origins.includes('https://n-plus-plus.github.io') || origins.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin || ['localhost','127.0.0.1','[::1]'].includes(url.hostname); }
    catch { return true; }
  })) fail('Production CORS must contain the exact Pages HTTPS origin and no local origins.');
  const db = config.d1_databases?.find(d=>d.binding==='DB');
  if (!db?.database_id || db.database_name !== 'bookclub-prod' || db.migrations_dir !== 'migrations') fail('Production DB binding or migrations path is missing or incorrect.');
  const migrations = readdirSync(resolve(root,'worker/migrations')).filter(n=>n.endsWith('.sql')).sort();
  if (migrations.length < 6 || migrations.some((name,i)=>!name.startsWith(`${String(i+1).padStart(4,'0')}_`))) fail('Migrations must be contiguous from 0001 through at least 0006.');
  const preview = JSON.parse(readFileSync(resolve(root,'worker/wrangler.import-preview.jsonc'),'utf8'));
  const local = preview.env?.import_preview;
  if (preview.d1_databases?.length || local?.vars?.APP_ENV !== 'local' || local.vars.LOCAL_WRITE_BYPASS !== 'true' || local.d1_databases?.some(d=>d.database_id===db.database_id)) fail('Import preview must remain isolated and local.');
  if (frontend) {
    try {
      const url = new URL(publicEnv.VITE_API_BASE_URL);
      if (url.protocol !== 'https:' || url.origin !== publicEnv.VITE_API_BASE_URL || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) fail('invalid');
    } catch { fail('Set VITE_API_BASE_URL to a production HTTPS Worker origin without a path or trailing slash.'); }
    if (!publicEnv.VITE_GOOGLE_CLIENT_ID?.trim().endsWith('.apps.googleusercontent.com')) fail('Set the public VITE_GOOGLE_CLIENT_ID to a Google Web Application client ID.');
  }
  return {migrationCount:migrations.length,frontend};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result=checkProduction(process.cwd(),process.env,process.argv.includes('--frontend'));
    console.log(`Static production checks passed (${result.migrationCount} migrations${result.frontend ? ', public frontend variables checked' : ''}). Remote bindings, secrets, GIS and live data are unverified. Run pnpm build separately.`);
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
