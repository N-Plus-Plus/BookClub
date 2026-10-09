// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { AdminScreen } from '../frontend/AdminScreen';
import { api } from '../frontend/api';
import { loadAggregateCheckpoint } from '../frontend/aggregate-maintenance';
import type { CollectionRosterBatch,CollectionRosterStatus } from '../shared/collection-roster';
vi.mock('../frontend/api',()=>({api:{catalog:vi.fn(),maintenanceCoverage:vi.fn(),maintenanceProvider:vi.fn(),collectionRosterStatus:vi.fn(),maintainCollectionRosters:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let node:HTMLDivElement,root:ReturnType<typeof createRoot>,current:CollectionRosterStatus;
const catalog={members:[],movies:[],sessions:[],cycles:[]};
const button=(name:string)=>[...node.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
beforeEach(()=>{
  vi.resetAllMocks();localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
  current={collections:[{id:7,name:'Series',films:2,checked_at:null},{id:8,name:'Another series',films:2,checked_at:null}],unavailable:null};
  vi.mocked(api.catalog).mockResolvedValue(catalog);vi.mocked(api.collectionRosterStatus).mockImplementation(async()=>structuredClone(current));
  vi.mocked(api.maintenanceCoverage).mockResolvedValue({checks:[],fields:[],fieldsSupported:true,negativeScores:[],enrichment:[],evidence:[],evidenceSupported:true,unavailable:{tmdb:null,omdb:null,mdblist:null},next:null});
  node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);
});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();});
const render=async()=>act(async()=>root.render(createElement(AdminScreen,{catalog,writesEnabled:true,onUpdated:async()=>{},onMovie:()=>{}})));
it('zero film work still enables aggregate collection work, displays distinct estimates and locks standalone controls',async()=>{
  let resolve:(value:CollectionRosterBatch)=>void=()=>{};vi.mocked(api.maintainCollectionRosters).mockImplementation(()=>new Promise(done=>{resolve=done;}));await render();
  const card=node.querySelector('#populate-all-heading')!.parentElement!;
  expect(card.textContent).toContain('0 film/provider work units');expect(card.textContent).toContain('2 provisional collection rosters');expect(card.textContent).toContain('Collection requests may increase');expect(button('Populate missing data').disabled).toBe(false);
  await act(async()=>button('Populate missing data').click());await act(async()=>button('Start maintenance').click());
  expect(api.maintenanceProvider).not.toHaveBeenCalled();expect(api.maintainCollectionRosters).toHaveBeenCalledWith('populate',[7],expect.any(String));expect(button('Refresh collection rosters').disabled).toBe(true);expect(button('Populate missing collection rosters').disabled).toBe(true);
  expect(card.textContent).toContain('Phase: Collection rosters');expect(card.textContent).toContain('2 remaining collection rosters in the frozen plan');
  await act(async()=>button('Stop after this batch').click());current.collections[0].checked_at=new Date().toISOString();await act(async()=>resolve({results:[{id:7,status:'checked',message:'Saved'}],requests:1,cacheChanged:true}));
  expect(loadAggregateCheckpoint('populate')).toMatchObject({phase:'collections',rosters:{pending:[8],completed:1}});expect(button('Resume Populate missing data')).toBeTruthy();expect(button('Refresh collection rosters').disabled).toBe(false);
  await act(async()=>button('Resume Populate missing data').click());await act(async()=>button('Start maintenance').click());expect(api.maintainCollectionRosters).toHaveBeenLastCalledWith('populate',[8],expect.any(String));
  await act(async()=>button('Stop after this batch').click());current.collections[1].checked_at=new Date().toISOString();await act(async()=>resolve({results:[{id:8,status:'checked',message:'Saved'}],requests:1,cacheChanged:true}));
  expect(loadAggregateCheckpoint('populate')).toBeNull();expect(card.textContent).toContain('Finished both phases');expect(api.maintenanceProvider).not.toHaveBeenCalled();
});
it('a missing roster API blocks a new aggregate while independent film controls remain available',async()=>{
  vi.mocked(api.collectionRosterStatus).mockRejectedValue(new Error('Upgrade required'));await render();expect(button('Refresh all data').disabled).toBe(true);expect(node.textContent).toContain('Collection coverage is unavailable');expect(api.maintainCollectionRosters).not.toHaveBeenCalled();
});
