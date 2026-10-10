// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RotationCard } from '../frontend/RotationCard';
import { RotationSwapCard } from '../frontend/RotationSwapCard';
import { api } from '../frontend/api';
import type { Catalog, Rotation, Viewer } from '../shared/types';
vi.mock('../frontend/api',() => ({api:{swapRotation:vi.fn()}}));
const catalog: Catalog = {members:[1,2,3,4].map(n=>({id:`m${n}`,display_name:`Member ${n}`,sort_order:n,active:1,avatar:n})),movies:[],cycles:[],sessions:[]};
const viewer: Viewer = {id:'m1',display_name:'Member 1',sort_order:1,role:'admin',avatar:1};
const turn: Rotation = {id:1,cycle_id:null,nominal_slot:1,version:4,updated_at:'',human_order:{}};
let container: HTMLDivElement, root: Root;
const updated=vi.fn();
beforeEach(() => {vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async () => {await act(async()=>root.unmount());container.remove();});
const render = async (rotation=turn,club=catalog) => {await act(async()=>root.render(createElement(RotationCard,{catalog:club,rotation,viewer,onUpdated:updated,onUseBuilder:vi.fn()})));};
const renderSwap = async (rotation=turn,club=catalog) => {await act(async()=>root.render(createElement(RotationSwapCard,{catalog:club,rotation,writesEnabled:true,onUpdated:updated})));};
const actions = () => [...container.querySelectorAll('.turn-actions .button')].map(e=>e.textContent);
it('groups heading and effective identity on the left and ordered secondary/constructive actions on the right',async()=>{
 await render();expect(actions()).toEqual(['Plan in Builder','Use from Builder','Event']);
 expect(container.querySelector('.turn-identity h2')?.textContent).toBe('It is your turn');expect(container.querySelector('.turn-card-area-personal')).toBeTruthy();
 const buttons=container.querySelectorAll('.turn-actions .button');expect(buttons[0].getAttribute('data-variant')).toBe('secondary');expect(buttons[1].getAttribute('data-variant')).toBe('secondary');expect(buttons[2].getAttribute('data-intent')).toBe('constructive');
 expect(container.querySelector('select')).toBeNull();expect(container.textContent).not.toContain('Swap current turn');
 await render({...turn,human_order:{'1':'m3','3':'m1'}});expect(actions()).toEqual(['Event']);expect(container.querySelector('.turn-identity')?.textContent).toContain('MEMBER 3');expect(container.querySelector('.turn-card-area-personal')).toBeNull();
});
it('CLSC has Watch Order then constructive Event and no admin swap',async()=>{
 await render({...turn,nominal_slot:5,cycle_id:'cycle'});expect(actions()).toEqual(['View watch order','Event']);expect(container.querySelector('details')).toBeNull();
});
it('offers only eligible future members and submits the narrow versioned swap with feedback',async()=>{
 const club={...catalog,members:catalog.members.map(m=>({...m,active:m.id==='m4'?0:1})),sessions:[{cycle_id:'cycle',cycle_slot:2,host_member_id:'m2'}] as Catalog['sessions']};
 await renderSwap({...turn,cycle_id:'cycle'},club);expect(container.querySelector('h2')?.textContent).toBe('Swap current turn');
 expect([...container.querySelectorAll('option')].map(e=>e.value)).toEqual(['','m3']);expect(container.querySelector('textarea')).toBeNull();
 vi.mocked(api.swapRotation).mockResolvedValue({...turn,human_order:{'1':'m3','3':'m1'},version:5});
 await act(async()=>{const select=container.querySelector('select')!;select.value='m3';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(api.swapRotation).toHaveBeenCalledWith({target_member_id:'m3',version:4});expect(updated).toHaveBeenCalledExactlyOnceWith({...turn,human_order:{'1':'m3','3':'m1'},version:5});expect(container.querySelector('[role=status]')?.textContent).toContain('MEMBER 3 is current now');
});
it('shows local errors and preserves the selected target',async()=>{
 await renderSwap();vi.mocked(api.swapRotation).mockRejectedValue(new Error('Current turn changed.'));
 await act(async()=>{const select=container.querySelector('select')!;select.value='m3';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(container.querySelector('[role=alert]')?.textContent).toBe('Current turn changed.');expect(container.querySelector('select')?.value).toBe('m3');expect(updated).not.toHaveBeenCalled();
});

it('offers a hostless Classics target only before Sean starts the next cycle and reconciles its versioned exchange',async()=>{
 await renderSwap();expect([...container.querySelectorAll('option')].map(e=>e.value)).toEqual(['','m2','m3','m4','classics']);
 vi.mocked(api.swapRotation).mockResolvedValue({...turn,classics_first:1,version:5});
 await act(async()=>{const select=container.querySelector('select')!;select.value='classics';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(api.swapRotation).toHaveBeenCalledWith({target_kind:'classics',version:4});expect(updated).toHaveBeenCalledWith({...turn,classics_first:1,version:5});
 await render({...turn,classics_first:1});expect(actions()).toEqual(['View watch order','Event']);
 await render({...turn,classics_first:1,nominal_slot:5,cycle_id:'cycle'});expect(actions()).toEqual(['Plan in Builder','Use from Builder','Event']);
});
