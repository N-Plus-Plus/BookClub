import { describe,it,expect,vi } from 'vitest';
import { readFileSync,readdirSync } from 'node:fs';
import { disposableD1 } from './d1';
import { ProductRepository } from '../worker/src/product-repository';
import { config,workbook } from './import-fixture';
import { analyseWorkbook } from '../scripts/import/workbook';
import { resolvePlan } from '../scripts/import/resolution';
import { capture,guard,sha256,productionTarget,verifyBackup,validateBootstrap,bootstrapMembers,bootstrapRotation,importProduction,verifyProduction,productionPreflight } from '../scripts/import/production';
import runner, {type CutoverEnv} from '../scripts/import/production-worker';
import { productionCommand,queryDatabase,remoteBoundary,writableProductionBoundary,wranglerInvocation } from '../scripts/import/production-remote';
import { resolve } from 'node:path';

const target=productionTarget(JSON.parse(readFileSync('worker/wrangler.jsonc','utf8')));
const resolved=()=>resolvePlan(analyseWorkbook(workbook(),{...config,snapshotCapturedAt:capture}).plan).plan;
const b=()=>validateBootstrap({version:1,members:Array.from({length:4},(_,i)=>({id:`club-member-${i+1}`,display_name:`Fictional Host ${i+1}`,authorized_email:`fictional${i+1}@example.invalid`,role:i<2?'admin':'member',active:1,sort_order:i+1,google_sub:null,avatar:null})),rotation:{cycle_id:resolved().cycles[0].id,nominal_slot:5,version:0}});
const gates=(bytes:Buffer)=>({mode:'production',databaseName:target.database_name,databaseId:target.database_id,planHash:sha256(bytes),confirmation:'APPLY-BOOKCLUB-PRODUCTION'});
const migrations=readdirSync('worker/migrations').filter(n=>n.endsWith('.sql')).sort();
function migrationLedger(local:ReturnType<typeof disposableD1>) {
 local.sqlite.exec('CREATE TABLE d1_migrations(name TEXT PRIMARY KEY)');
 for(const n of migrations)local.sqlite.prepare('INSERT INTO d1_migrations VALUES(?)').run(n);
}
describe('offline production cutover guards',()=>{
 it.each([['mode','local','mode'],['databaseName','bookclub-prdo','name'],['databaseId','wrong','ID'],['confirmation',undefined,'confirmation'],['planHash','wrong','hash']] as const)('rejects wrong/missing %s before any remote call',(key,value,message)=>{
  const bytes=Buffer.from(JSON.stringify(resolved()));expect(()=>guard({...gates(bytes),[key]:value},target,bytes,{...config,snapshotCapturedAt:capture})).toThrow(message);
 });
 it('rejects blocker, changed bytes and snapshot timestamp',()=>{
  const plan=resolved();plan.issues.push({code:'synthetic',severity:'blocker',source_refs:[],detail:'test'});const bytes=Buffer.from(JSON.stringify(plan));expect(()=>guard(gates(bytes),target,bytes,{...config,snapshotCapturedAt:capture})).toThrow('blockers');
  const p=resolved();p.snapshotCapturedAt='2000-01-01T00:00:00Z';for(const c of p.classics){for(const s of c.scores)s.fetched_at=p.snapshotCapturedAt;for(const s of c.seen)s.updated_at=p.snapshotCapturedAt;for(const s of c.seen_observations)s.observed_at=p.snapshotCapturedAt;}
  const old=Buffer.from(JSON.stringify(p));expect(()=>guard(gates(old),target,old,{...config,snapshotCapturedAt:p.snapshotCapturedAt})).toThrow('timestamp');
  const good=Buffer.from(JSON.stringify(resolved()));expect(()=>guard(gates(good),target,Buffer.concat([good,Buffer.from(' ')]),{...config,snapshotCapturedAt:capture})).toThrow('hash');
  expect(guard(gates(good),target,good,{...config,snapshotCapturedAt:capture}).movies.length).toBeGreaterThan(0);
 });
 it('requires exact nonempty remote export proof and rejects tampering',()=>{
  const bytes=Buffer.from('fictional SQL backup'),proof={...target,path:'.verification/production/fictional.sql',capturedAt:new Date().toISOString(),planHash:'plan',exportHash:sha256(bytes),bytes:bytes.length,remote:true as const};
  expect(()=>verifyBackup(undefined,target,'plan',bytes)).toThrow('backup');
  expect(()=>verifyBackup(proof,target,'plan',bytes)).not.toThrow();
  for(const changed of [{...proof,database_id:'wrong'},{...proof,planHash:'wrong'},{...proof,remote:false},{...proof,bytes:0},{...proof,exportHash:'wrong'}])expect(()=>verifyBackup(changed as typeof proof,target,'plan',bytes)).toThrow('backup');
 });
 it('accepts positional admin roles and rejects conflicting private bootstrap',()=>{
  expect(b().members.map(m=>m.role)).toEqual(['admin','admin','member','member']);
  const wrong=b();wrong.members[2].role='admin';expect(()=>validateBootstrap(wrong)).toThrow('role');
  const duplicate=b();duplicate.members[1].authorized_email=duplicate.members[0].authorized_email;expect(()=>validateBootstrap(duplicate)).toThrow('identity');
 });
});
describe('disposable production workflow rehearsal',()=>{
 it('preflights without writes, imports identically, preserves open Classics and never invents an event',async()=>{
  const local=disposableD1();try{
   migrationLedger(local);const plan=resolved(),bootstrap=b();
   const before=await productionPreflight(local.db,plan,bootstrap);expect(before.pending).toBeGreaterThan(0);expect(local.sqlite.prepare('SELECT count(*) n FROM members').get()?.n).toBe(0);
   await importProduction(local.db,plan,bootstrap);const first=local.sqlite.prepare('SELECT * FROM import_applied_entities').all();
   await bootstrapRotation(local.db,bootstrap,plan,true);
   const sessions=local.sqlite.prepare('SELECT * FROM sessions').all(),cycles=local.sqlite.prepare('SELECT * FROM cycles').all();
   expect(local.sqlite.prepare('SELECT * FROM club_rotation').get()).toMatchObject({nominal_slot:5,version:0});
   await importProduction(local.db,plan,bootstrap);await bootstrapRotation(local.db,bootstrap,plan,true);
   expect(local.sqlite.prepare('SELECT * FROM import_applied_entities').all()).toEqual(first);expect(local.sqlite.prepare('SELECT * FROM sessions').all()).toEqual(sessions);expect(local.sqlite.prepare('SELECT * FROM cycles').all()).toEqual(cycles);
   expect(await verifyProduction(local.db,plan,bootstrap,migrations)).toMatchObject({authRows:4,openClassicsSlot:5,foreignKeyViolations:0});
   local.sqlite.exec("UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1 WHERE id=1");await expect(bootstrapRotation(local.db,bootstrap,plan,true)).rejects.toThrow('version/state');
  }finally{local.sqlite.close();}
 });
 it('first real Classics completion advances to slot 1 without creating another cycle',async()=>{
  const local=disposableD1();try {
   const plan=resolved(),bootstrap=b();await importProduction(local.db,plan,bootstrap);await bootstrapRotation(local.db,bootstrap,plan,true);
   const cycles=local.sqlite.prepare('SELECT count(*) n FROM cycles').get()?.n;
   await new ProductRepository(local.db).saveSession({event_date:'2030-01-01',kind:'classics',host_member_id:null,cycle_id:bootstrap.rotation.cycle_id,cycle_slot:5,complete_turn:true,turn_version:0,movie_ids:plan.movies.slice(0,2).map(m=>m.id)},null);
   expect(local.sqlite.prepare('SELECT * FROM club_rotation').get()).toMatchObject({nominal_slot:1,cycle_id:null,version:1});expect(local.sqlite.prepare('SELECT count(*) n FROM cycles').get()?.n).toBe(cycles);
  }finally{local.sqlite.close();}
 });
 it('rejects member conflicts without provisioning or overwriting',async()=>{
  const local=disposableD1();try{
   const bootstrap=b();await bootstrapMembers(local.db,bootstrap,true);local.sqlite.exec("UPDATE members SET role='member' WHERE id='club-member-1'");await expect(bootstrapMembers(local.db,bootstrap,true)).rejects.toThrow('conflict');
   expect(local.sqlite.prepare("SELECT role FROM members WHERE id='club-member-1'").get()?.role).toBe('member');
  }finally{local.sqlite.close();}
 });
 it('resumes partial transaction groups and rejects changed imported payload',async()=>{
  const local=disposableD1();try{
   const plan=resolved(),bootstrap=b();local.sqlite.exec("CREATE TRIGGER fail_join BEFORE INSERT ON session_movies BEGIN SELECT RAISE(ABORT,'fictional failure'); END");
   await expect(importProduction(local.db,plan,bootstrap)).rejects.toThrow('batch failed');expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBeGreaterThan(0);expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()?.n).toBe(0);
   local.sqlite.exec('DROP TRIGGER fail_join');await importProduction(local.db,plan,bootstrap);
   const changed=structuredClone(plan);changed.movies[0].title='Changed imported payload';await expect(importProduction(local.db,changed,bootstrap)).rejects.toThrow('conflicts');
   expect(local.sqlite.prepare('SELECT title FROM movies WHERE id=?').get(plan.movies[0].id)?.title).toBe(plan.movies[0].title);
  }finally{local.sqlite.close();}
 });
 it.each(['fingerprint','counts','FK','migration'])('verification catches %s failures',async(kind)=>{
  const local=disposableD1();try {
   migrationLedger(local);const plan=resolved(),bootstrap=b();await importProduction(local.db,plan,bootstrap);await bootstrapRotation(local.db,bootstrap,plan,true);
   if(kind==='fingerprint')local.sqlite.exec("UPDATE import_applied_entities SET payload_hash='changed'");
   if(kind==='counts'){const id=plan.cycles[0].id;local.sqlite.prepare("INSERT INTO sessions(id,cycle_id,event_date,date_precision,kind,import_source,import_key) VALUES('extra',?,'2000-01-01','exact','classics',?,'extra')").run(id,plan.import_source);}
   if(kind==='FK'){local.sqlite.exec('PRAGMA foreign_keys=OFF');local.sqlite.exec("INSERT INTO session_movies(session_id,movie_id,position) VALUES('missing','missing',1)");local.sqlite.exec('PRAGMA foreign_keys=ON');}
   if(kind==='migration')local.sqlite.exec("DELETE FROM d1_migrations WHERE name='0008_provider_cooldowns.sql'");
   await expect(verifyProduction(local.db,plan,bootstrap,migrations)).rejects.toThrow();
  }finally{local.sqlite.close();}
 });
});
describe('retired native Worker binding runner',()=>{
 it('requires token, exact pinned plan/bootstrap/backup and completes only reviewed data',async()=>{
  const local=disposableD1();try {
   migrationLedger(local);const plan=resolved(),bootstrap=b(),bytes=Buffer.from(JSON.stringify(plan));
   const backup={...target,path:'fictional.sql',capturedAt:new Date().toISOString(),planHash:sha256(bytes),exportHash:'fictional-backup-hash',bytes:10,remote:true},rehearsal={planHash:sha256(bytes)};
   const env:CutoverEnv={DB:local.db,CUTOVER_TOKEN:'fictional-cutover-token',APP_ENV:'production',LOCAL_WRITE_BYPASS:'false',DATABASE_NAME:target.database_name,DATABASE_ID:target.database_id,PLAN_HASH:sha256(bytes),BOOTSTRAP_HASH:sha256(JSON.stringify(bootstrap)),BACKUP_PROOF_HASH:sha256(JSON.stringify(backup)),REHEARSAL_HASH:sha256(JSON.stringify(rehearsal)),MIGRATIONS:JSON.stringify(migrations)};
   const body={planBytes:JSON.stringify(plan),config:{...config,snapshotCapturedAt:capture},bootstrap,backup,rehearsal,gates:gates(bytes)};
   const request=(payload:unknown,token='fictional-cutover-token')=>new Request('https://fictional.invalid/cutover',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(payload)});
   expect((await runner.fetch(request(body,'wrong'),env)).status).toBe(403);
   expect((await runner.fetch(request({...body,backup:{...backup,exportHash:'changed'}}),env)).status).toBe(409);
   expect((await runner.fetch(request({...body,gates:{...body.gates,confirmation:undefined}}),env)).status).toBe(409);
   expect(local.sqlite.prepare('SELECT count(*) n FROM members').get()?.n).toBe(0);
   expect((await runner.fetch(request(body),env)).status).toBe(200);
   expect((await runner.fetch(request(body),env)).status).toBe(200);
   expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()?.n).toBe(plan.events.length);
   expect(local.sqlite.prepare('SELECT * FROM club_rotation').get()).toMatchObject({nominal_slot:5,version:0});
  }finally{local.sqlite.close();}
 });
 it('native D1 failed event batch rolls back its header and resumes identical runner data',async()=>{
  const local=disposableD1();try {
   const plan=resolved(),bootstrap=b();local.sqlite.exec("CREATE TRIGGER synthetic_join_failure BEFORE INSERT ON session_movies BEGIN SELECT RAISE(ABORT,'fictional'); END");
   await expect(importProduction(local.db,plan,bootstrap)).rejects.toThrow('batch failed');expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()?.n).toBe(0);
   local.sqlite.exec('DROP TRIGGER synthetic_join_failure');await importProduction(local.db,plan,bootstrap);expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()?.n).toBe(plan.events.length);
  }finally{local.sqlite.close();}
 });
});
describe('mocked remote boundaries and private material protection',()=>{
 it('invokes project Wrangler through the active pnpm CLI with Node and no fallback',()=>{
  const pnpmPath=resolve('fictional-toolchain/pnpm.cjs');vi.stubEnv('npm_execpath',pnpmPath);
  try {
   expect(wranglerInvocation(['--version'])).toEqual({file:process.execPath,args:[pnpmPath,'exec','wrangler','--version']});
   const source=readFileSync('scripts/import/production-remote.ts','utf8');
   expect(source).not.toContain('wrangler/bin/wrangler.js');expect(source).not.toContain('createRequire');
   expect(source).not.toMatch(/shell\s*:\s*true|\bnpx\b/);
  }finally{vi.unstubAllEnvs();}
 });
 it('fails closed when pnpm execution context is missing or belongs to another tool',()=>{
  vi.stubEnv('npm_execpath',undefined);
  try{expect(()=>wranglerInvocation(['--version'])).toThrow('active pnpm execution context');}finally{vi.unstubAllEnvs();}
  for(const path of ['', 'pnpm',resolve('fictional-toolchain/npm-cli.js')])expect(()=>wranglerInvocation(['--version'],path)).toThrow('active pnpm execution context');
 });
 it('uses configured target for supported export/migration commands, never resets',async()=>{
  const run=vi.fn(async(_args:string[])=>{});await productionCommand(target,'export','.verification/production/fictional.sql',run);await productionCommand(target,'migrations',undefined,run);
  expect(run.mock.calls[0][0]).toEqual(['d1','export',target.database_name,'--config','worker/wrangler.jsonc','--remote','--output','.verification/production/fictional.sql']);expect(run.mock.calls.flat(2).join(' ')).not.toMatch(/reset|delete|drop/);
  expect(target.database_name).toBe('bookclub-prod');
  expect(run.mock.calls[1][0]).toEqual(['d1','migrations','apply','bookclub-prod','--config','worker/wrangler.jsonc','--remote']);
  await expect(productionCommand({...target,database_id:'wrong'},'migrations',undefined,run)).rejects.toThrow('changed');expect(run).toHaveBeenCalledTimes(2);
 });
 it('read-only adapter blocks mutations and bounded write batches send exact bindings',async()=>{
  const transport=vi.fn(async queries=>queries.map(()=>({success:true,results:[],meta:{}})));const db=queryDatabase(transport,true);
  await expect(db.prepare('INSERT INTO members(id) VALUES(?)').bind('fictional').run()).rejects.toThrow('Read-only');expect(transport).not.toHaveBeenCalled();
  await expect(db.prepare('SELECT 1; DELETE FROM members').all()).rejects.toThrow('Read-only');
  await db.prepare('SELECT * FROM members').all();expect(transport).toHaveBeenCalledTimes(1);
  const write=queryDatabase(transport,false);await write.batch([write.prepare('INSERT INTO members(id) VALUES(?)').bind('fictional')]);expect(transport.mock.calls.at(-1)?.[0]).toEqual([{sql:'INSERT INTO members(id) VALUES(?)',params:['fictional']}]);
  await expect(write.batch(Array.from({length:101},()=>write.prepare('SELECT 1')))).rejects.toThrow('bound');
 });
 it('checks remote identity before exposing query/mutation capability with a mocked fetch',async()=>{
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID','a'.repeat(32));vi.stubEnv('CLOUDFLARE_API_TOKEN','fictional-token');
  try{const fetcher=vi.fn(async()=>Response.json({success:true,result:{uuid:target.database_id,name:'wrong'}}));await expect(remoteBoundary(target,fetcher)).rejects.toThrow('identity');expect(fetcher).toHaveBeenCalledTimes(1);}finally{vi.unstubAllEnvs();}
 });
 it('tracked tooling and examples contain no credentials/emails or destructive SQL path',()=>{
  for(const name of ['production.ts','production-cli.ts','production-remote.ts','production-worker.ts']){const source=readFileSync('scripts/import/'+name,'utf8');expect(source).not.toMatch(/\b(?:DROP TABLE|DELETE FROM|reset\.sql)\b/i);expect(source).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);}
  expect(readFileSync('.gitignore','utf8')).toContain('.verification/');
 });
});


describe('direct REST production cutover',()=>{
 it('requires explicit apply before identity access and preserves read-only capability',async()=>{
  const fetcher=vi.fn(async()=>Response.json({success:true,result:{uuid:target.database_id,name:target.database_name}}));
  for(const use of [{},{action:'verify',mode:'production',confirmation:'APPLY-BOOKCLUB-PRODUCTION'},{action:'apply',mode:'local',confirmation:'APPLY-BOOKCLUB-PRODUCTION'},{action:'apply',mode:'production'}])await expect(writableProductionBoundary(target,use,fetcher)).rejects.toThrow('guarded');
  expect(fetcher).not.toHaveBeenCalled();
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID','a'.repeat(32));vi.stubEnv('CLOUDFLARE_API_TOKEN','fictional');
  try {
   const fetcher=vi.fn(async(_url,options)=>Response.json({success:true,result:options?.method==='POST'?JSON.parse(String(options.body)).batch.map(()=>({success:true,results:[],meta:{}})):{uuid:target.database_id,name:target.database_name}}));
   const read=await remoteBoundary(target,fetcher);expect(Object.keys(read)).toEqual(['read']);
   await expect(read.read.prepare('UPDATE members SET active=1').run()).rejects.toThrow('Read-only');
   const use={action:'apply',mode:'production',confirmation:'APPLY-BOOKCLUB-PRODUCTION'};
   const write=await writableProductionBoundary(target,use,fetcher);
   await write.write.prepare('INSERT INTO members(id) VALUES(?)').bind('fictional').run();
   await write.write.prepare('UPDATE members SET active=? WHERE id=?').bind(1,'fictional').run();
   await expect(writableProductionBoundary(target,use,async()=>Response.json({success:true,result:{uuid:'wrong',name:target.database_name}}))).rejects.toThrow('identity');
  }finally{vi.unstubAllEnvs();}
 });
 it.each([null,{success:'true',result:[]},{success:true,result:null},{success:true,result:[{success:true,results:[]},{success:false,results:[]}]},{success:true,result:[{success:true,results:[]}]},{success:true,result:[null,null]},{success:true,result:[{success:true},{success:true,results:[]}]}])('rejects malformed, incomplete or mixed responses without replay',async(payload)=>{
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID','a'.repeat(32));vi.stubEnv('CLOUDFLARE_API_TOKEN','fictional');
  try {
   const fetcher=vi.fn(async(_url,options)=>Response.json(options?.method==='POST'?payload:{success:true,result:{uuid:target.database_id,name:target.database_name}}));
   const {write}=await writableProductionBoundary(target,{action:'apply',mode:'production',confirmation:'APPLY-BOOKCLUB-PRODUCTION'},fetcher);
   await expect(write.batch([write.prepare('INSERT INTO members(id) VALUES(?)').bind('one'),write.prepare('INSERT INTO members(id) VALUES(?)').bind('two')])).rejects.toThrow('Production');
   expect(fetcher).toHaveBeenCalledTimes(2);
  }finally{vi.unstubAllEnvs();}
 });
 it('resumes a non-atomic REST group after read-only inspection of matching rows',async()=>{
  const local=disposableD1();try {
   const plan=resolved(),bootstrap=b();await bootstrapMembers(local.db,bootstrap,true);
   let failed=false;
   const rest=queryDatabase(async queries=>{
    const results=[];for(const q of queries){results.push(await local.db.prepare(q.sql).bind(...q.params).all());if(!failed&&q.sql.startsWith('INSERT INTO sessions(')){failed=true;throw new Error('ambiguous completion');}}return results;
   },false);
   await expect(importProduction(rest,plan,bootstrap)).rejects.toThrow('batch failed');
   expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()?.n).toBe(1);
   const inspected=await productionPreflight(local.db,plan,bootstrap);expect(inspected.summary.conflicts).toBe(0);expect(inspected.pending).toBeGreaterThan(0);
   await importProduction(rest,plan,bootstrap);await bootstrapRotation(rest,bootstrap,plan,true);
   migrationLedger(local);expect(await verifyProduction(local.db,plan,bootstrap,migrations)).toMatchObject({allFingerprintsPresent:true,metricsLoads:true});
  }finally{local.sqlite.close();}
 });
 it('CLI retains all offline gates and preflight before write boundary, import, rotation and verification',()=>{
  const source=readFileSync('scripts/import/production-cli.ts','utf8');
  expect(source).not.toMatch(/runner-url|BOOKCLUB_CUTOVER_TOKEN|runner-config|fetch\(/);
  expect(source).toContain('strict:true');expect(source).not.toMatch(/sql:\{type/);
  for(const gate of ['guard(','verifyBackup(','migrationHash','receipt[k]!==value','validateBootstrap(','checkMigrations(remote.read,migrations)'])expect(source).toContain(gate);
  const start=source.lastIndexOf('await productionPreflight(remote.read,plan,b)');
  const sequence=['await writableProductionBoundary','await importProduction','await bootstrapRotation','await verifyProduction'];let previous=start;
  for(const step of sequence){const next=source.indexOf(step,previous+1);expect(next).toBeGreaterThan(previous);previous=next;}
 });
});
