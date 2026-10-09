// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi,beforeEach,afterEach } from 'vitest';
import { CollectionRosterMaintenance } from '../frontend/CollectionRosterMaintenance';
import { BulkMaintenanceLock } from '../frontend/bulk-maintenance';
import { api } from '../frontend/api';
import { loadRosterCheckpoint,saveRosterCheckpoint,rosterKey } from '../frontend/collection-roster-maintenance';
import type { CollectionRosterBatch,CollectionRosterStatus } from '../shared/collection-roster';
vi.mock('../frontend/api',()=>({api:{collectionRosterStatus:vi.fn(),maintainCollectionRosters:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let node:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();});
const status:CollectionRosterStatus={collections:[{id:7,name:'Series',films:2,checked_at:null},{id:8,name:'Another series',films:3,checked_at:null},{id:9,name:'Checked',films:2,checked_at:'2020-01-01T00:00:00.000Z'}],unavailable:null};
const render=async(changed=vi.fn(),allowed=true)=>act(async()=>root.render(createElement(BulkMaintenanceLock,null,createElement(CollectionRosterMaintenance,{writesEnabled:allowed,onEnrichmentChanged:changed}))));
const button=(name:string)=>[...node.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
it('estimates collections separately, starts no work on mount, locks both controls and stops/resumes without replay',async()=>{
  let current=structuredClone(status);vi.mocked(api.collectionRosterStatus).mockImplementation(async()=>current);
  let resolve:(r:CollectionRosterBatch)=>void=()=>{};
  vi.mocked(api.maintainCollectionRosters).mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const changed=vi.fn();await render(changed);
  expect(node.textContent).toContain('2 eligible collections');expect(node.textContent).toContain('3 eligible collections');expect(api.maintainCollectionRosters).not.toHaveBeenCalled();
  await act(async()=>button('Populate missing collection rosters').click());
  expect(api.maintainCollectionRosters).toHaveBeenCalledWith('populate',[7],expect.any(String));expect(button('Refresh collection rosters').disabled).toBe(true);
  await act(async()=>button('Stop after this batch').click());
  current={...current,collections:current.collections.map(c=>c.id===7?{...c,checked_at:new Date().toISOString()}:c)};
  await act(async()=>resolve({results:[{id:7,status:'checked',message:''}],requests:1,cacheChanged:true}));
  expect(api.maintainCollectionRosters).toHaveBeenCalledTimes(1);expect(loadRosterCheckpoint('populate')).toMatchObject({pending:[8],completed:1,requests:1});expect(changed).toHaveBeenCalledTimes(1);
  await act(async()=>button('Resume collection checks').click());expect(api.maintainCollectionRosters).toHaveBeenLastCalledWith('populate',[8],expect.any(String));
  await act(async()=>button('Stop after this batch').click());current={...current,collections:current.collections.map(c=>c.id===8?{...c,checked_at:new Date().toISOString()}:c)};
  await act(async()=>resolve({results:[{id:8,status:'checked',message:''}],requests:1,cacheChanged:true}));
  expect(loadRosterCheckpoint('populate')).toBeNull();expect(changed).toHaveBeenCalledTimes(2);expect(node.textContent).toContain('2 completed');
});
it('retains failed checks and interrupted progress, supports explicit retries and invalidates evidence',async()=>{
  vi.mocked(api.collectionRosterStatus).mockResolvedValue({...status,collections:[status.collections[0]]});
  vi.mocked(api.maintainCollectionRosters).mockResolvedValue({results:[{id:7,status:'failed',message:'Unavailable'}],requests:1,cacheChanged:true,stopped:'TMDB cooldown. Resume later.'});
  const changed=vi.fn();await render(changed);await act(async()=>button('Populate missing collection rosters').click());
  expect(node.textContent).toContain('TMDB cooldown');expect(node.querySelector('progress')?.getAttribute('data-state')).toBe('interrupted');expect(loadRosterCheckpoint('populate')).toMatchObject({pending:[7],completed:0});expect(changed).toHaveBeenCalledTimes(1);
  vi.mocked(api.maintainCollectionRosters).mockResolvedValue({results:[{id:7,status:'checked',message:''}],requests:1,cacheChanged:true});
  vi.useFakeTimers();await act(async()=>button('Resume collection checks').click());await act(async()=>vi.advanceTimersByTimeAsync(2000));expect(loadRosterCheckpoint('populate')).toBeNull();expect(node.querySelector('[role=alert]')).toBeNull();
});
it('reconciles a lost-response commit and clears the checkpoint without another upstream request',async()=>{
  let calls=0;vi.mocked(api.collectionRosterStatus).mockImplementation(async()=>({...status,collections:[{...status.collections[0],checked_at:++calls>1?new Date().toISOString():null}]}));
  saveRosterCheckpoint({version:1,intent:'refresh',startedAt:'2020-01-01T00:00:00.000Z',pending:[7],completed:0,requests:0},'refresh');
  await render();await act(async()=>button('Retry collection coverage').click());expect(loadRosterCheckpoint('refresh')).toBeNull();expect(api.maintainCollectionRosters).not.toHaveBeenCalled();
});
it('rejects corrupt/credential-bearing checkpoints and disables work without write permission or provider availability',async()=>{
  localStorage.setItem(rosterKey('populate'),JSON.stringify({version:1,intent:'populate',startedAt:'2026',pending:[7,7],completed:0,requests:0,token:'not permitted'}));expect(loadRosterCheckpoint('populate')).toBeNull();
  vi.mocked(api.collectionRosterStatus).mockResolvedValue({...status,unavailable:'TMDB cooldown.'});await render(undefined,false);
  expect(button('Populate missing collection rosters').disabled).toBe(true);expect(button('Refresh collection rosters').disabled).toBe(true);expect(api.maintainCollectionRosters).not.toHaveBeenCalled();
});
