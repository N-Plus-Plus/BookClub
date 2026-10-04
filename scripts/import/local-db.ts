import { createRequire } from 'node:module';
import { resolve, relative, isAbsolute } from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { ImportError } from './io.ts';
// Use Wrangler's installed local D1 emulator, not another database implementation.
// This has no account, HTTP API, or remote execution capability.
export async function openPreviewDb(testPersistence?:string) {
  const config=JSON.parse(await readFile('worker/wrangler.import-preview.jsonc','utf8'));
  const env=config.env?.import_preview, databases=env?.d1_databases;
  if(config.d1_databases||env?.vars?.APP_ENV!=='local'||env?.vars?.LOCAL_WRITE_BYPASS!=='true'||databases?.length!==1||databases[0].binding!=='DB'||databases[0].database_name!=='bookclub-import-preview'||databases[0].database_id!=='00000000-0000-0000-0000-000000000002') throw new ImportError('Unsafe preview configuration; only the isolated local import-preview identity is allowed.');
  const project=await realpath('.'), persistence=resolve(project,testPersistence??'worker/.wrangler/import-preview','v3');
  if(testPersistence){const rel=relative(resolve(project,'.verification'),persistence);if(rel.startsWith('..')||isAbsolute(rel))throw new ImportError('Synthetic preview persistence must stay inside .verification.');}
  // Existing junctions must not redirect private database state elsewhere.
  let ancestor=persistence;
  while(true){try{if(await realpath(ancestor)!==ancestor)throw new ImportError('Preview persistence must not use symlinks/junctions.');break;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const parent=resolve(ancestor,'..');if(parent===ancestor)throw e;ancestor=parent;}}
  const require=createRequire(import.meta.url), wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
  const emulator=wranglerRequire('miniflare') as {Miniflare:new(options:unknown)=>{getD1Database(name:string):Promise<D1Database>;dispose():Promise<void>};convertV4MiniflareOptions:(options:unknown)=>unknown;NoOpLog:new()=>unknown};
  const mf=new emulator.Miniflare(emulator.convertV4MiniflareOptions({modules:true,script:'',resourcePersistencePath:persistence,d1Databases:{DATABASE:databases[0].database_id},log:new emulator.NoOpLog()}));
  try{return {db:await mf.getD1Database('DATABASE'),close:()=>mf.dispose()};}catch{await mf.dispose();throw new ImportError('Local preview D1 emulator unavailable.');}
}
