// @vitest-environment jsdom
import { harness, movies, catalog, flush, navigate, button, click } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { Catalog } from '../shared/types';

import { api } from '../frontend/api';
import { App } from '../frontend/App';

it('App applies the returned rotation swap without catalogue, rotation, health or auth reloads',async()=>{
 vi.mocked(api.catalog).mockResolvedValue({...catalog,members:[...catalog.members,{id:'member-3',display_name:'Member 3',sort_order:3,active:1,avatar:3}]});
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);window.location.hash='/admin';await act(async()=>harness.root.render(createElement(App)));await navigate('admin');
 vi.clearAllMocks();
 const turn={id:1,nominal_slot:2,cycle_id:null,version:1,updated_at:'saved',human_order:{'2':'member-3','3':'member-2'}};
 vi.mocked(api.swapRotation).mockResolvedValue(turn);
 await act(async()=>{const select=harness.container.querySelector('main .card')!.querySelector('select')!;select.value='member-3';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>harness.container.querySelector('main .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 expect(api.swapRotation).toHaveBeenCalledOnce();await navigate('home');expect(harness.container.querySelector('.turn-identity')?.textContent).toContain('MEMBER 3');
 expect(api.catalog).not.toHaveBeenCalled();expect(api.rotation).not.toHaveBeenCalled();expect(api.health).not.toHaveBeenCalled();expect(api.me).not.toHaveBeenCalled();
});

it('a returned swap does not discard an in-flight broad catalogue refresh or get overwritten by its older Rotation',async()=>{
 const club={...catalog,members:[...catalog.members,{id:'member-3',display_name:'Member 3',sort_order:3,active:1,avatar:3}]};
 vi.mocked(api.catalog).mockResolvedValue(club);vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);window.location.hash='/admin';await act(async()=>harness.root.render(createElement(App)));await navigate('admin');vi.clearAllMocks();
 let release!:(catalog:Catalog)=>void;vi.mocked(api.catalog).mockReturnValueOnce(new Promise(resolve=>{release=resolve;}));
 vi.mocked(api.maintenanceProvider).mockResolvedValue({results:[{movieId:'saved-7',provider:'tmdb',status:'updated',message:'Saved'}],canonicalChanged:true,cacheChanged:false});
 await click(button('Populate missing TMDB metadata and artwork'));expect(api.catalog).toHaveBeenCalledOnce();
 await navigate('admin');vi.mocked(api.swapRotation).mockResolvedValue({id:1,nominal_slot:2,cycle_id:null,version:1,updated_at:'saved',human_order:{'2':'member-3','3':'member-2'}});
 await act(async()=>{const select=harness.container.querySelector('main .card')!.querySelector('select')!;select.value='member-3';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>harness.container.querySelector('main .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 const fresh={...movies[0],title:'Metadata reconciled'};
 await act(async()=>release({...club,movies:[fresh,...movies.slice(1)],sessions:[{id:'fresh',movies:[fresh],event_date:'2030-01-01',host_member_id:'member-2',kind:'hosted',date_precision:'exact',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]}));await flush();
 await navigate('home');expect(harness.container.querySelector('.turn-identity')?.textContent).toContain('MEMBER 3');expect(harness.container.textContent).toContain('Metadata reconciled');
 expect(api.catalog).toHaveBeenCalledOnce();expect(api.health).not.toHaveBeenCalled();expect(api.me).not.toHaveBeenCalled();
});
