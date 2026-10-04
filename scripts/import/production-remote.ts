import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import { ImportError } from './io.ts';
import { productionTarget, type Target } from './production.ts';

export type Query={sql:string;params:unknown[]};
export type Transport=(queries:Query[])=>Promise<D1Result[]>;
// No arbitrary SQL is exposed by the CLI. Only the reviewed importer statements
// reach this adapter. Tests supply an in-memory transport; normal tests never fetch.
export function queryDatabase(transport:Transport,readOnly:boolean):D1Database {
  function prepare(sql:string,params:unknown[]=[]):unknown {
    const check=()=>{if(readOnly&&(/[;]|--|\/\*/.test(sql)||!/^(SELECT\b|PRAGMA (table_info\(|foreign_key_check\b))/i.test(sql.trim())))throw new ImportError('Read-only production boundary rejected mutation.');};
    const statement={sql,params,bind:(...args:unknown[])=>prepare(sql,args),all:async()=>{check();return (await transport([{sql,params}]))[0];},first:async()=>{check();return (await transport([{sql,params}]))[0].results[0]??null;},run:async()=>{check();return (await transport([{sql,params}]))[0];}};
    return statement;
  }
  return {prepare,batch:async(statements:(D1PreparedStatement & Query)[])=>{
    if(statements.length>100)throw new ImportError('Production batch exceeds statement bound.');
    if(readOnly&&statements.some(s=>/[;]|--|\/\*/.test(s.sql)||!/^(SELECT\b|PRAGMA (table_info\(|foreign_key_check\b))/i.test(s.sql.trim())))throw new ImportError('Read-only production boundary rejected mutation.');
    return transport(statements.map(s=>({sql:s.sql,params:s.params})));
  }} as unknown as D1Database;
}
async function connect(target:Target,fetcher:typeof fetch) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  if(!account||!/^[a-f0-9]{32}$/i.test(account)||!token)throw new ImportError('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required for future remote execution.');
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${target.database_id}`;
  async function call(path:string,body?:unknown) {
    try {
      const r=await fetcher(endpoint+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
      const payload=await r.json() as {success:boolean;result:unknown};
      if(!r.ok||!payload||payload.success!==true)throw new Error();return payload.result;
    }catch{throw new ImportError('Production D1 request failed; sensitive upstream details suppressed. Re-preflight before retry.');}
  }
  const identity=await call('') as {uuid:string;name:string};
  if(!identity||identity.uuid!==target.database_id||identity.name!==target.database_name)throw new ImportError('Remote production identity mismatch.');
  const transport:Transport=async(batch)=>{
    const result=await call('/query',{batch}) as D1Result[];
    if(!Array.isArray(result)||result.length!==batch.length||result.some(r=>!r||r.success!==true||!Array.isArray(r.results)))throw new ImportError('Production query batch failed; re-preflight before retry.');
    return result;
  };
  return transport;
}
// REST completion is checked per statement. No atomic rollback is assumed and
// ambiguous failures are never automatically retried. Inspect immutable state first.
export async function remoteBoundary(target:Target,fetcher:typeof fetch=fetch) {
  return {read:queryDatabase(await connect(target,fetcher),true)};
}
export async function writableProductionBoundary(target:Target,use:{action?:string;mode?:string;confirmation?:string},fetcher:typeof fetch=fetch) {
  if(use.action!=='apply'||use.mode!=='production'||use.confirmation!=='APPLY-BOOKCLUB-PRODUCTION')throw new ImportError('Explicit guarded production apply required for writes.');
  return {write:queryDatabase(await connect(target,fetcher),false)};
}
export type Command=(args:string[])=>Promise<void>;
export function wranglerInvocation(args:string[],pnpmPath=process.env.npm_execpath) {
  if(!pnpmPath||!isAbsolute(pnpmPath)||!/^pnpm\.(?:cjs|js|mjs)$/.test(basename(pnpmPath)))throw new ImportError('Production Wrangler requires an active pnpm execution context. Run corepack pnpm import:production.');
  return {file:process.execPath,args:[pnpmPath,'exec','wrangler',...args]};
}
export const wranglerCommand:Command=async(args)=>{
  const invocation=wranglerInvocation(args);
  try{await promisify(execFile)(invocation.file,invocation.args,{windowsHide:true,maxBuffer:8*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'}});}catch{throw new ImportError('Production Wrangler command failed; private output suppressed. Inspect state with read-only preflight before retry.');}
};
export async function productionCommand(target:Target,operation:'export'|'migrations',output?:string,run:Command=wranglerCommand) {
  const current=productionTarget(JSON.parse(await readFile('worker/wrangler.jsonc','utf8')));
  if(current.database_id!==target.database_id||current.database_name!==target.database_name)throw new ImportError('Production configuration changed.');
  if(operation==='export') {
    if(!output)throw new ImportError('Backup output required.');
    await run(['d1','export',target.database_name,'--config','worker/wrangler.jsonc','--remote','--output',output]);
  }else await run(['d1','migrations','apply',target.database_name,'--config','worker/wrangler.jsonc','--remote']);
}
