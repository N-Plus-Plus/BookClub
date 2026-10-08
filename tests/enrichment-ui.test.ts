// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminScreen } from '../frontend/AdminScreen';
import { api } from '../frontend/api';
import type { Catalog } from '../shared/types';
import type { MaintenanceBatchResult } from '../shared/maintenance-plan';
vi.mock('../frontend/api',()=>({api:{maintenanceCoverage:vi.fn(),maintenanceProvider:vi.fn()}}));
const catalog:Catalog={members:[],sessions:[],cycles:[],movies:Array.from({length:12},(_,i)=>({id:`film-${i}`,title:`Film ${i}`,original_title:null,year:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],scores:[],seen:[],classic:true,ranking:null,external_ids:i<11?[{provider:'tmdb',external_id:String(i+1)}]:[]}))};
let root:Root,container:HTMLDivElement;const updated=vi.fn(async()=>{}),cacheChanged=vi.fn();
const button=(name:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
const render=async(writesEnabled=true)=>{await act(async()=>root.render(createElement(AdminScreen,{catalog,writesEnabled,onMovie:()=>{},onUpdated:updated,onEnrichmentChanged:cacheChanged})));};
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};vi.mocked(api.maintenanceCoverage).mockResolvedValue({checks:[],negativeScores:[],enrichment:[],unavailable:{tmdb:null,omdb:null,mdblist:null},next:null});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
it.each(['TMDB','MDBList'])('%s actions hold the whole lock and Stop saves only accepted work',async label=>{
 let resolve!:(value:MaintenanceBatchResult)=>void;vi.mocked(api.maintenanceProvider).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();
 await act(async()=>button(`Refresh ${label} enrichment`).click());
 expect(button('Populate missing data').disabled).toBe(true);expect(button('Refresh all data').disabled).toBe(true);expect(button('Refresh scores').disabled).toBe(true);
 await act(async()=>button('Stop after this batch').click());const units=vi.mocked(api.maintenanceProvider).mock.calls[0][1];
 await act(async()=>resolve({results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'updated',message:'Saved'})),canonicalChanged:label==='TMDB',cacheChanged:true}));
 const key=`bookclub.maintenance.refresh.${label==='TMDB'?'tmdb':'mdblist'}-enrichment.v1`,checkpoint=JSON.parse(localStorage.getItem(key)!);
 expect(checkpoint.completed).toBe(units.length);expect(checkpoint.pending).toHaveLength(11-units.length);expect(updated).toHaveBeenCalledTimes(label==='TMDB'?1:0);expect(cacheChanged).toHaveBeenCalledOnce();expect(container.querySelector('progress')?.dataset.state).toBe('normal');
 expect(api.maintenanceProvider).toHaveBeenCalledOnce();expect(button('Refresh all data').disabled).toBe(false);
});
it('shows local ruby failure/quota feedback and retains successful peers without replay',async()=>{
 vi.mocked(api.maintenanceProvider).mockResolvedValue({results:[{movieId:'film-0',provider:'tmdb',status:'updated',message:'Saved'},{movieId:'film-1',provider:'tmdb',status:'failed',message:'Provider unavailable',retryAfter:60}],canonicalChanged:true,cacheChanged:true,quota:{'X-RateLimit-Remaining':'25'},stopped:true});await render();await act(async()=>button('Refresh TMDB enrichment').click());
 expect(updated).toHaveBeenCalledOnce();expect(container.querySelector('#refresh-tmdb-enrichment-heading')?.closest('section')?.textContent).toContain('Provider unavailable');expect(container.textContent).toContain('25');expect(container.querySelector('progress')?.dataset.state).toBe('interrupted');expect(container.querySelector('progress')?.value).toBe(1);
 const saved=JSON.parse(localStorage.getItem('bookclub.maintenance.refresh.tmdb-enrichment.v1')!);expect(saved.pending.some((u:{movieId:string})=>u.movieId==='film-0')).toBe(false);expect(saved.pending.some((u:{movieId:string})=>u.movieId==='film-1')).toBe(true);
});
it.each(['Populate missing data','Refresh all data'])('requires an explicit aggregate confirmation for %s and starts no work on mount',async label=>{
 await render();expect(api.maintenanceProvider).not.toHaveBeenCalled();await act(async()=>button(label).click());expect(container.querySelector('dialog')?.textContent).toContain('Estimated API requests:');expect(api.maintenanceProvider).not.toHaveBeenCalled();await act(async()=>button('Cancel').click());expect(container.querySelector('dialog')).toBeNull();
});
it('unmount stops the pending batch, and remount preserves the provider checkpoint',async()=>{
 let resolve!:(value:MaintenanceBatchResult)=>void;vi.mocked(api.maintenanceProvider).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();await act(async()=>button('Refresh TMDB enrichment').click());const units=vi.mocked(api.maintenanceProvider).mock.calls[0][1];await act(async()=>root.render(createElement('div',null,'Elsewhere')));await act(async()=>resolve({results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'updated',message:'Saved'})),canonicalChanged:false,cacheChanged:false}));await render();expect(button('Resume Refresh TMDB enrichment')).toBeTruthy();expect(api.maintenanceProvider).toHaveBeenCalledOnce();
});
it('blocks new requests after session/write permission changes and keeps stopped progress pumpkin',async()=>{
 let resolve!:(value:MaintenanceBatchResult)=>void;vi.mocked(api.maintenanceProvider).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();await act(async()=>button('Refresh TMDB enrichment').click());await render(false);const units=vi.mocked(api.maintenanceProvider).mock.calls[0][1];await act(async()=>resolve({results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'no_change',message:'Unchanged'})),canonicalChanged:false,cacheChanged:false}));expect(api.maintenanceProvider).toHaveBeenCalledOnce();expect(container.querySelector('progress')?.dataset.state).toBe('normal');expect(cacheChanged).not.toHaveBeenCalled();
});
it('disables zero-work actions and fails clearly against an older Worker',async()=>{
 vi.mocked(api.maintenanceCoverage).mockRejectedValue(new Error('Worker upgrade required'));await render();expect(container.textContent).toContain('Worker upgrade required');expect(button('Populate missing data').disabled).toBe(true);expect(api.maintenanceProvider).not.toHaveBeenCalled();
});
it('refreshes catalogue-derived TMDB availability/classification when only the cache changed',async()=>{
 vi.mocked(api.maintenanceProvider).mockImplementation(async(_intent,units)=>({results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'updated',message:'Saved'})),canonicalChanged:false,cacheChanged:true,stopped:true}));
 await render();await act(async()=>button('Refresh TMDB enrichment').click());expect(updated).toHaveBeenCalledOnce();expect(cacheChanged).toHaveBeenCalledOnce();
});
