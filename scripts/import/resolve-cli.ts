import { parseArgs } from 'node:util';
import { readFile, access, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { ImportError, readJson, readConfig, outputDirectory, writeReport, safeFailure, protectInputs } from './io.ts';
import { parseModel, rawPlanSchema, overridesSchema } from './model.ts';
import { resolvePlan } from './resolution.ts';
import { cacheSchema, resolveWithTmdb } from './tmdb-resolution.ts';
async function main() {
  const {values}=parseArgs({options:{plan:{type:'string'},config:{type:'string'},out:{type:'string'},overrides:{type:'string'},network:{type:'boolean'},'env-file':{type:'string'},'max-requests':{type:'string'}},args:process.argv.slice(2).filter(a=>a!=='--'),strict:true});
  if(!values.plan||!values.config) throw new ImportError('Usage: pnpm import:resolve --plan .verification/import/plan.json --config scripts/import/import-config.local.json [--network --max-requests 25]');
  const config=await readConfig(values.config), raw=parseModel(rawPlanSchema,await readJson(values.plan,'Plan'),'Raw plan');
  if(JSON.stringify(raw.members)!==JSON.stringify(config.memberIds)||raw.import_source!==config.importSource) throw new ImportError('Config does not match the plan member order/import source.');
  raw.snapshotCapturedAt=config.snapshotCapturedAt??null;
  const overrides=values.overrides?parseModel(overridesSchema,await readJson(values.overrides,'Overrides'),'Overrides'):{version:1 as const,assignments:[],seen:[]};
  const out=await outputDirectory(values.out);let result=resolvePlan(raw,overrides);
  await protectInputs(out,[values.plan,values.config,...(values.overrides?[values.overrides]:[])],['resolved-plan.json','resolution-report.json','resolution-report.md','resolution-cache.json','resolution-overrides.suggested.json']);
  const cachePath=resolve(out,'resolution-cache.json');let cache;
  try {await access(cachePath);cache=parseModel(cacheSchema,await readJson(cachePath,'Cache'),'Cache');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  let token=values.network?process.env.TMDB_READ_TOKEN:undefined;
  if(values.network&&!token&&values['env-file']) {
    const file=resolve(values['env-file']);if(!/(^|[/\\])\.dev\.vars(?:\.local)?$/.test(file)||relative(resolve('.'),file).startsWith('..')) throw new ImportError('env-file must be an ignored project .dev.vars or .dev.vars.local file.');
    try{if(await realpath(file)!==file)throw new ImportError('env-file must not be a symlink/junction.');}catch(e){if(e instanceof ImportError)throw e;throw new ImportError('Supplied env-file cannot be read.');}
    let content:string;try{content=await readFile(file,'utf8');}catch{throw new ImportError('Supplied env-file cannot be read.');}
    const match=content.match(/^\s*TMDB_READ_TOKEN\s*=\s*(.*?)\s*$/m);token=match?.[1].replace(/^(['"])(.*)\1$/,'$2');
  }
  const network=await resolveWithTmdb(result.plan,{token,maxRequests:values['max-requests']===undefined?25:Number(values['max-requests']),cache,save:c=>writeReport(out,'resolution-cache.json',c)});
  result=resolvePlan(raw,overrides,network.evidence);
  const report={...result.report,network:network.state,networkReview:network.review};
  await writeReport(out,'resolved-plan.json',result.plan);await writeReport(out,'resolution-report.json',report);
  await writeReport(out,'resolution-report.md',`# Canonical resolution\n\nPrivate local report.\n\n## Summary\n\n${Object.entries(report.after).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n- Historical Watch Order exact match: ${report.historicalWatchOrder.exactMatch}\n- Canonical top-20 differences: ${report.differences.length} (duplicate collapse/source correction)\n- Network requests: ${network.state.requests}\n- Remaining requests: ${network.state.remaining}\n\n## Reconciliation\n\n${report.issues.map(i=>`- [${i.severity}] ${i.code}: ${i.source_refs.join(', ')} — ${i.detail}`).join('\n')}\n\nCandidate choices and comparison details are in resolution-report.json. Missing TMDB IDs alone do not block provisional identities.\n`);
  // Suggestions never overwrite the owner's private decisions. Copy only chosen edits into a local override file.
  await writeReport(out,'resolution-overrides.suggested.json',{version:1,assignments:[],seen:[],unresolved:result.plan.issues.filter(i=>i.severity==='blocker'),candidates:network.review,template:{source_refs:['Should Watch:2'],identity:'private-choice',tmdb_id:'123',preferred_score_ref:'Should Watch:2'}});
  console.log(JSON.stringify({before:report.before,after:report.after,canonicalTop20Differences:report.differences.length,network:network.state},null,2));
  if(network.state.moreWorkRemains)console.log('More resolution work remains; cached progress saved.');
}
main().catch(safeFailure);
