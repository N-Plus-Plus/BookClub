import { afterEach, expect, it, vi } from 'vitest';
import { maintainScores } from '../frontend/score-maintenance';
import type { RefreshResult } from '../shared/types';
const result=(id:string,status:'success'|'failed'='success'):RefreshResult => ({movie:{id} as RefreshResult['movie'],providers:[{provider:'mdblist',status,count:status==='success'?3:0,message:'Result'}]});
afterEach(()=>vi.useRealTimers());
it('visits a fixed deduplicated queue once in sequential maximum batches, awaiting local progress',async()=>{
 vi.useFakeTimers();let active=0,max=0;const applied:string[]=[];
 const batch=vi.fn(async(ids:string[])=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return {results:ids.map(id=>result(id))};});
 const promise=maintainScores({ids:[...Array.from({length:23},(_,i)=>String(i)),'0'],batch,stopped:()=>false,progress:async run=>{applied.push(String(run.processed));}});
 await vi.runAllTimersAsync();const run=await promise;
 expect(batch.mock.calls.map(([ids])=>ids.length)).toEqual([10,10,3]);expect(max).toBe(1);expect(run).toMatchObject({processed:23,remaining:0,total:23});expect(applied).toEqual(['10','20','23','23']);
});
it('stops after failures or requested Stop and preserves completed updates',async()=>{
 for(const failed of [true,false]) {
  let stop=false;const batch=vi.fn(async(ids:string[])=>({results:ids.map(id=>result(id,failed?'failed':'success'))}));
  const run=await maintainScores({ids:Array.from({length:21},(_,i)=>String(i)),batch,stopped:()=>stop,progress:async()=>{stop=!failed;}});
  expect(batch).toHaveBeenCalledTimes(1);expect(run.processed).toBe(10);expect(run.remaining).toBe(11);expect(run.message).toContain('Stopped');
 }
});
it('does not retry an unresolved empty rating response or a later network failure',async()=>{
 vi.useFakeTimers();const batch=vi.fn().mockResolvedValueOnce({results:[{...result('0'),providers:[{provider:'mdblist',status:'success',count:0,message:'No ratings'}]}]}).mockRejectedValueOnce(new Error('Offline'));
 const promise=maintainScores({ids:Array.from({length:11},(_,i)=>String(i)),batch,stopped:()=>false,progress:async()=>{}});await vi.runAllTimersAsync();
 const run=await promise;expect(batch).toHaveBeenCalledTimes(2);expect(run.processed).toBe(10);expect(run.results).toHaveLength(1);expect(run.message).toContain('Partial updates');
});
