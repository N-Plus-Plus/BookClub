import { vi } from 'vitest';
import { api } from '../../frontend/api';
import { invalidateMaintenanceDiscovery } from '../../frontend/DurableMaintenanceControl';
import type { JobOperation,MaintenanceJob } from '../../shared/maintenance-job';
export function jobFixture(operation:JobOperation='tmdb-enrichment',intent:MaintenanceJob['intent']='refresh'):MaintenanceJob{
 return {id:'01234567-89ab-4cde-8f01-234567890abc',operation,intent,started_at:'2026-01-01T00:00:00.000Z',created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z',phase:operation==='collection-rosters'?'collections':'films',state:'ready',requests:0,diagnostic:null,counts:{pending:1,running:0,successful:0,skipped:0,deferred:0,blocked:0,updated:0,no_change:0},lease:{active:false,owner:null,expiresAt:0},issues:[],issuesNext:null};
}
export function installJobMocks(initial:MaintenanceJob|null=null){
 invalidateMaintenanceDiscovery();let current=initial,stopped=false;
 vi.mocked(api.maintenanceJobs).mockImplementation(async()=>({jobs:current?[current]:[]}));
 vi.mocked(api.maintenanceJob).mockImplementation(async()=>structuredClone(current!));
 vi.mocked(api.createMaintenanceJob).mockImplementation(async(id,intent,operation)=>{current={...jobFixture(operation,intent),id};return structuredClone(current);});
 vi.mocked(api.claimMaintenanceJob).mockImplementation(async()=>({token:'01234567-89ab-4cde-8f01-234567890abd',job:structuredClone(current!)}));
 vi.mocked(api.planMaintenanceJob).mockImplementation(async()=>{current={...current!,state:'ready',planning:{stage:'complete',processed:current!.planning?.total??0,total:current!.planning?.total??0,failed:false,diagnostic:null}};return structuredClone(current);});
 vi.mocked(api.stepMaintenanceJob).mockImplementation(async()=>{current={...current!,state:stopped?'paused':'completed',counts:{...current!.counts,pending:0,successful:1,updated:1},requests:1};return structuredClone(current);});
 vi.mocked(api.releaseMaintenanceJob).mockImplementation(async()=>({...structuredClone(current!),lease:{active:false,owner:null,expiresAt:0}}));
 vi.mocked(api.stopMaintenanceJob).mockImplementation(async()=>{stopped=true;return structuredClone(current!);});
 vi.mocked(api.retryMaintenanceJob).mockImplementation(async()=>{current={...current!,state:'ready',counts:{...current!.counts,pending:current!.counts.deferred,deferred:0},issues:[]};return structuredClone(current);});
 vi.mocked(api.importMaintenanceJob).mockImplementation(async value=>{current={...jobFixture(value.operation,value.intent),id:value.id,started_at:value.startedAt};return structuredClone(current);});
 return {get:()=>current,set:(value:MaintenanceJob)=>{current=value;}};
}
