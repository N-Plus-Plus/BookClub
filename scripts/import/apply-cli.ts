import { parseArgs } from 'node:util';
import { readConfig, readJson, outputDirectory, writeReport, ImportError, safeFailure, protectInputs } from './io.ts';
import { applyLocal, validateResolved } from './apply.ts';
import { openPreviewDb } from './local-db.ts';
async function main() {
  const {values}=parseArgs({options:{plan:{type:'string'},config:{type:'string'},apply:{type:'boolean'},out:{type:'string'}},args:process.argv.slice(2).filter(a=>a!=='--'),strict:true});
  if(!values.plan||!values.config)throw new ImportError('Usage: pnpm import:apply:local --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json [--apply]');
  const config=await readConfig(values.config),plan=validateResolved(await readJson(values.plan,'Resolved plan'),config),out=await outputDirectory(values.out);
  await protectInputs(out,[values.plan,values.config],['apply-preflight.json','apply-report.json']);
  const local=await openPreviewDb();
  try {
    const preflight=await applyLocal(local.db,plan,false);await writeReport(out,'apply-preflight.json',preflight);console.log(JSON.stringify(preflight,null,2));
    if(values.apply) {const result=await applyLocal(local.db,plan,true);await writeReport(out,'apply-report.json',result);console.log(JSON.stringify(result,null,2));}
    else console.log('Preflight only. Add --apply to write the dedicated local import-preview database.');
  }finally{await local.close();}
}
main().catch(safeFailure);
