import { readFile, writeFile, mkdir, realpath, stat, rename } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { configSchema } from './workbook.ts';
export class ImportError extends Error {}
const inside = (root: string,path: string) => { const rel=relative(root,path); return rel !== '..' && !rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`) && !isAbsolute(rel); };
export async function readJson(path: string,kind: string): Promise<unknown> {
  let content: string;
  try { content=await readFile(path,'utf8'); } catch (e) { throw new ImportError((e as NodeJS.ErrnoException).code==='ENOENT' ? `${kind} file not found: ${path}` : `${kind} file cannot be read: ${path}`); }
  try { return JSON.parse(content); } catch { throw new ImportError(`Invalid JSON in ${kind} file: ${path}`); }
}
export async function readConfig(path: string) {
  const parsed=configSchema.safeParse(await readJson(path,'Config'));
  if (!parsed.success) throw new ImportError('Invalid config: four distinct member IDs, valid importSource and optional ISO snapshotCapturedAt are required.');
  return parsed.data;
}
export async function inputFile(path: string) {
  try { const actual=await realpath(resolve(path)); const info=await stat(actual); if(!info.isFile()) throw new Error(); if(info.size>30*1024*1024) throw new ImportError('Workbook exceeds the 30 MiB analysis limit.'); return actual; }
  catch(e) { if(e instanceof ImportError) throw e; throw new ImportError(`Workbook not found or unreadable: ${path}`); }
}
export async function outputDirectory(path='.verification/import') {
  const project=await realpath(resolve('.')), verification=resolve(project,'.verification'), out=resolve(path);
  if(!inside(verification,out)) throw new ImportError('Invalid output path: reports must stay inside .verification.');
  let ancestor=out;
  while(true) { try { const actual=await realpath(ancestor); if(!inside(project,actual) || (inside(verification,ancestor) && !inside(verification,actual))) throw new ImportError('Invalid output path: symlink/junction escapes .verification.'); break; }
    catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; ancestor=dirname(ancestor); } }
  await mkdir(out,{recursive:true}); const actual=await realpath(out);
  if(!inside(verification,actual)) throw new ImportError('Invalid output path: resolves outside .verification.'); return actual;
}
export async function writeReport(out: string,name: string,value: unknown) {
  const target=resolve(out,name); if(!inside(out,target)) throw new ImportError('Invalid report path.');
  try { const actual=await realpath(target); if(actual!==target) throw new ImportError('Report target must not be a symlink.'); } catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; }
  const content=typeof value==='string'?value:JSON.stringify(value,null,2), temporary=`${target}.${randomUUID()}.tmp`;
  await writeFile(temporary,content+'\n',{encoding:'utf8',flag:'wx'}); await rename(temporary,target);
}
export async function protectInputs(out:string,inputs:string[],names:string[]) {
  const targets=names.map(name=>resolve(out,name));
  for(const input of inputs)if(targets.includes(await realpath(resolve(input))))throw new ImportError('Output must not overwrite a workbook, plan, config or private overrides input.');
}
export function safeFailure(error: unknown) {
  const message=error instanceof Error?error.message:'';
  const parserSafe=/^(Missing required sheet: (Tracker|Should Watch|Watch Order|Sheet2)|Unrecognised (Should Watch|Tracker) layout\.|Invalid cycle date at Tracker row \d+\.|Film before first cycle at Tracker row \d+\.|Tracker contains no recognised cycles\.|Title exceeds supported length at (Tracker|Should Watch) row \d+\.)$/.test(message);
  console.error(error instanceof ImportError || parserSafe ? message : 'Import validation or operation failed. No sensitive exception details are shown; check local inputs and permissions.'); process.exitCode=1;
}
