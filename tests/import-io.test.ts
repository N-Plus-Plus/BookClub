import { describe,it,expect,vi } from 'vitest';
import { mkdir,writeFile,rm,symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readJson,readConfig,inputFile,outputDirectory,writeReport,protectInputs,safeFailure,ImportError } from '../scripts/import/io';
import viteConfig from '../vite.config';
describe('safe importer operation errors and output boundaries',()=>{
 it('pins preview UI requests to localhost independently of production env configuration',async()=>{
  const preview=await viteConfig({command:'serve',mode:'import-preview',isPreview:false});
  expect(preview.define?.['import.meta.env.VITE_API_BASE_URL']).toBe(JSON.stringify('http://localhost:8787'));
  const build=await viteConfig({command:'build',mode:'production',isPreview:false});expect(build.define).toBeUndefined();
 });
 it('distinguishes missing workbook/config and invalid JSON/config without echoing contents',async()=>{
  await expect(inputFile('.verification/missing-workbook.xlsx')).rejects.toThrow('Workbook not found');
  await expect(readConfig('.verification/missing-config.local.json')).rejects.toThrow('Config file not found');
  const dir=await outputDirectory('.verification/import/io-test');
  await writeFile(resolve(dir,'invalid.json'),'{secret-invalid');await expect(readJson(resolve(dir,'invalid.json'),'Config')).rejects.toThrow('Invalid JSON');
  await writeFile(resolve(dir,'invalid.json'),JSON.stringify({memberIds:['a','a','b','c'],secret:'do-not-print'}));await expect(readConfig(resolve(dir,'invalid.json'))).rejects.toThrow('four distinct member IDs');
  const error=vi.spyOn(console,'error').mockImplementation(()=>{}),previous=process.exitCode;
  try{safeFailure(new Error('do-not-print'));expect(JSON.stringify(error.mock.calls)).not.toContain('do-not-print');safeFailure(new ImportError('Config file not found: supplied.json'));expect(error).toHaveBeenLastCalledWith('Config file not found: supplied.json');}finally{error.mockRestore();process.exitCode=previous;}
 });
 it('rejects escaping output, junctions, report symlinks and input overwrite',async()=>{
  await expect(outputDirectory('scripts/import')).rejects.toThrow('Invalid output path');
  const dir=await outputDirectory('.verification/import/io-boundary-test'),outside=resolve('.verification/io-other');await mkdir(outside,{recursive:true});
  const junction=resolve(dir,'junction');await rm(junction,{force:true});await symlink(outside,junction,'junction');
  await expect(outputDirectory(resolve(junction,'child'))).resolves.toBeDefined(); // Still inside ignored verification.
  await rm(junction,{force:true});await symlink(resolve('scripts'),junction,'junction');await expect(outputDirectory(resolve(junction,'child'))).rejects.toThrow('escapes');await rm(junction,{force:true});
  const input=resolve(dir,'plan.json');await writeFile(input,'{}');await expect(protectInputs(dir,[input],['plan.json'])).rejects.toThrow('overwrite');
  const target=resolve(dir,'report.json');await rm(target,{force:true});
  // Windows junctions cover directory escapes; file symlinks need elevated OS privileges, so avoid them here.
  await writeReport(dir,'report.json',{safe:true});await expect(readJson(target,'Report')).resolves.toEqual({safe:true});
 });
});
