import { afterEach, expect, it, vi } from 'vitest';
import { maintainScores } from '../frontend/score-maintenance';
import type { RefreshResult } from '../shared/types';
const result=(id:string,status:'success'|'failed'='success'):RefreshResult => ({movie:{id} as RefreshResult['movie'],providers:[{provider:'mdblist',status,count:status==='success'?3:0,message:'Result',...(status==='failed'?{blocking:true}:{})}]});
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
 const run=await promise;expect(batch).toHaveBeenCalledTimes(2);expect(run.processed).toBe(10);expect(run).not.toHaveProperty('results');expect(run.noChange).toBe(1);expect(run.message).toContain('Partial updates');
});

it('discards film details after applying each batch during a 980-film run',async()=>{
 vi.useFakeTimers();let applied=0,maxRetained=0;
 const promise=maintainScores({ids:Array.from({length:980},(_,i)=>String(i)),batch:async ids=>({results:ids.map(id=>result(id))}),stopped:()=>false,
 progress:async(run,batch)=>{applied+=batch?.length??0;expect(run).not.toHaveProperty('results');}});
 await vi.runAllTimersAsync();const run=await promise;
 expect(applied).toBe(980);expect(maxRetained).toBe(0);expect(run).toMatchObject({processed:980,updated:980,remaining:0});expect(run.providers.length).toBeLessThanOrEqual(9);
});

it('continues after isolated failures, retains every film title and finishes with unresolved films',async()=>{
 vi.useFakeTimers();
 const batch=vi.fn(async(ids:string[])=>({results:ids.map(id=>id==='0'||id==='1'?{
  ...result(id,'failed'),movie:{id,title:`Film ${id}`} as RefreshResult['movie'],providers:[{provider:'mdblist',status:'failed' as const,count:0,message:'Not found',blocking:false}],
 }:result(id))}));
 const promise=maintainScores({ids:Array.from({length:21},(_,i)=>String(i)),batch,stopped:()=>false,progress:async()=>{}});
 await vi.runAllTimersAsync();const run=await promise;
 expect(batch).toHaveBeenCalledTimes(3);expect(run).toMatchObject({processed:21,remaining:0,failed:2,updated:19});
 expect(run.message).toBe('Finished with 2 unresolved films. Completed updates are saved.');
 expect(run.providers.filter(p=>p.status==='failed').map(p=>p.filmTitle)).toEqual(['Film 0','Film 1']);
});
it.each([
 {status:'failed' as const,blocking:true},
 {status:'failed' as const}, // An independently deployed older Worker remains conservative.
 {status:'skipped' as const,blocking:true},
 {status:'failed' as const,blocking:false,retryAfter:60},
])('stops on explicit blocking failures, older responses and any cooldown: %j',async(provider)=>{
 const batch=vi.fn(async()=>({results:[{...result('0'),providers:[{provider:'mdblist',count:0,message:'Unavailable',...provider}]}]}));
 const run=await maintainScores({ids:Array.from({length:11},(_,i)=>String(i)),batch,stopped:()=>false,progress:async()=>{}});
 expect(batch).toHaveBeenCalledTimes(1);expect(run.message).toContain('provider failure or cooldown');expect(run.remaining).toBe(1);
});
it('honours Stop after a batch containing an isolated failure',async()=>{
 let stop=false;
 const batch=vi.fn(async()=>({results:[{...result('0','failed'),providers:[{provider:'mdblist',status:'failed' as const,count:0,message:'Not found',blocking:false}]}]}));
 const run=await maintainScores({ids:Array.from({length:11},(_,i)=>String(i)),batch,stopped:()=>stop,progress:async()=>{stop=true;}});
 expect(batch).toHaveBeenCalledTimes(1);expect(run.failed).toBe(1);expect(run.message).toBe('Stopped. Completed updates are saved.');
});
