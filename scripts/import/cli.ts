import ExcelJS from 'exceljs';
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { analyseWorkbook, markdownReport } from './workbook.ts';
const inside = (root: string,path: string) => { const rel = relative(root,path); return !rel.startsWith('..') && !isAbsolute(rel); };
async function main() {
  const {values} = parseArgs({options: {file: {type: 'string'},config: {type: 'string'},out: {type: 'string'}},args: process.argv.slice(2).filter(a => a !== '--'),strict: true});
  if (!values.file || !values.config) throw new Error('Usage: pnpm import:spreadsheet --file private.xlsx --config scripts/import/import-config.local.json');
  const project = await realpath(resolve('.'));
  await mkdir(resolve('.verification'),{recursive: true});
  const root = await realpath(resolve('.verification'));
  if (!inside(project,root)) throw new Error('Verification directory resolves outside the project.');
  const out = resolve(values.out ?? '.verification/import');
  if (!inside(root,out)) throw new Error('Reports must stay inside the ignored .verification directory.');
  // Check existing ancestors before mkdir, including symlinks/junctions.
  let ancestor = out;
  while (true) { try { const real = await realpath(ancestor); if (!inside(root,real)) throw new Error('Output resolves outside .verification.'); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; const parent = resolve(ancestor,'..'); if (parent === ancestor) throw e; ancestor = parent; } }
  const file = await realpath(resolve(values.file));
  const configFile = await realpath(resolve(values.config));
  if ((await stat(file)).size > 30*1024*1024) throw new Error('Workbook exceeds the 30 MiB analysis limit.');
  const config = JSON.parse(await readFile(values.config,'utf8'));
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(file);
  const result = analyseWorkbook(workbook,config);
  await mkdir(out,{recursive: true});
  const actual = await realpath(out); if (!inside(root,actual)) throw new Error('Output resolves outside .verification.');
  for (const [name,content] of [['plan.json',JSON.stringify(result.plan,null,2)],['report.json',JSON.stringify(result.summary,null,2)],['report.md',markdownReport(result)]] as const) {
    const target = resolve(actual,name);
    let resolvedTarget = target;
    try { resolvedTarget = await realpath(target); if (!inside(root,resolvedTarget)) throw new Error('Report target resolves outside .verification.'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    if ([file,configFile].includes(resolvedTarget)) throw new Error('Output must not overwrite workbook or config.');
    await writeFile(target,content+'\n','utf8');
  }
  console.log(JSON.stringify({dryRun: true,counts: result.summary.counts,watchOrderExactMatch: result.summary.watchOrder.exactMatch,diagnosticCount: result.summary.diagnostics.length,output: relative(process.cwd(),actual)},null,2));
}
main().catch(error => {
  const message = error instanceof Error ? error.message : '';
  // Only our fixed, safe validation messages are suitable for the console.
  const known = /^(Missing required sheet: (Tracker|Should Watch|Watch Order|Sheet2)|Unrecognised (Should Watch|Tracker) layout\.|Invalid cycle date at Tracker row \d+\.|Film before first cycle at Tracker row \d+\.|Tracker contains no recognised cycles\.|Reports must stay inside|Output resolves outside|Report target resolves outside|Verification directory resolves outside|Workbook exceeds|Usage:|Title exceeds supported length)/.test(message);
  console.error(known ? message : 'Spreadsheet analysis failed. Check file/config access, four distinct member IDs, required layouts, valid dates and output boundaries.');
  console.error('No database changes performed.'); process.exitCode=1;
});
