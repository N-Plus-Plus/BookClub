import { afterEach, expect, it, vi } from 'vitest';
import { maintainEnrichment } from '../frontend/enrichment-maintenance';
import type { MaintenanceCheckpoint } from '../frontend/maintenance-checkpoint';
import { loadMaintenanceCheckpoint, saveMaintenanceCheckpoint } from '../frontend/maintenance-checkpoint';
import type { EnrichmentBatch } from '../shared/enrichment';
afterEach(()=>vi.useRealTimers());
const checkpoint=(n: number):MaintenanceCheckpoint=>({version:1,remainingIds:Array.from({length:n},(_,i)=>`film-${i}`),completed:0});
const result=(ids:string[]):EnrichmentBatch=>({results:ids.map(movieId=>({movieId,status:'updated',message:'Saved'})),canonicalChanged:false});
it.each(['tmdb','mdblist'] as const)('%s freezes bounded queues, yields two seconds, never overlaps or retains provider responses',async provider=>{
  vi.useFakeTimers();const saved=checkpoint(provider==='tmdb'?7:23),events:string[][]=[],progress=vi.fn(),checkpointChanged=vi.fn();let active=0;
  const batch=vi.fn(async(ids:string[])=>{expect(active++).toBe(0);events.push(ids);await new Promise(resolve=>setTimeout(resolve,50));active--;return result(ids);});
  const pending=maintainEnrichment({provider,checkpoint:saved,batch,progress,checkpointChanged,stopped:()=>false});saved.remainingIds.reverse();
  await vi.advanceTimersByTimeAsync(2049);expect(batch).toHaveBeenCalledTimes(1);
  await vi.runAllTimersAsync();const run=await pending;expect(events.flat()).toEqual(checkpoint(provider==='tmdb'?7:23).remainingIds);
  expect(events.every(e=>e.length<=(provider==='tmdb'?2:10))).toBe(true);expect(run.remaining).toBe(0);expect(run.updated).toBe(run.total);expect(run).not.toHaveProperty('results');expect(checkpointChanged).toHaveBeenLastCalledWith(null);
});
it('Stop after a delayed batch retains accepted checkpoint progress and never launches another request',async()=>{
  let stop=false,resolve!:(response:EnrichmentBatch)=>void;const batch=vi.fn(()=>new Promise<EnrichmentBatch>(done=>{resolve=done;})),checkpointChanged=vi.fn();
  const pending=maintainEnrichment({provider:'tmdb',checkpoint:checkpoint(5),batch,checkpointChanged,progress:()=>{},stopped:()=>stop});
  stop=true;resolve(result(['film-0','film-1']));const run=await pending;
  expect(batch).toHaveBeenCalledTimes(1);expect(run).toMatchObject({processed:2,remaining:3,updated:2});expect(run.message).toContain('Stopped');
  expect(checkpointChanged).toHaveBeenLastCalledWith({version:1,completed:2,remainingIds:['film-2','film-3','film-4']});
});
it('provider-wide failure retains failed/unprocessed films, acknowledges earlier success and stops subsequent batches',async()=>{
  const batch=vi.fn(async()=>({results:[{movieId:'film-0',status:'updated' as const,message:'Saved'},{movieId:'film-1',status:'failed' as const,message:'Rate limited',blocking:true,retryAfter:120}],canonicalChanged:true,stopped:true})),checkpointChanged=vi.fn();
  const run=await maintainEnrichment({provider:'tmdb',checkpoint:checkpoint(5),batch,checkpointChanged,progress:()=>{},stopped:()=>false});
  expect(batch).toHaveBeenCalledTimes(1);expect(run).toMatchObject({processed:2,remaining:4,updated:1,failed:1,canonicalChanged:true});expect(run.failure).toContain('2 min');
  expect(checkpointChanged).toHaveBeenLastCalledWith({version:1,completed:1,remainingIds:['film-1','film-2','film-3','film-4']});
});
it('mixed MDBList results count failed films as remaining while processed counts every result',async()=>{
  const saved=checkpoint(10),checkpointChanged=vi.fn(),progress=vi.fn();
  const batch=vi.fn(async():Promise<EnrichmentBatch>=>({results:saved.remainingIds.map((movieId,i)=>i===9?{movieId,status:'failed',message:'Unavailable',blocking:false}:{movieId,status:i<5?'updated':'no_change',message:'Saved'}),canonicalChanged:false}));
  const run=await maintainEnrichment({provider:'mdblist',checkpoint:saved,batch,checkpointChanged,progress,stopped:()=>false});
  expect(run).toMatchObject({processed:10,total:10,remaining:1,updated:5,noChange:4,failed:1});
  expect(checkpointChanged).toHaveBeenLastCalledWith({version:1,completed:9,remainingIds:['film-9']});
  expect(progress).toHaveBeenLastCalledWith(run);
});
it('stopped partial batches retain both failed and unattempted films in displayed remaining',async()=>{
  const checkpointChanged=vi.fn(),batch=vi.fn(async():Promise<EnrichmentBatch>=>({results:[{movieId:'film-0',status:'no_change',message:'Unchanged'},{movieId:'film-1',status:'failed',message:'Quota reached',blocking:true}],canonicalChanged:false,stopped:true}));
  const run=await maintainEnrichment({provider:'mdblist',checkpoint:checkpoint(10),batch,checkpointChanged,progress:()=>{},stopped:()=>false});
  expect(run).toMatchObject({processed:2,total:10,remaining:9,noChange:1,failed:1});
  expect(checkpointChanged).toHaveBeenLastCalledWith({version:1,completed:1,remainingIds:checkpoint(10).remainingIds.slice(1)});
  expect(batch).toHaveBeenCalledTimes(1);expect(run.message).toContain('Stopped');
});
it('transport and stale/duplicate batch responses preserve checkpoint, and resume carries completed count',async()=>{
  const saved={...checkpoint(3),completed:7};
  for (const response of [undefined,{results:[{movieId:'wrong',status:'updated',message:'Wrong'}],canonicalChanged:false},{results:[{movieId:'film-0',status:'updated',message:'Duplicate'},{movieId:'film-0',status:'updated',message:'Duplicate'}],canonicalChanged:false}]) {
    const checkpointChanged=vi.fn(),batch=vi.fn(async()=>{if(!response)throw Error('Offline');return response as EnrichmentBatch;});
    const run=await maintainEnrichment({provider:'tmdb',checkpoint:saved,batch,checkpointChanged,progress:()=>{},stopped:()=>false});
    expect(checkpointChanged).not.toHaveBeenCalled();expect(run).toMatchObject({processed:7,total:10,remaining:3});expect(run.message).toBeTruthy();
  }
});
it('reuses versioned operational-only checkpoint storage with safe corruption and storage-denial handling',()=>{
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  saveMaintenanceCheckpoint('tmdb',checkpoint(3),storage);expect(loadMaintenanceCheckpoint('tmdb',storage)).toEqual(checkpoint(3));expect(loadMaintenanceCheckpoint('mdblist',storage)).toBeNull();
  values.set('tmdb','{"version":2,"token":"private"}');expect(loadMaintenanceCheckpoint('tmdb',storage)).toBeNull();expect(values.has('tmdb')).toBe(false);
  const denied={...storage,setItem:()=>{throw Error('Denied');}};expect(()=>saveMaintenanceCheckpoint('tmdb',checkpoint(3),denied)).not.toThrow();
});
