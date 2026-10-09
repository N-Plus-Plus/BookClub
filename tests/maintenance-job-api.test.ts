import { expect,it,vi } from 'vitest';
import { call,data,env,local } from './helpers/product-api';
import worker from '../worker/src/index';
import type { MaintenanceJob } from '../shared/maintenance-job';

it('all job endpoints require an authenticated administrator',async()=>{
 const id=crypto.randomUUID(),paths=['/maintenance/jobs',`/maintenance/jobs/${id}`,`/maintenance/jobs/${id}/claim`,`/maintenance/jobs/${id}/step`,`/maintenance/jobs/${id}/release`,`/maintenance/jobs/${id}/stop`,`/maintenance/jobs/${id}/retry`,'/maintenance/jobs/import'];
 for(const path of paths){const method=path.endsWith(id)||path==='/maintenance/jobs'?'GET':'POST';expect((await worker.fetch(new Request(`http://api/api/v1${path}`,{method,...(method==='POST'?{body:'{}'}:{})}),env)).status).toBe(401);expect((await call(path,method,method==='POST'?{}:undefined)).status).toBe(403);}
});
it('status is strictly read-only, bounds requests and blocks legacy writes during a lease',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('No provider calls permitted'));try{
  const id=crypto.randomUUID();const job=await data<MaintenanceJob>(await call('/maintenance/jobs','POST',{id,intent:'refresh',operation:'omdb-metadata'},2));
  const before=local.sqlite.prepare('SELECT total_changes() AS n').get();expect((await call('/maintenance/jobs','GET',undefined,2)).status).toBe(200);expect((await call(`/maintenance/jobs/${job.id}`,'GET',undefined,2)).status).toBe(200);expect(local.sqlite.prepare('SELECT total_changes() AS n').get()).toEqual(before);expect(fetch).not.toHaveBeenCalled();
  const claims=await Promise.all([call(`/maintenance/jobs/${id}/claim`,'POST',{},2),call(`/maintenance/jobs/${id}/claim`,'POST',{},3)]);expect(claims.map(r=>r.status).sort()).toEqual([200,409]);
  expect((await call('/movies/maintenance-provider','POST',{intent:'refresh',startedAt:job.started_at,units:[]},2)).status).toBe(409);expect(fetch).not.toHaveBeenCalled();
  for(const input of [{id:crypto.randomUUID(),intent:'refresh',operation:'arbitrary'},{id:crypto.randomUUID(),intent:'refresh',operation:'scores',sql:'untrusted'}])expect((await call('/maintenance/jobs','POST',input,2)).status).toBe(422);
  expect((await call(`/maintenance/jobs/${id}/step`,'POST',{token:'not-a-token'},2)).status).toBe(422);
  expect((await call('/maintenance/jobs/import','POST',{id:crypto.randomUUID(),padding:'x'.repeat(131073)},2)).status).toBe(413);
 }finally{fetch.mockRestore();}
});
