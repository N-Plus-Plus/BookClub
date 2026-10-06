import { DatabaseSync } from 'node:sqlite';
import { open, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { configuration, activeState, guardedPath, portOpen } from './local-context.ts';
import { repairSql } from './repair-singin.ts';

let stage='arguments';
async function main() {
  const {values}=parseArgs({options:{apply:{type:'boolean'}},strict:true});
  stage='local configuration';await configuration();
  stage='stopped local API guard';
  if(await portOpen()) throw Error('Stop the local API before repair.');
  const lockPath=resolve('worker/.wrangler/dev-refresh.lock');await guardedPath(lockPath);
  stage='maintenance lock';const lock=await open(lockPath,'wx');
  try {
    const directory=resolve(activeState,'miniflare-D1DatabaseObject');await guardedPath(directory);
    const files=(await readdir(directory)).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');
    if(files.length!==1)throw Error('Expected exactly one local D1 database.');
    const path=resolve(directory,files[0]);await guardedPath(path);
    stage='snapshot preflight';const sqlite=new DatabaseSync(path,{readOnly:true});
    let sql:string|null;
    try {sql=repairSql(sqlite);} finally {sqlite.close();}
    if(!sql){console.log('Already repaired; canonical identities and receipt verified.');return;}
    // Private evidence stays within guarded ignored local state, never source/build output.
    const output=resolve('worker/.wrangler/singin-repair.sql');await guardedPath(output);
    stage='private SQL output';await writeFile(output,sql,{encoding:'utf8'});
    console.log('Preflight passed; private snapshot-guarded SQL prepared. No provider calls.');
    if(!values.apply)return;
    const cli=resolve('node_modules/wrangler/bin/wrangler.js');
    stage='local D1 application';const result=spawnSync(process.execPath,[cli,'d1','execute','DB','--config','worker/wrangler.jsonc','--local','--env','local','--file',output],{stdio:'pipe',encoding:'utf8'});
    if(result.status!==0)throw Error('Local D1 repair failed; inspect private SQL and database before retry.');
    stage='post-apply verification';const verified=new DatabaseSync(path,{readOnly:true});
    try {
      if(repairSql(verified)!==null || verified.prepare('PRAGMA foreign_key_check').all().length || verified.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('Local repair verification failed.');
    } finally {verified.close();}
    console.log('Local repair applied; repeat-safe receipt, identities, integrity and foreign keys verified.');
  } finally {await lock.close();await unlink(lockPath);}
}
main().catch(()=>{console.error(`Repair stopped at ${stage}. Inspect local state; no production access was performed.`);process.exitCode=1;});
