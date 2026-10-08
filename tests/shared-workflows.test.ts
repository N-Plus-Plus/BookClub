// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Action, SourceScores } from '../frontend/components';
import { PaginationControls } from '../frontend/PaginationControls';
import { NativeDialog } from '../frontend/NativeDialog';
import { BulkMaintenanceLock, useBulkJobController } from '../frontend/bulk-maintenance';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.open=true;});HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.open=false;});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('Action extends canonical base/icon classes and preserves props',async()=>{
  await act(async()=>root.render(h('div',null,h(Action,{className:'seen-yes',disabled:true},'Yes'),h(Action,{className:'classic-remove','aria-label':'Remove'}))));
  const buttons=container.querySelectorAll('button');expect(buttons[0].className).toBe('button seen-yes');expect(buttons[0].disabled).toBe(true);expect(buttons[1].className).toBe('button button--icon classic-remove');
});
it('SourceScores retains observation through ordinary rerenders and reinstalls on structural changes',async()=>{
  const geometry=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect');
  const disconnect=vi.fn(),observe=vi.fn(),construct=vi.fn();
  vi.stubGlobal('ResizeObserver',class {constructor(){construct();}observe=observe;disconnect=disconnect;});
  const score=(provider:string,metric:string,value:number)=>({provider,metric,raw_value:value,raw_scale:100,normalized_value:value,vote_count:null,fetched_at:''});
  const scores=[score('imdb','rating',80),score('metacritic','critic',75)];
  await act(async()=>root.render(h(SourceScores,{scores})));expect(construct).toHaveBeenCalledOnce();expect(observe).toHaveBeenCalledTimes(3);expect(geometry).toHaveBeenCalledTimes(2);
  await act(async()=>root.render(h(SourceScores,{scores:scores.map(score=>({...score,normalized_value:81}))})));expect(construct).toHaveBeenCalledOnce();expect(disconnect).not.toHaveBeenCalled();expect(geometry).toHaveBeenCalledTimes(2);
  await act(async()=>root.render(h(SourceScores,{scores:[...scores,score('trakt','rating',90)]})));expect(construct).toHaveBeenCalledTimes(2);expect(disconnect).toHaveBeenCalledOnce();
  await act(async()=>root.render(null));expect(disconnect).toHaveBeenCalledTimes(2);
});
it.each([1,2,3])('pagination preserves first/middle/last page actions (%s)',async page=>{
  const onPage=vi.fn();await act(async()=>root.render(h(PaginationControls,{page,pages:3,onPage})));
  const buttons=container.querySelectorAll('button');expect(buttons[0].disabled).toBe(page===1);expect(buttons[1].disabled).toBe(page===3);expect(container.textContent).toContain(`Page ${page} of 3`);
  await act(async()=>{buttons[0].click();buttons[1].click();});expect(onPage.mock.calls.map(call=>call[0])).toEqual([...(page>1?[page-1]:[]),...(page<3?[page+1]:[])]);
});
it('native dialog opens once, guards cancel while busy, safely closes and restores focus',async()=>{
  const opener=document.createElement('button');document.body.appendChild(opener);opener.focus();const onClose=vi.fn();
  const render=async(busy:boolean)=>act(async()=>root.render(h(NativeDialog,{id:'heading',heading:'Confirmation',onClose,busy,children:'Content'})));
  await render(false);expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();expect(container.querySelector('dialog')?.getAttribute('aria-labelledby')).toBe('heading');
  await render(true);const dialog=container.querySelector('dialog')!;await act(async()=>dialog.dispatchEvent(new Event('cancel',{cancelable:true})));expect(onClose).not.toHaveBeenCalled();
  await render(false);await act(async()=>dialog.dispatchEvent(new Event('cancel',{cancelable:true})));expect(onClose).toHaveBeenCalledOnce();expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  await act(async()=>root.render(null));expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();expect(document.activeElement).toBe(opener);opener.remove();
});
it.each([false,true])('bulk controller synchronously excludes concurrent/repeated starts and releases after failure=%s',async failed=>{
  const jobs:ReturnType<typeof useBulkJobController>[]=[];
  function Job({index}:{index:number}){jobs[index]=useBulkJobController();return null;}
  await act(async()=>root.render(h(BulkMaintenanceLock,null,h(Job,{index:0}),h(Job,{index:1}))));
  let done!:(value?:unknown)=>void;const pending=new Promise<void>((resolve,reject)=>{done=value=>{if(failed)reject(value);else resolve();};});const work=vi.fn(()=>pending),other=vi.fn(async()=>{});
  let completion!:Promise<void>;await act(async()=>{completion=jobs[0].execute(work);void jobs[0].execute(work);void jobs[1].execute(other);});
  expect(work).toHaveBeenCalledOnce();expect(other).not.toHaveBeenCalled();expect(jobs[0].busy).toBe(true);
  await act(async()=>jobs[0].requestStop());expect(jobs[0].stop.current).toBe(true);expect(jobs[0].stopRequested).toBe(true);
  await act(async()=>{done(failed?new Error('Failure'):undefined);await completion;});expect(jobs[0].busy).toBe(false);expect(jobs[0].error).toBe(failed?'Failure':'');
  await act(async()=>jobs[1].execute(other));expect(other).toHaveBeenCalledOnce();
});
it('unmount requests stop without releasing the lock before the active batch completes',async()=>{
  let job!:ReturnType<typeof useBulkJobController>;function Job(){job=useBulkJobController();return null;}
  await act(async()=>root.render(h(BulkMaintenanceLock,null,h(Job))));
  let done!:()=>void;const pending=new Promise<void>(resolve=>{done=resolve;});let completion!:Promise<void>;
  await act(async()=>{completion=job.execute(()=>pending);});const stop=job.stop;
  await act(async()=>root.render(null));expect(stop.current).toBe(true);await act(async()=>{done();await completion;});
});
