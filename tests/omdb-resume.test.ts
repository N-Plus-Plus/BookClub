// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ClassicsMaintenance } from '../frontend/ClassicsMaintenance';
import { api } from '../frontend/api';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { freshOmdbCheckpoint, loadOmdbCheckpoint, saveOmdbCheckpoint, reconcileOmdbCheckpoint, maintainOmdbMetadata, OMDB_CHECKPOINT_KEY } from '../frontend/omdb-maintenance';
import type { Catalog, Movie, RefreshResult, ScoreMaintenance } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:[],eligibleDimensions:0,unavailableDimensions:0,unavailableFilms:0})),maintainMovies:vi.fn()}}));
const catalog = (ids: string[]): Catalog => ({members:[],sessions:[],cycles:[],movies:ids.map(id=>({id,classic:true,external_ids:[{provider:'imdb',external_id:'tt0000001'}]} as Movie))});
const response = (ids: string[]): ScoreMaintenance => ({results:ids.map(id=>({movie:{id,title:id},providers:[{provider:'omdb',status:'success',count:0,message:'Unchanged'}]} as RefreshResult))});
const ids=Array.from({length:21},(_,i)=>`film-${i}`);
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it('creates a versioned queue, applies before checkpointing, Stop preserves it, resume skips completed IDs and completion clears it',async()=>{
 const checkpoint=freshOmdbCheckpoint(catalog(ids));saveOmdbCheckpoint(checkpoint);
 expect(loadOmdbCheckpoint()).toEqual({version:1,remainingIds:ids,completed:0});
 let stop=false,applied=false;const batch=vi.fn(async selected=>response(selected));
 const first=await maintainOmdbMetadata({checkpoint,batch,stopped:()=>stop,progress:async(run,results)=>{
  if(results){expect(loadOmdbCheckpoint()?.completed).toBe(0);applied=true;stop=true;}
 },checkpointChanged:value=>{expect(applied).toBe(true);saveOmdbCheckpoint(value);}});
 expect(first).toMatchObject({processed:10,total:21,remaining:11,message:'Stopped. Completed updates are saved.'});
 expect(loadOmdbCheckpoint()).toEqual({version:1,remainingIds:ids.slice(10),completed:10});
 const progress=vi.fn(async(_run: import('../frontend/score-maintenance').MaintenanceRun)=>{}),pending=maintainOmdbMetadata({checkpoint:loadOmdbCheckpoint()!,batch,stopped:()=>false,progress,checkpointChanged:saveOmdbCheckpoint});
 await vi.runAllTimersAsync();const last=await pending;
 expect(batch.mock.calls.map(c=>c[0])).toEqual([ids.slice(0,10),ids.slice(10,20),ids.slice(20)]);
 expect(last).toMatchObject({processed:21,total:21,remaining:0,updated:0,noChange:11});expect(loadOmdbCheckpoint()).toBeNull();
 expect(progress.mock.calls[0][0]).toMatchObject({processed:10,total:21,remaining:11});
});
it.each(['HTTP 500','Transport failed','Application failed'])('keeps failed batches pending: %s',async message=>{
 const checkpoint=freshOmdbCheckpoint(catalog(ids));saveOmdbCheckpoint(checkpoint);
 const run=await maintainOmdbMetadata({checkpoint,batch:async()=>{throw new Error(message);},stopped:()=>false,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 expect(run).toMatchObject({processed:0,remaining:21});expect(loadOmdbCheckpoint()).toEqual(checkpoint);
});
it('does not acknowledge a batch if applying returned films fails',async()=>{
 const checkpoint=freshOmdbCheckpoint(catalog(ids));saveOmdbCheckpoint(checkpoint);
 await maintainOmdbMetadata({checkpoint,batch:async ids=>response(ids),stopped:()=>false,progress:async(_run,results)=>{if(results)throw new Error('Apply failed');},checkpointChanged:saveOmdbCheckpoint});
 expect(loadOmdbCheckpoint()).toEqual(checkpoint);
});
it('keeps blocking/cooldown batches pending without automatic retries',async()=>{
 const checkpoint=freshOmdbCheckpoint(catalog(ids));saveOmdbCheckpoint(checkpoint);
 const batch=vi.fn(async selected=>{const r=response(selected);r.results[0].providers=[{provider:'omdb',status:'failed',count:0,message:'Cooldown',blocking:true,retryAfter:60}];return r;});
 await maintainOmdbMetadata({checkpoint,batch,stopped:()=>false,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 expect(batch).toHaveBeenCalledTimes(1);expect(loadOmdbCheckpoint()).toEqual(checkpoint);
});
it('continues through the existing isolated non-blocking film failure outcome',async()=>{
 const checkpoint=freshOmdbCheckpoint(catalog(['one']));saveOmdbCheckpoint(checkpoint);
 const r=response(['one']);r.results[0].providers=[{provider:'omdb',status:'failed',count:0,message:'Not found',blocking:false}];
 const run=await maintainOmdbMetadata({checkpoint,batch:async()=>r,stopped:()=>false,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 expect(run.failed).toBe(1);expect(loadOmdbCheckpoint()).toBeNull();
});
it('rejects incomplete or mismatched batch responses without skipping films',async()=>{
 const checkpoint=freshOmdbCheckpoint(catalog(['one','two']));saveOmdbCheckpoint(checkpoint);
 await maintainOmdbMetadata({checkpoint,batch:async()=>response(['two']),stopped:()=>false,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 expect(loadOmdbCheckpoint()).toEqual(checkpoint);
});
it('reconciles deleted, invalid-identity and out-of-scope IDs in frozen order, without appending new films',()=>{
 const checkpoint={version:1 as const,remainingIds:['third','deleted','invalid','orphan','first'],completed:390};
 const current=catalog(['first','third','invalid','orphan','new']);current.movies[2].external_ids=[];current.movies[3].classic=false;
 expect(reconcileOmdbCheckpoint(checkpoint,current)).toEqual({version:1,remainingIds:['third','first'],completed:390});
});
it.each(['bad JSON',JSON.stringify({version:2,remainingIds:['one'],completed:0}),JSON.stringify({version:1,remainingIds:['one','one'],completed:0}),JSON.stringify({version:1,remainingIds:['one'],completed:-1}),JSON.stringify({version:1,remainingIds:[1],completed:0})])('discards corrupt or incompatible checkpoints: %s',raw=>{
 localStorage.setItem(OMDB_CHECKPOINT_KEY,raw);expect(loadOmdbCheckpoint()).toBeNull();expect(localStorage.getItem(OMDB_CHECKPOINT_KEY)).toBeNull();
});
it('unavailable storage falls back without failing a run',async()=>{
 vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new Error('Denied');});
 expect(loadOmdbCheckpoint()).toBeNull();const checkpoint=freshOmdbCheckpoint(catalog(['one']));
 expect(()=>saveOmdbCheckpoint(checkpoint)).not.toThrow();
 const run=await maintainOmdbMetadata({checkpoint,batch:async ids=>response(ids),stopped:()=>false,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 expect(run).toMatchObject({processed:1,remaining:0});
});
it('explicit discard allows a fresh current queue including newly created films',()=>{
 saveOmdbCheckpoint({version:1,remainingIds:['old'],completed:390});saveOmdbCheckpoint(null);
 expect(loadOmdbCheckpoint()).toBeNull();saveOmdbCheckpoint(freshOmdbCheckpoint(catalog(['old','new'])));
 expect(loadOmdbCheckpoint()).toEqual({version:1,remainingIds:['old','new'],completed:0});
});

it('Admin persists before sending, navigation preserves the successful in-flight batch, and remount resumes with progress',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const element=document.createElement('div');document.body.appendChild(element);let root=createRoot(element);
 const props={catalog:catalog(ids),writesEnabled:true,onMovie:vi.fn()};
 let resolve!: (value: ScoreMaintenance)=>void;
 vi.mocked(api.maintainMovies).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 await act(async()=>{root.render(createElement(ClassicsMaintenance,props));});
 const button=(text:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===text)!;
 await act(async()=>{button('Enrich/Refresh Metadata').click();});
 expect(loadOmdbCheckpoint()).toEqual(freshOmdbCheckpoint(props.catalog));
 expect(api.maintainMovies).toHaveBeenLastCalledWith('metadata',ids.slice(0,10));
 await act(async()=>{root.unmount();});expect(loadOmdbCheckpoint()?.completed).toBe(0);
 await act(async()=>{resolve(response(ids.slice(0,10)));});
 expect(loadOmdbCheckpoint()).toEqual({version:1,completed:10,remainingIds:ids.slice(10)});
 root=createRoot(element);await act(async()=>{root.render(createElement(ClassicsMaintenance,props));});
 expect(button('Resume Metadata \u00b7 11 remaining')).toBeTruthy();
 vi.mocked(api.maintainMovies).mockRejectedValueOnce(new Error('HTTP 500'));
 await act(async()=>{button('Resume Metadata \u00b7 11 remaining').click();});
 expect(api.maintainMovies).toHaveBeenLastCalledWith('metadata',ids.slice(10,20));
 expect(element.textContent).toContain('10 / 21 films processed');expect(loadOmdbCheckpoint()?.completed).toBe(10);
 await act(async()=>{button('Discard metadata progress').click();});expect(loadOmdbCheckpoint()).toBeNull();
 vi.mocked(api.maintainMovies).mockRejectedValueOnce(new Error('HTTP 500'));
 await act(async()=>{button('Enrich/Refresh Metadata').click();});
 expect(api.maintainMovies).toHaveBeenLastCalledWith('metadata',ids.slice(0,10));expect(loadOmdbCheckpoint()?.completed).toBe(0);
 await act(async()=>{root.unmount();});element.remove();
});
it('metadata resume retains ten-film batch bounds, two-second pacing and Stop during idle',async()=>{
 const checkpoint=freshOmdbCheckpoint(catalog(ids));let stop=false;
 const batch=vi.fn(async selected=>response(selected));
 const pending=maintainOmdbMetadata({checkpoint,batch,stopped:()=>stop,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 await vi.advanceTimersByTimeAsync(1999);expect(batch).toHaveBeenCalledTimes(1);expect(batch.mock.calls[0][0]).toHaveLength(10);
 stop=true;await vi.advanceTimersByTimeAsync(1);expect((await pending).remaining).toBe(11);expect(loadOmdbCheckpoint()?.completed).toBe(10);
});

it('counts attempted outcomes while keeping the final quota-blocked ten-film batch pending for resume',async()=>{
 const all=Array.from({length:975},(_,i)=>`film-${i}`),checkpoint=freshOmdbCheckpoint(catalog(all));saveOmdbCheckpoint(checkpoint);
 let calls=0;
 const batch=vi.fn(async selected=>{
  const r=response(selected);calls++;
  if(calls===1) for(const item of r.results.slice(0,6)) item.providers[0].count=1;
  if(calls===29) r.results[9].providers=[{provider:'omdb',status:'failed',count:0,blocking:true,retryAfter:86400,message:'OMDb quota/rate limit reached. Try later.'}];
  return r;
 });
 const pending=maintainOmdbMetadata({checkpoint,batch,stopped:()=>false,progress:async()=>{},checkpointChanged:saveOmdbCheckpoint});
 await vi.runAllTimersAsync();
 expect(await pending).toMatchObject({processed:280,total:975,remaining:695,updated:6,noChange:284,failed:1});
 expect(batch).toHaveBeenCalledTimes(29);
 expect(loadOmdbCheckpoint()).toEqual({version:1,completed:280,remainingIds:all.slice(280)});
 const retry=vi.fn(async selected=>response(selected));let stop=false;
 await maintainOmdbMetadata({checkpoint:loadOmdbCheckpoint()!,batch:retry,stopped:()=>stop,progress:async(_run,results)=>{if(results)stop=true;},checkpointChanged:saveOmdbCheckpoint});
 expect(retry).toHaveBeenCalledExactlyOnceWith(all.slice(280,290));
 expect(loadOmdbCheckpoint()?.completed).toBe(290);
});
