import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { readFile, open, unlink, access, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { configuration, activeState, portOpen, guardedPath } from './local-context.ts';
import { localId } from './snapshot.ts';
import { readJson, outputDirectory, writeReport, protectInputs } from '../import/io.ts';
import { parseManifest, runPairings } from './pair-tmdb.ts';
import { parseRound2, runRound2, captureBaseline, type Baseline, type Round2Report } from './pair-tmdb-round2.ts';

async function checkpoint(out:string,filename:string,report:unknown) {
  // Windows readers can briefly hold the old report while atomic rename runs.
  for(let attempt=0;;attempt++){
    try{return await writeReport(out,filename,report);}
    catch(error){if(attempt>=5||!['EACCES','EBUSY','EPERM'].includes((error as NodeJS.ErrnoException).code??''))throw error;await new Promise(done=>setTimeout(done,50*(attempt+1)));}
  }
}

async function main() {
  const {values}=parseArgs({options:{manifest:{type:'string'},apply:{type:'boolean'},out:{type:'string'}},strict:true});
  if(!values.manifest)throw new Error('Usage: corepack pnpm exec tsx scripts/dev/pair-tmdb-cli.ts --manifest <file> [--apply] [--out .verification/tmdb-pairings]');
  const input=await readJson(values.manifest,'Pairing manifest');
  const round2=!!input&&typeof input==='object'&&(input as {version?:unknown}).version===2||!!input&&typeof input==='object'&&(input as {version?:unknown}).version===3;
  const finalRound=!!input&&typeof input==='object'&&(input as {version?:unknown}).version===3;
  const manifest=round2?parseRound2(input):parseManifest(input);
  await configuration();await access(activeState);
  if(await portOpen())throw new Error('Stop the local API before TMDB pairing maintenance.');
  const lockPath=resolve('worker/.wrangler/dev-refresh.lock');await guardedPath(lockPath);
  const lock=await open(lockPath,'wx');
  let mf: {getD1Database:(name:string)=>Promise<D1Database>;dispose:()=>Promise<void>}|undefined;
  try {
    const out=await outputDirectory(values.out??(finalRound?'.verification/tmdb-pairings-round3-final-v2':round2?'.verification/tmdb-pairings-round2':'.verification/tmdb-pairings'));
    const filename=values.apply?(round2?'verification-report.json':'apply-report.json'):'preflight-report.json';
    await protectInputs(out,[values.manifest],['apply-report.json','preflight-report.json','verification-report.json','baseline-state.json','provider-cache.json']);
    let token=process.env.TMDB_READ_TOKEN;
    if(values.apply&&!token){
      // Read only the normal local provider configuration; never log its contents.
      const vars=await readFile('worker/.dev.vars.local','utf8').catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return '';throw error;});
      const raw=vars.match(/^\s*TMDB_READ_TOKEN\s*=\s*(.*?)\s*$/m)?.[1];
      token=raw?.replace(/^(['"])(.*)\1$/,'$2');
    }
    const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
    const {Miniflare,convertV4MiniflareOptions,NoOpLog}=wranglerRequire('miniflare');
    mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'',resourcePersistencePath:resolve('worker/.wrangler/state/v3'),d1Databases:{DB:localId},log:new NoOpLog()}));
    const integrity=async()=>{
      const directory=resolve(activeState,'miniflare-D1DatabaseObject');await guardedPath(directory);
      const files=(await readdir(directory)).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');
      if(files.length!==1)throw new Error('Expected exactly one ordinary local D1 file.');
      const path=resolve(directory,files[0]);await guardedPath(path);
      const sqlite=new DatabaseSync(path,{readOnly:true});
      try{return sqlite.prepare('PRAGMA integrity_check').all();}finally{sqlite.close();}
    };
    const db=await mf!.getD1Database('DB');
    if(round2){
      let baseline:Baseline|undefined,previous:Round2Report|undefined;
      if(values.apply){
        try{const saved=JSON.parse(await readFile(resolve(out,'baseline-state.json'),'utf8'));if(saved.manifest!==JSON.stringify(manifest))throw Error('Baseline belongs to another manifest.');baseline=saved.baseline;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;baseline=await captureBaseline(db);await checkpoint(out,'baseline-state.json',{manifest:JSON.stringify(manifest),baseline});}
        try{previous=JSON.parse(await readFile(resolve(out,filename),'utf8'));if(finalRound){const cache=JSON.parse(await readFile(resolve(out,'provider-cache.json'),'utf8'));if(cache.manifest_hash!==previous!.manifest_hash)throw Error('Provider cache mismatch.');previous!.responses=cache.responses;}}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      }
      const report=await runRound2(db,manifest as ReturnType<typeof parseRound2>,{apply:!!values.apply,token,baseline,previous,integrity,save:async r=>{if(finalRound){await checkpoint(out,'provider-cache.json',{manifest_hash:r.manifest_hash,responses:r.responses});await checkpoint(out,filename,{...r,responses:undefined});}else await checkpoint(out,filename,r);},progress:message=>console.log(message)});
      console.log(JSON.stringify({accepted:report.accepted.length,already_applied:report.already_applied.length,rejected:report.rejected.length,conflicts:report.conflicts.length,merges_completed:report.merges_completed.length,merge_groups_completed:report.merge_groups_completed.length,merge_conflicts:report.merge_conflicts.length,removed:report.canonical_rows_removed.length,canonical:report.ending_canonical,unidentified:report.ending_unidentified,provider_calls:report.provider_calls,cooldown_events:report.cooldown_events,report:resolve(out,filename),verification:report.verification}));
    }else{
      const report=await runPairings(db,manifest as ReturnType<typeof parseManifest>,{apply:!!values.apply,token,integrity,save:r=>checkpoint(out,filename,r),progress:n=>{if(n%25===0)console.log(`Processed ${n} pairings.`);}});
      console.log(JSON.stringify({proposed:report.proposed,eligible:report.eligible,accepted:report.accepted.length,already_applied:report.already_applied.length,rejected:report.rejected.length,conflicts:report.conflicts.length,provider_failures:report.provider_failures.length,remaining_without_tmdb:report.remaining_without_tmdb,provider_calls:report.provider_calls,report:resolve(out,filename),verification:report.verification}));
    }
  }finally{await mf?.dispose();await lock.close();await unlink(lockPath);}
}
main().catch(error=>{console.error('Local pairing operation failed. Check local configuration, stopped API, manifest and ignored report. Private exception details suppressed.');if(error instanceof Error)console.error(error.stack?.split('\n').filter(line=>/^\s+at /.test(line)&&line.includes('pair-tmdb')).join('\n'));process.exitCode=1;});
