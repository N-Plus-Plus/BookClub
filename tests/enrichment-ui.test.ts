// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminScreen } from '../frontend/AdminScreen';
import { api } from '../frontend/api';
import type { Catalog } from '../shared/types';
import type { EnrichmentBatch } from '../shared/enrichment';
vi.mock('../frontend/api',()=>({api:{scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:[],eligibleDimensions:0,unavailableDimensions:0,unavailableFilms:0})),enrichProvider:vi.fn(),enrichMetadataSelected:vi.fn(),maintainMovies:vi.fn()}}));
const catalog:Catalog={members:[],sessions:[],cycles:[],movies:Array.from({length:12},(_,i)=>({id:`film-${i}`,title:`Film ${i}`,original_title:null,year:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],scores:[],seen:[],classic:true,ranking:null,external_ids:i<11?[{provider:'tmdb',external_id:String(i+1)}]:[]}))};
let root:Root,container:HTMLDivElement;const updated=vi.fn(async()=>{}),cacheChanged=vi.fn();
const button=(name:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
const render=async()=>{await act(async()=>root.render(createElement(AdminScreen,{catalog,writesEnabled:true,onMovie:()=>{},onUpdated:updated,onEnrichmentChanged:cacheChanged})));};
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
it.each(['TMDB','MDBList'])('%s runs remain interactive, disable other maintenance and Stop retains saved progress',async label=>{
  let resolve!:(value:EnrichmentBatch)=>void;
  vi.mocked(api.enrichProvider).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();
  expect(container.textContent).toContain('11 eligible films · 1 without a valid');
  await act(async()=>button(`Refresh ${label} enrichment`).click());
  const other=label==='TMDB'?'MDBList':'TMDB';expect(button(`Refresh ${other} enrichment`).disabled).toBe(true);expect(button('Fill missing TMDB metadata').disabled).toBe(true);expect(button('Refresh scores').disabled).toBe(true);
  // A pending network request does not prevent immediate interaction with Stop.
  await act(async()=>button('Stop after this batch').click());expect(vi.mocked(api.enrichProvider)).toHaveBeenCalledTimes(1);
  const ids=vi.mocked(api.enrichProvider).mock.calls[0][1];
  await act(async()=>resolve({results:ids.map(movieId=>({movieId,status:'updated',message:'Saved'})),canonicalChanged:false}));
  expect(container.textContent).toContain(`${ids.length} / 11 processed`);expect(container.textContent).toContain('Stopped. Completed updates are saved');expect(button(`Refresh ${other} enrichment`).disabled).toBe(false);
  const checkpoint=JSON.parse(localStorage.getItem(`bookclub.${label==='TMDB'?'tmdb':'mdblist'}-enrichment.v1`)!);expect(checkpoint.completed).toBe(ids.length);expect(checkpoint.remainingIds).toHaveLength(11-ids.length);expect(updated).toHaveBeenCalledTimes(label==='TMDB'?1:0);expect(cacheChanged).toHaveBeenCalledOnce();
});
it('refreshes shared data once only when canonical IDs changed and shows local provider errors/quota',async()=>{
  vi.mocked(api.enrichProvider).mockResolvedValue({results:[{movieId:'film-0',status:'updated',message:'Saved'},{movieId:'film-1',status:'failed',blocking:true,message:'Provider unavailable',retryAfter:60}],canonicalChanged:true,quota:{'X-RateLimit-Remaining':'25'},stopped:true});await render();
  await act(async()=>button('Refresh TMDB enrichment').click());
  expect(updated).toHaveBeenCalledTimes(1);expect(container.querySelector('#tmdb-enrichment-heading')?.closest('section')?.textContent).toContain('Provider unavailable');expect(container.textContent).toContain('25');
  expect(container.querySelector('#mdblist-enrichment-heading')?.closest('section')?.textContent).not.toContain('Provider unavailable');
});
it('navigation/unmount stops after accepted pending batch and remount offers Resume',async()=>{
  let resolve!:(value:EnrichmentBatch)=>void;vi.mocked(api.enrichProvider).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();
  await act(async()=>button('Refresh TMDB enrichment').click());const ids=vi.mocked(api.enrichProvider).mock.calls[0][1];
  await act(async()=>root.render(createElement('div',null,'Elsewhere')));await act(async()=>resolve({results:ids.map(movieId=>({movieId,status:'updated',message:'Saved'})),canonicalChanged:false}));
  expect(cacheChanged).toHaveBeenCalledOnce();await render();expect(button('Resume TMDB enrichment · 9 remaining')).toBeTruthy();expect(api.enrichProvider).toHaveBeenCalledTimes(1);
});
it.each([false,true])('MDBList progress and Resume agree for mixed results (partial=%s)',async partial=>{
  vi.mocked(api.enrichProvider).mockImplementation(async(_provider,ids)=>({results:(partial?ids.slice(0,2):ids).map((movieId,i)=>i===1?{movieId,status:'failed',message:'Unavailable',blocking:false}:{movieId,status:'updated',message:'Saved'}),canonicalChanged:false,stopped:true}));
  await render();await act(async()=>button('Refresh MDBList enrichment').click());
  const saved=JSON.parse(localStorage.getItem('bookclub.mdblist-enrichment.v1')!);
  expect(saved.remainingIds).toContain('film-1');expect(saved.remainingIds).toHaveLength(partial?10:2);
  const section=container.querySelector('#mdblist-enrichment-heading')!.closest('section')!;
  expect(section.querySelector('[role="status"]')?.textContent).toContain(`${partial?2:10} / 11 processed · ${saved.remainingIds.length} remaining`);
  expect(button(`Resume MDBList enrichment · ${saved.remainingIds.length} remaining`)).toBeTruthy();
  expect(api.enrichProvider).toHaveBeenCalledTimes(1);
});

it('unchanged provider batches keep the existing Metrics projection reusable',async()=>{
  vi.mocked(api.enrichProvider).mockResolvedValue({results:[{movieId:'film-0',status:'no_change',message:'Unchanged'}],canonicalChanged:false,stopped:true});
  await render();await act(async()=>button('Refresh TMDB enrichment').click());
  expect(cacheChanged).not.toHaveBeenCalled();expect(updated).not.toHaveBeenCalled();
});
