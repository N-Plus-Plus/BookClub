import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, mkdtemp, readdir, rename, rm, open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { wranglerInvocation } from '../import/production-remote.ts';
import { copySnapshot, restoreExport, validateIdentity } from './snapshot.ts';

import {activeState, guardedPath, configuration, portOpen} from './local-context.ts';
export async function command(args: string[]) {
  const invocation = wranglerInvocation(args);
  try { return (await promisify(execFile)(invocation.file,invocation.args,{windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'}})).stdout; }
  catch { throw new Error('Wrangler operation failed. Check local Cloudflare login/permissions and stop competing dev processes. Private command output suppressed.'); }
}
async function sqliteFile(path: string): Promise<string> {
  const entries = await readdir(path,{withFileTypes:true});
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) { try { files.push(await sqliteFile(resolve(path,entry.name))); } catch {} }
    else if (entry.name.endsWith('.sqlite') && entry.name !== 'metadata.sqlite') files.push(resolve(path,entry.name));
  }
  if (files.length !== 1) throw new Error('Expected exactly one staging local D1 database.');
  return files[0];
}
export async function switchState(stage: string) {
  await guardedPath(stage); await guardedPath(activeState);
  if (await portOpen()) throw new Error('Local API still running; replacement refused.');
  await mkdir(dirname(activeState),{recursive:true});
  const backup = activeState + '-before-refresh-' + Date.now();
  let moved = false;
  try { await rename(activeState,backup); moved = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  try { await rename(stage,activeState); }
  catch { if (moved) await rename(backup,activeState); throw new Error('Local switch failed; previous local state restored.'); }
  return moved ? backup : null;
}
export async function refresh(options: {progress?: (message: string) => void; stop?: () => Promise<void>; start?: () => Promise<void>} = {}) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Dev DB refresh requires Node 24 or newer.');
  await configuration();
  const progress = options.progress ?? (() => {});
  await mkdir('worker/.wrangler',{recursive:true});
  const lock = resolve('worker/.wrangler/dev-refresh.lock');
  let handle;
  try { handle = await open(lock,'wx'); } catch { throw new Error('Refresh already running, or stale worker/.wrangler/dev-refresh.lock. Stop refresh processes before removing a stale lock.'); }
  let workspace = '', stopped = false;
  try {
    if (!options.stop && await portOpen()) throw new Error('Stop the local API before CLI refresh, or use the dev UI control.');
    progress('Verifying exact production identity…');
    validateIdentity(JSON.parse(await command(['d1','info','bookclub-prod','--config','worker/wrangler.jsonc','--json'])));
    workspace = await mkdtemp(resolve('worker/.wrangler/refresh-'));
    const exportFile = resolve(workspace,'source.sql');
    progress('Exporting current production snapshot (read-only)…');
    await command(['d1','export','bookclub-prod','--config','worker/wrangler.jsonc','--remote','--output',exportFile]);
    const snapshotTime = new Date().toISOString();
    const sql = await readFile(exportFile,'utf8');
    if (!sql.trim()) throw new Error('Production export empty; existing local state preserved.');
    progress('Building current local migrations and sanitising snapshot…');
    const persistence = resolve(workspace,'replacement');
    await command(['d1','migrations','apply','DB','--config','worker/wrangler.jsonc','--env','local','--local','--persist-to',persistence]);
    const source = new DatabaseSync(':memory:');
    const target = new DatabaseSync(await sqliteFile(resolve(persistence,'v3/d1')));
    let result;
    try { restoreExport(source,sql); result = copySnapshot(source,target); target.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }
    catch {throw new Error('Snapshot restore/sanitisation failed. Check schema compatibility and data integrity; existing local state preserved. Private SQL details suppressed.');}
    finally {source.close(); target.close(); await rm(exportFile,{force:true});}
    // Verify the actual local emulator/API/domain path before replacing active state.
    progress('Verifying local catalog, History, Metrics, Watch Order and Builder…');
    const {verifyReplacement} = await import('./verify.ts');
    await verifyReplacement(persistence);
    await configuration();
    if (options.stop) { await options.stop(); stopped = true; }
    progress('Switching validated local state…');
    const backup = await switchState(resolve(persistence,'v3/d1'));
    if (options.start) {
      try { await options.start(); stopped = false; }
      catch {
        await options.stop?.();
        const failed = resolve(workspace,'failed-d1');
        await guardedPath(failed); await guardedPath(activeState);
        await rename(activeState,failed);
        if (backup) {await guardedPath(backup); await rename(backup,activeState);}
        await options.start(); stopped = false;
        throw new Error('Replacement Worker failed to start; previous local state restored.');
      }
    }
    return {...result,snapshotTime,localEnvironment:'local',productionEnvironmentActive:false,previousLocalStateRetained:Boolean(backup)};
  } finally {
    if (stopped && options.start) await options.start();
    if (workspace) { await guardedPath(workspace); await rm(workspace,{recursive:true,force:true}); }
    await handle.close(); await rm(lock,{force:true});
  }
}
