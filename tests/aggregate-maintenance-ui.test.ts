// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { DurableMaintenanceControl } from '../frontend/DurableMaintenanceControl';
import { BulkMaintenanceLock } from '../frontend/bulk-maintenance';
import { api } from '../frontend/api';
import { jobFixture,installJobMocks } from './helpers/maintenance-jobs';
import type { MaintenanceJob } from '../shared/maintenance-job';
vi.mock('../frontend/api',()=>({api:{maintenanceJobs:vi.fn(),maintenanceJob:vi.fn(),createMaintenanceJob:vi.fn(),claimMaintenanceJob:vi.fn(),stepMaintenanceJob:vi.fn(),releaseMaintenanceJob:vi.fn(),stopMaintenanceJob:vi.fn(),retryMaintenanceJob:vi.fn(),importMaintenanceJob:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let node:HTMLDivElement,root:ReturnType<typeof createRoot>;
const button=(name:string)=>[...node.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
beforeEach(()=>{vi.resetAllMocks();installJobMocks();localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();});
const render=async(operation:MaintenanceJob['operation']='tmdb-enrichment',intent:MaintenanceJob['intent']='refresh',allowed=true)=>act(async()=>root.render(createElement(BulkMaintenanceLock,null,createElement(DurableMaintenanceControl,{intent,operation,writesEnabled:allowed}))));

it.each(['populate','refresh'] as const)('requires explicit confirmation for a new %s aggregate, with no execution on mount',async intent=>{await render('all',intent);const name=intent==='populate'?'Populate missing data':'Refresh all data';await act(async()=>button(name).click());expect(node.querySelector('dialog')).toBeTruthy();expect(api.createMaintenanceJob).not.toHaveBeenCalled();await act(async()=>button('Cancel').click());expect(api.createMaintenanceJob).not.toHaveBeenCalled();await act(async()=>button(name).click());await act(async()=>button('Start new run').click());expect(api.createMaintenanceJob).toHaveBeenCalledWith(expect.any(String),intent,'all');});
it('shows collection phase with deferred films and retains the failure manifest',async()=>{const saved={...jobFixture('all'),phase:'collections' as const,state:'paused' as const,counts:{...jobFixture().counts,pending:3,successful:499,deferred:1}};installJobMocks(saved);await render('all');expect(node.textContent).toContain('Collection rosters');expect(node.textContent).toContain('499 successful');expect(node.textContent).toContain('1 deferred');expect(button('Resume remaining')).toBeTruthy();expect(api.createMaintenanceJob).not.toHaveBeenCalled();});
it('preserves old film-only local checkpoints and explicitly imports their original scope',async()=>{const key='bookclub.maintenance.refresh.all.v1',value=JSON.stringify({version:1,intent:'refresh',operation:'all',startedAt:'2020-01-01T00:00:00.000Z',completed:5,pending:[{movieId:'film',provider:'tmdb',identity:{provider:'tmdb',external_id:'42'},operations:['tmdb-enrichment']}]});localStorage.setItem(key,value);await render('all');expect(localStorage.getItem(key)).toBe(value);expect(button('Refresh all data').disabled).toBe(true);await act(async()=>button('Recover legacy progress').click());expect(api.importMaintenanceJob).toHaveBeenCalledWith(expect.objectContaining({filmOnly:true,startedAt:'2020-01-01T00:00:00.000Z',collections:[],units:[['film','tmdb','tmdb','42',['tmdb-enrichment'],[]]]}));expect(api.stepMaintenanceJob).not.toHaveBeenCalled();expect(localStorage.getItem(key)).toBe(value);});
