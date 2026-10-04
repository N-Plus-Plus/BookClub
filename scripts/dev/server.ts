import { createServer } from 'node:http';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { wranglerInvocation } from '../import/production-remote.ts';
import { configuration, portOpen } from './local-context.ts';
import { allowedRefreshRequest } from './request-policy.ts';
await configuration();
if (await portOpen()) throw new Error('Port 8787 already occupied. Stop the other local API.');
let worker: ChildProcess | undefined, busy = false;
let status: {phase: string; message: string; result?: unknown} = {phase:'idle',message:''};
async function start() {
  const invocation = wranglerInvocation(['dev','--config','worker/wrangler.jsonc','--env','local','--local','--port','8787']);
  worker = spawn(invocation.file,invocation.args,{stdio:'inherit',windowsHide:true,detached:process.platform!=='win32'});
  for (let attempt=0; attempt<100; attempt++) {
    try {const response = await fetch('http://localhost:8787/api/v1/health'); const payload = await response.json() as any; if (payload.data?.environment==='local' && payload.data.authenticationRequired===false) return;} catch {}
    await new Promise(done => setTimeout(done,300));
  }
  throw new Error('Local Worker failed to start. Restart pnpm dev:api.');
}
async function stop() {
  if (!worker?.pid) return;
  if (process.platform==='win32') await promisify(execFile)('taskkill',['/pid',String(worker.pid),'/T','/F'],{windowsHide:true});
  else { process.kill(-worker.pid,'SIGTERM'); }
  for (let attempt=0; attempt<100 && await portOpen(); attempt++) await new Promise(done => setTimeout(done,100));
  if (await portOpen()) throw new Error('Could not stop local API; replacement refused.');
  worker = undefined;
}
const server = createServer((request,response) => {
  const send = (code: number,value: unknown) => {response.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}); response.end(JSON.stringify(value));};
  // Vite proxies this local-only surface; exact Host/Origin plus a custom header
  // reject cross-origin forms, DNS rebinding and direct non-frontend requests.
  if (request.url === '/__dev/refresh' && request.method === 'GET' && request.headers.host === 'localhost:4173') return send(200,status);
  if (request.url !== '/__dev/refresh' || !allowedRefreshRequest(request.method,request.headers.host,request.headers.origin,request.headers['x-bookclub-confirm'] as string)) return send(403,{message:'Local frontend confirmation required.'});
  if (busy) return send(409,{message:'Refresh already running.'});
  busy = true; status = {phase:'working',message:'Starting refresh…'};
  send(202,status);
  void import('./refresh.ts').then(({refresh}) => refresh({stop,start,progress:message => {status={phase:'working',message};}})).then(result => {status={phase:'success',message:'Local database refreshed.',result};}).catch(error => {status={phase:'error',message:error instanceof Error ? error.message : 'Refresh failed.'};}).finally(() => {busy=false;});
});
await new Promise<void>((ready,reject) => {server.once('error',reject); server.listen(8790,'127.0.0.1',ready);});
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,() => {server.close(); void stop().finally(() => process.exit());});
try {await start();}
catch (error) {server.close(); await stop(); throw error;}
