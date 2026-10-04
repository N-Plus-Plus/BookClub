import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createConnection } from 'node:net';
import { validateConfig } from './snapshot.ts';

export const activeState = resolve('worker/.wrangler/state/v3/d1');
export async function guardedPath(path: string) {
  const root = await realpath('.'), allowed = resolve(root,'worker/.wrangler');
  if (!path.startsWith(allowed + '\\') && !path.startsWith(allowed + '/')) throw new Error('Local state path outside worker/.wrangler.');
  let ancestor = path;
  while (true) {
    try { if (await realpath(ancestor) !== ancestor) throw new Error('Local state cannot use symlinks or junctions.'); break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; ancestor = dirname(ancestor); }
  }
}
export async function configuration() {
  const config = JSON.parse(await readFile('worker/wrangler.jsonc','utf8'));
  validateConfig(config);
  await guardedPath(activeState);
  return config;
}
export const portOpen = () => new Promise<boolean>(done => {
  const socket = createConnection({host:'127.0.0.1',port:8787});
  socket.once('connect',() => {socket.destroy(); done(true);}); socket.once('error',() => done(false));
});
