import { parseArgs } from 'node:util';
import { readFile, readdir, access, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { outputDirectory, writeReport, readConfig, readJson, ImportError, safeFailure } from './io.ts';
import { openPreviewDb } from './local-db.ts';
import { validateResolved, preflight } from './apply.ts';
import { guard, productionTarget, sha256, validateBootstrap, verifyBackup, checkMigrations, productionPreflight, verifyProduction, type BackupProof } from './production.ts';
import { remoteBoundary, productionCommand } from './production-remote.ts';

async function privatePath(path:string) {
  const actual=await realpath(resolve(path)),root=await realpath('.verification'),rel=relative(root,actual);
  if(rel.startsWith('..')||isAbsolute(rel)||actual!==resolve(path))throw new ImportError('Production material must stay inside ignored .verification without symlinks.');
  return actual;
}
async function main() {
  const {values:v}=parseArgs({strict:true,options:{action:{type:'string'},plan:{type:'string'},config:{type:'string'},bootstrap:{type:'string'},mode:{type:'string'},'database-name':{type:'string'},'database-id':{type:'string'},'plan-hash':{type:'string'},confirmation:{type:'string'},'backup-proof':{type:'string'},'runner-url':{type:'string'}},args:process.argv.slice(2).filter(a=>a!=='--')});
  if(!v.plan||!v.config||!['prepare','runner-config','backup','migrate','preflight','apply','verify'].includes(v.action??''))throw new ImportError('Usage: import:production --action prepare|runner-config|backup|migrate|preflight|apply|verify --plan PRIVATE_PLAN --config PRIVATE_CONFIG [production gates].');
  const out=await outputDirectory('.verification/production'),bytes=await readFile(await privatePath(v.plan)),config=await readConfig(v.config),target=productionTarget(JSON.parse(await readFile('worker/wrangler.jsonc','utf8')));
  const migrations=(await readdir('worker/migrations')).filter(n=>n.endsWith('.sql')).sort();
  const migrationHash=sha256((await Promise.all(migrations.map(n=>readFile(`worker/migrations/${n}`,'utf8')))).join('\n'));
  const plan=v.action==='prepare'?validateResolved(JSON.parse(new TextDecoder().decode(bytes)),config):guard({mode:v.mode,databaseName:v['database-name'],databaseId:v['database-id'],planHash:v['plan-hash'],confirmation:v.confirmation},target,bytes,config);
  if(plan.snapshotCapturedAt!=='2026-10-04T06:53:20Z'||plan.cycles.length!==55||plan.events.length!==250||plan.events.reduce((n,e)=>n+e.films.length,0)!==465||plan.sourceCandidateRows!==627||plan.movies.flatMap(m=>m.source_refs).length!==1092||!plan.rawWatchOrder.exactMatch)throw new ImportError('Authorised archive baseline mismatch.');
  const planHash=sha256(bytes),receiptPath=resolve(out,'rehearsal.json');
  if(v.action==='prepare') {
    const local=await openPreviewDb();try {
      const check=await preflight(local.db,plan);
      if(check.conflicts.length||check.pending.length||(await local.db.prepare('PRAGMA foreign_key_check').all()).results.length)throw new ImportError('Exact plan has not passed the isolated rehearsal.');
      await checkMigrations(local.db,migrations);
      await writeReport(out,'rehearsal.json',{version:1,planHash,migrationHash,...target,snapshotCapturedAt:plan.snapshotCapturedAt,cycles:55,events:250,appearances:465,sourceRefs:1092,conflicts:0,pending:0,foreignKeyViolations:0});
      const template=resolve(out,'bootstrap.local.json');try{await access(template);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;
        // This scaffold is private and incomplete until owner identities are supplied.
        const cycle=plan.cycles.find(c=>c.ordinal===55)!;
        await writeReport(out,'bootstrap.local.json',{version:1,members:['Sean','Troy','Matt','Jess'].map((name,i)=>({id:`club-member-${i+1}`,display_name:name,authorized_email:'',role:i<2?'admin':'member',active:1,sort_order:i+1,google_sub:null,avatar:null})),rotation:{cycle_id:cycle.id,nominal_slot:5,version:0}});
      }
      console.log(JSON.stringify({prepared:true,planHash,...target,remoteAccess:false}));
    }finally{await local.close();}return;
  }
  const receipt=await readJson(receiptPath,'Rehearsal proof') as Record<string,unknown>;
  const expected={version:1,planHash,migrationHash,...target,snapshotCapturedAt:plan.snapshotCapturedAt,cycles:55,events:250,appearances:465,sourceRefs:1092,conflicts:0,pending:0,foreignKeyViolations:0};
  if(Object.entries(expected).some(([k,value])=>receipt[k]!==value))throw new ImportError('Exact local rehearsal proof missing or stale.');
  const b=validateBootstrap(await readJson(await privatePath(v.bootstrap??resolve(out,'bootstrap.local.json')),'Private bootstrap'));
  let backup:BackupProof|undefined;
  if(v.action==='migrate'||v.action==='apply'||v.action==='runner-config') {
    if(!v['backup-proof'])throw new ImportError('Verified remote backup proof required.');
    const proof=await readJson(await privatePath(v['backup-proof']),'Backup proof') as BackupProof;
    verifyBackup(proof,target,planHash,await readFile(await privatePath(proof.path)));backup=proof;
  }
  if(v.action==='runner-config') {
    const runner={name:'bookclub-cutover',main:'../../scripts/import/production-worker.ts',compatibility_date:'2026-09-01',compatibility_flags:['nodejs_compat'],limits:{cpu_ms:300000},vars:{APP_ENV:'production',LOCAL_WRITE_BYPASS:'false',DATABASE_NAME:target.database_name,DATABASE_ID:target.database_id,PLAN_HASH:planHash,BOOTSTRAP_HASH:sha256(JSON.stringify(b)),BACKUP_PROOF_HASH:sha256(JSON.stringify(backup)),REHEARSAL_HASH:sha256(JSON.stringify(receipt)),MIGRATIONS:JSON.stringify(migrations)},d1_databases:[{binding:'DB',...target,migrations_dir:'../../worker/migrations'}]};
    const name=`runner-${sha256(JSON.stringify(runner)).slice(0,16)}.json`;
    try{await access(resolve(out,name));if(JSON.stringify(await readJson(resolve(out,name),'Runner config'))!==JSON.stringify(runner))throw new ImportError('Existing runner config differs.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await writeReport(out,name,runner);}
    console.log(JSON.stringify({runnerConfig:name,remoteAccess:false,deployed:false}));return;
  }
  let runnerUrl:URL|undefined;
  if(v.action==='apply') {
    try{runnerUrl=new URL(v['runner-url']??'');}catch{throw new ImportError('Reviewed cutover runner URL required.');}
    if(runnerUrl.protocol!=='https:'||!/^bookclub-cutover\.[a-z0-9-]+\.workers\.dev$/.test(runnerUrl.hostname)||runnerUrl.pathname!=='/'||runnerUrl.search||runnerUrl.username||runnerUrl.password||runnerUrl.port)throw new ImportError('Unsafe cutover runner URL.');
    if(!process.env.BOOKCLUB_CUTOVER_TOKEN)throw new ImportError('BOOKCLUB_CUTOVER_TOKEN required for future native D1 cutover runner.');
  }
  // Only after every offline gate passes is even a remote identity read allowed.
  const remote=await remoteBoundary(target);
  if(v.action==='backup') {
    const capturedAt=new Date().toISOString(),name=`backup-${capturedAt.replace(/[:.]/g,'-')}.sql`,path=resolve(out,name);
    try{await access(path);throw new ImportError('Backup path already exists.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    await productionCommand(target,'export',path);
    const exported=await readFile(await privatePath(path));
    const proof:BackupProof={...target,path:relative(resolve('.'),path),capturedAt,planHash,exportHash:sha256(exported),bytes:exported.length,remote:true};
    verifyBackup(proof,target,planHash,exported);
    await writeReport(out,name+'.proof.json',proof);
    console.log(JSON.stringify({backupVerified:true,proof:name+'.proof.json'}));return;
  }
  if(v.action==='migrate') {
    const schema=(await remote.read.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name:string}>()).results;
    if(schema.some(s=>s.name==='provider_cooldowns'))await productionPreflight(remote.read,plan,b);
    else {
      // Old populated databases require a separately reviewed migration, never an
      // automatic repair or rewrite by this initial cutover workflow.
      for(const table of ['members','movies','cycles','sessions','classics','source_scores','member_auth','club_rotation'])if(schema.some(s=>s.name===table)&&(await remote.read.prepare(`SELECT count(*) n FROM ${table}`).first<{n:number}>())?.n)throw new ImportError('Populated older production schema requires separate migration review.');
    }
    await productionCommand(target,'migrations');await checkMigrations(remote.read,migrations);
    console.log('Production migrations verified.');return;
  }
  await checkMigrations(remote.read,migrations);
  if(v.action==='preflight'){console.log(JSON.stringify(await productionPreflight(remote.read,plan,b)));return;}
  if(v.action==='verify'){console.log(JSON.stringify(await verifyProduction(remote.read,plan,b,migrations)));return;}
  await productionPreflight(remote.read,plan,b);
  try {
    const response=await fetch(new URL('cutover',runnerUrl),{method:'POST',headers:{Authorization:`Bearer ${process.env.BOOKCLUB_CUTOVER_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({planBytes:new TextDecoder().decode(bytes),config,bootstrap:b,backup,rehearsal:receipt,gates:{mode:v.mode,databaseName:v['database-name'],databaseId:v['database-id'],planHash:v['plan-hash'],confirmation:v.confirmation}}),signal:AbortSignal.timeout(15*60*1000)});
    if(!response.ok)throw new Error();
  }catch{throw new ImportError('Native cutover runner failed or timed out. Earlier groups may remain; use read-only preflight before identical retry.');}
  console.log(JSON.stringify(await verifyProduction(remote.read,plan,b,migrations)));
}
main().catch(safeFailure);
