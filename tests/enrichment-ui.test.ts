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
let root:Root,container:HTMLDivElement;const updated=vi.fn(async()=>{});
const button=(name:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
const render=async()=>{await act(async()=>root.render(createElement(AdminScreen,{catalog,writesEnabled:true,onMovie:()=>{},onUpdated:updated})));};
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
it.each(['TMDB','MDBList'])('%s runs remain interactive, disable other maintenance and Stop retains saved progress',async label=>{
  let resolve!:(value:EnrichmentBatch)=>void;
  vi.mocked(api.enrichProvider).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();
  expect(container.textContent).toContain('11 eligible films · 1 without a valid');
  await act(async()=>button(`Refresh ${label} enrichment`).click());
  const other=label==='TMDB'?'MDBList':'TMDB';expect(button(`Refresh ${other} enrichment`).disabled).toBe(true);expect(button('Fill missing metadata').disabled).toBe(true);expect(button('Refresh Scores').disabled).toBe(true);
  // A pending network request does not prevent immediate interaction with Stop.
  await act(async()=>button('Stop after this batch').click());expect(vi.mocked(api.enrichProvider)).toHaveBeenCalledTimes(1);
  const ids=vi.mocked(api.enrichProvider).mock.calls[0][1];
  await act(async()=>resolve({results:ids.map(movieId=>({movieId,status:'updated',message:'Saved'})),canonicalChanged:false}));
  expect(container.textContent).toContain(`${ids.length} / 11 processed`);expect(container.textContent).toContain('Stopped. Completed updates are saved');expect(button(`Refresh ${other} enrichment`).disabled).toBe(false);
  const checkpoint=JSON.parse(localStorage.getItem(`bookclub.${label==='TMDB'?'tmdb':'mdblist'}-enrichment.v1`)!);expect(checkpoint.completed).toBe(ids.length);expect(checkpoint.remainingIds).toHaveLength(11-ids.length);expect(updated).not.toHaveBeenCalled();
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
  await render();expect(button('Resume TMDB enrichment · 9 remaining')).toBeTruthy();expect(api.enrichProvider).toHaveBeenCalledTimes(1);
});
