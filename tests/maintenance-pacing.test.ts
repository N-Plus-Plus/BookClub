import { afterEach, expect, it, vi } from 'vitest';
import { maintainScores } from '../frontend/score-maintenance';
import { maintainMetadata } from '../frontend/metadata-maintenance';
import type { RefreshResult } from '../shared/types';
afterEach(()=>vi.useRealTimers());
it.each(['scores','metadata'])('leaves a real idle gap for %s and honours Stop during the gap',async kind=>{
 vi.useFakeTimers();let stopped=false;
 const batch=vi.fn(async(ids?:string[])=>kind==='scores'
  ? {results:ids!.map(id=>({movie:{id},providers:[{provider:'mdblist',status:'success',count:1,message:'Saved'}]} as RefreshResult))}
  : {results:[{movieId:'one',title:'One',provider:'tmdb',status:'success' as const,message:'Saved'}],remaining:2,unidentified:0});
 const progress=async()=>{};
 const pending=kind==='scores'
  ? maintainScores({ids:Array.from({length:11},(_,i)=>String(i)),batch:batch as Parameters<typeof maintainScores>[0]['batch'],stopped:()=>stopped,progress})
  : maintainMetadata({initial:{remaining:3,unidentified:0},batch:batch as Parameters<typeof maintainMetadata>[0]['batch'],stopped:()=>stopped,progress});
 await vi.advanceTimersByTimeAsync(1999);expect(batch).toHaveBeenCalledTimes(1);
 if(kind==='scores') expect(batch.mock.calls[0][0]).toEqual(Array.from({length:10},(_,i)=>String(i)));
 stopped=true;await vi.advanceTimersByTimeAsync(1);
 expect((await pending).message).toContain('Stopped');expect(batch).toHaveBeenCalledTimes(1);
});
