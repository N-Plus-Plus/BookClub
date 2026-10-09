// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { DurableMaintenanceControl } from '../frontend/DurableMaintenanceControl';
import { BulkMaintenanceLock } from '../frontend/bulk-maintenance';
import { api } from '../frontend/api';
import { jobFixture,installJobMocks } from './helpers/maintenance-jobs';
import type { MaintenanceJob } from '../shared/maintenance-job';
vi.mock('../frontend/api',()=>({api:{maintenanceJobs:vi.fn(),maintenanceJob:vi.fn(),createMaintenanceJob:vi.fn(),claimMaintenanceJob:vi.fn(),planMaintenanceJob:vi.fn(),stepMaintenanceJob:vi.fn(),releaseMaintenanceJob:vi.fn(),stopMaintenanceJob:vi.fn(),retryMaintenanceJob:vi.fn(),importMaintenanceJob:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let node:HTMLDivElement,root:ReturnType<typeof createRoot>;
const button=(name:string)=>[...node.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
beforeEach(()=>{vi.resetAllMocks();installJobMocks();localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();});
const render=async(operation:MaintenanceJob['operation']='tmdb-enrichment',intent:MaintenanceJob['intent']='refresh',allowed=true)=>act(async()=>root.render(createElement(BulkMaintenanceLock,null,createElement(DurableMaintenanceControl,{intent,operation,writesEnabled:allowed}))));

it.each(['populate','refresh'] as const)('dedicated %s roster control uses the same durable execution and lease path',async intent=>{await render('collection-rosters',intent);await act(async()=>button(intent==='populate'?'Populate missing collection rosters':'Refresh collection rosters').click());expect(api.createMaintenanceJob).toHaveBeenCalledWith(expect.any(String),intent,'collection-rosters');expect(api.claimMaintenanceJob).toHaveBeenCalledOnce();expect(api.stepMaintenanceJob).toHaveBeenCalledOnce();expect(node.textContent).toContain('Collection rosters');});
it('failed roster identities and safe diagnostics remain individually retryable',async()=>{const saved={...jobFixture('collection-rosters'),state:'completed_with_issues' as const,counts:{...jobFixture().counts,pending:0,successful:49,deferred:1},issues:[{key:'collection:8',movieId:null,collectionId:8,provider:'tmdb',operations:['collection-rosters'],category:'record' as const,message:'Malformed roster; previous evidence retained.',attempts:1,retryAt:null}]};installJobMocks(saved);await render('collection-rosters');expect(node.textContent).toContain('Collection 8');expect(node.textContent).toContain('49 successful');expect(button('Retry this issue')).toBeTruthy();expect(button('Resume remaining')).toBeUndefined();});
it('keeps invalid legacy state intact when server validation rejects recovery',async()=>{const key='bookclub.collection-rosters.refresh.v1',value=JSON.stringify({version:1,intent:'refresh',startedAt:'2020-01-01T00:00:00.000Z',pending:[8,8],completed:0,requests:0});localStorage.setItem(key,value);vi.mocked(api.importMaintenanceJob).mockRejectedValue(Error('Duplicate legacy collection identity'));await render('collection-rosters');await act(async()=>button('Recover legacy progress').click());expect(localStorage.getItem(key)).toBe(value);expect(node.textContent).toContain('Duplicate legacy collection identity');expect(api.stepMaintenanceJob).not.toHaveBeenCalled();});
