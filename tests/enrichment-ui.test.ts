// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { DurableMaintenanceControl,invalidateMaintenanceDiscovery } from '../frontend/DurableMaintenanceControl';
import { BulkMaintenanceLock } from '../frontend/bulk-maintenance';
import { api } from '../frontend/api';
import { jobFixture,installJobMocks } from './helpers/maintenance-jobs';
import { maintenanceOperations } from '../shared/maintenance-plan';
import type { MaintenanceJob } from '../shared/maintenance-job';
vi.mock('../frontend/api',()=>({api:{maintenanceJobs:vi.fn(),maintenanceJob:vi.fn(),createMaintenanceJob:vi.fn(),claimMaintenanceJob:vi.fn(),stepMaintenanceJob:vi.fn(),releaseMaintenanceJob:vi.fn(),stopMaintenanceJob:vi.fn(),retryMaintenanceJob:vi.fn(),importMaintenanceJob:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let node:HTMLDivElement,root:ReturnType<typeof createRoot>;
const button=(name:string)=>[...node.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
beforeEach(()=>{vi.resetAllMocks();installJobMocks();localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();});
const render=async(operation:MaintenanceJob['operation']='tmdb-enrichment',intent:MaintenanceJob['intent']='refresh',allowed=true)=>act(async()=>root.render(createElement(BulkMaintenanceLock,null,createElement(DurableMaintenanceControl,{intent,operation,writesEnabled:allowed}))));

it.each(maintenanceOperations.flatMap(operation=>(['populate','refresh'] as const).map(intent=>({operation,intent}))))('starts the correct durable $intent/$operation run without provider work on mount',async({operation,intent})=>{
 await render(operation,intent);expect(api.createMaintenanceJob).not.toHaveBeenCalled();expect(api.stepMaintenanceJob).not.toHaveBeenCalled();const start=[...node.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent!== 'Reload job status')!;await act(async()=>start.click());expect(api.createMaintenanceJob).toHaveBeenCalledWith(expect.any(String),intent,operation);expect(api.stepMaintenanceJob).toHaveBeenCalledOnce();expect(node.textContent).toContain('Completed');expect(node.textContent).toContain('1 successful');
});
it.each(['paused','failed','awaiting_cooldown'] as const)('recovers %s state after localStorage deletion from server evidence',async state=>{
 const saved={...jobFixture(),state,counts:{...jobFixture().counts,successful:3,pending:2},requests:3};installJobMocks(saved);localStorage.clear();await render();expect(button('Resume remaining')).toBeTruthy();expect(node.textContent).toContain('3 successful');expect(api.createMaintenanceJob).not.toHaveBeenCalled();await act(async()=>button('Resume remaining').click());expect(api.claimMaintenanceJob).toHaveBeenCalledWith(saved.id);expect(api.createMaintenanceJob).not.toHaveBeenCalled();
});
it('completed issues are never described as successfully refreshed and retry does not start a new run',async()=>{
 const saved={...jobFixture(),state:'completed_with_issues' as const,counts:{...jobFixture().counts,pending:0,successful:9,deferred:1},issues:[{key:'bad:tmdb',movieId:'bad',collectionId:null,provider:'tmdb',operations:['tmdb-enrichment'],category:'record' as const,message:'Malformed fictional film',attempts:2,retryAt:null}]};installJobMocks(saved);await render();expect(node.textContent).toContain('9 successful');expect(node.textContent).toContain('1 deferred');expect(node.textContent).toContain('were not successfully refreshed');expect(button('Resume remaining')).toBeUndefined();expect(button('Retry failed')).toBeTruthy();await act(async()=>button('Retry this issue').click());expect(api.retryMaintenanceJob).toHaveBeenCalledWith(saved.id,['bad:tmdb']);expect(api.createMaintenanceJob).not.toHaveBeenCalled();
});
it('another browser lease blocks execution but status remains read-only',async()=>{
 installJobMocks({...jobFixture(),lease:{active:true,owner:'Other admin',expiresAt:Date.now()+180000}});await render();expect(button('Resume remaining').disabled).toBe(true);expect(node.textContent).toContain('Other admin');expect(api.stepMaintenanceJob).not.toHaveBeenCalled();await act(async()=>button('Reload job status').click());expect(api.stepMaintenanceJob).not.toHaveBeenCalled();
});
it('an older API fails locally and does not fall back to unguarded provider calls',async()=>{
 vi.mocked(api.maintenanceJobs).mockRejectedValue(Error('Migration 0024 required'));invalidateMaintenanceDiscovery();await render();expect(node.textContent).toContain('Migration 0024 required');expect(button('Refresh TMDB enrichment').disabled).toBe(true);expect(api.stepMaintenanceJob).not.toHaveBeenCalled();
});
it('write permission disables all mutations',async()=>{await render('tmdb-enrichment','refresh',false);expect(button('Refresh TMDB enrichment').disabled).toBe(true);expect(api.createMaintenanceJob).not.toHaveBeenCalled();});
