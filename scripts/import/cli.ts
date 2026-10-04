import ExcelJS from 'exceljs';
import { parseArgs } from 'node:util';
import { analyseWorkbook, markdownReport } from './workbook.ts';
import { ImportError, inputFile, readConfig, outputDirectory, writeReport, safeFailure, protectInputs } from './io.ts';
async function main() {
  const {values}=parseArgs({options:{file:{type:'string'},config:{type:'string'},out:{type:'string'}},args:process.argv.slice(2).filter(a=>a!=='--'),strict:true});
  if(!values.file || !values.config) throw new ImportError('Usage: pnpm import:spreadsheet --file private.xlsx --config scripts/import/import-config.local.json');
  const file=await inputFile(values.file), config=await readConfig(values.config), out=await outputDirectory(values.out);
  await protectInputs(out,[file,values.config],['plan.json','report.json','report.md']);
  const workbook=new ExcelJS.Workbook(); try { await workbook.xlsx.readFile(file); } catch { throw new ImportError('Workbook validation failed: unreadable or corrupt XLSX.'); }
  const result=analyseWorkbook(workbook,config);
  for(const [name,content] of [['plan.json',result.plan],['report.json',result.summary],['report.md',markdownReport(result)]] as const) await writeReport(out,name,content);
  console.log(JSON.stringify({dryRun:true,counts:result.summary.counts,watchOrderExactMatch:result.summary.watchOrder.exactMatch,diagnostics:result.summary.diagnostics.reduce<Record<string,number>>((a,d)=>(a[d.code]=(a[d.code]??0)+1,a),{})},null,2));
}
main().catch(safeFailure);
