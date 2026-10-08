// @vitest-environment jsdom
import { harness, movies, catalog, results, flush, navigate, button, click, input, lineup } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { BuilderSet, Rotation } from '../shared/types';

import { api } from '../frontend/api';
import { App } from '../frontend/App';
import { BuilderSetPicker } from '../frontend/BuilderSetPicker';

it('unresolvable and empty Builder sets are disabled without truncating their saved order',async () => {
  const choose = vi.fn();
  vi.mocked(api.builders).mockResolvedValue([
    {id:'bad',owner_member_id:'member-2',title:'Incomplete',movie_ids:['saved-2','missing','saved-0']},
    {id:'empty',owner_member_id:'member-2',title:'Empty',movie_ids:[]},
    {id:'good',owner_member_id:'member-2',title:'Complete',movie_ids:['saved-2','saved-0','saved-2']},
  ] as BuilderSet[]);
  await act(async () => harness.root.render(createElement(BuilderSetPicker,{catalog,viewer:{id:'member-2',display_name:'Member',avatar:2,sort_order:2,role:'member'},onClose:vi.fn(),onChoose:choose}))); await flush();
  const actions = [...harness.container.querySelectorAll<HTMLButtonElement>('button')].filter(button => button.textContent === 'Use this set');
  expect(actions.map(button => button.disabled)).toEqual([true,true,false]);
  expect(harness.container.textContent).toContain('This set contains unavailable film data.');
  await click(actions[0]); expect(choose).not.toHaveBeenCalled();
  await click(actions[2]); expect(choose).toHaveBeenCalledWith(['saved-2','saved-0','saved-2']);
});

it.each(['production','import-preview'])('hides the local indicator and dev tools for %s even with demo set',async(environment)=>{
 vi.mocked(api.health).mockResolvedValue({status:'ok',environment,authenticationRequired:true,googleAuthConfigured:false,tmdbConfigured:false,mdblistConfigured:false,omdbConfigured:false,demo:true});
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);await act(async()=>harness.root.render(createElement(App)));await flush();await navigate('admin');
 expect(harness.container.querySelector('.demo-label,.developer-tools')).toBeNull();expect(button('Populate Missing Scores')).toBeTruthy();
});

describe('Builder inspection and Use set',() => {
  const openBuilder = async () => { await navigate('builder'); await click(button('New set')); };
  const builderSearch = async () => {
    await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,'film');
    await act(async () => { harness.container.querySelector('.builder-workflow .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }); await flush();
  };
  it('preserves the mounted draft and search on route return and browser Back without inclusion',async () => {
    await openBuilder();
    const editor = harness.container.querySelector('.builder-workflow');
    await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!,'Private draft');
    expect(harness.container.querySelector('textarea')).toBeNull();
    await builderSearch(); await click(button('Next'));
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);
    expect(lineup()).toEqual([]); expect(button('Add to Set')).toBeTruthy(); expect(button('Yes, this one!')).toBeUndefined();
    expect(harness.container.querySelector('.builder-workflow')).toBe(editor); expect(editor?.parentElement?.hidden).toBe(true);
    await navigate('builder');
    expect(harness.container.querySelector('.builder-workflow')).toBe(editor);
    expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!.value).toBe('Private draft');
    expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('film');
    expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);
    await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve,20)); }); await flush();
    expect(window.location.hash).toBe('#/builder'); expect(harness.container.querySelector('.builder-workflow')).toBe(editor);
    expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    expect(api.saveBuilder).not.toHaveBeenCalled();
  });
  it('canonical local confirmation matches direct Plus reset, focus, repeats, reorder and removal',async () => {
    await openBuilder(); await builderSearch();
    await click(harness.container.querySelector<HTMLElement>('button[aria-label="Add Film 0"]')!);
    const editor=harness.container.querySelector('.builder-workflow');
    await builderSearch(); await click(button('Next'));
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); await act(async () => { button('Add to Set').click(); button('Add to Set').click(); }); await flush();
    expect(window.location.hash).toBe('#/builder'); expect(harness.container.querySelector('.builder-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Film 0','Film 6']);
    expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe(''); expect(harness.container.querySelector('.search-row')).toBeNull();
    expect(document.activeElement).toBe(harness.container.querySelector('input[maxlength="150"]'));
    await builderSearch(); expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 1 of 2');
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Add to Set'));
    expect(lineup()).toEqual(['Film 0','Film 6','Film 0']); expect(api.importMovie).not.toHaveBeenCalled();
    await click(harness.container.querySelector<HTMLElement>('button[aria-label="Move Film 6 earlier"]')!); expect(lineup()).toEqual(['Film 6','Film 0','Film 0']);
    await click(harness.container.querySelector<HTMLElement>('button[aria-label="Remove Film 6"]')!); expect(lineup()).toEqual(['Film 0','Film 0']);
    await navigate('home'); await navigate('movie/saved-0'); expect(button('Add to Set')).toBeUndefined();
  });
  it('imports only on confirmation, locks repeated submissions, preserves failure for retry and patches catalogue',async () => {
    await openBuilder(); await builderSearch(); await click(button('Next'));
    const editor=harness.container.querySelector('.builder-workflow');
    await click(harness.container.querySelectorAll<HTMLAnchorElement>('.search-row a')[2]); expect(api.importMovie).not.toHaveBeenCalled();
    let reject!: (error: Error) => void;
    vi.mocked(api.importMovie).mockImplementationOnce(() => new Promise((_resolve,fail) => { reject=fail; }));
    const add=button('Add to Set'); await act(async () => { add.click(); add.click(); });
    expect(api.importMovie).toHaveBeenCalledTimes(1); expect(button('Adding…').disabled).toBe(true);
    await act(async () => reject(new Error('Please retry import.'))); await flush();
    expect(window.location.hash).toBe('#/preview/tmdb/42'); expect(harness.container.textContent).toContain('Please retry import.');
    expect(harness.container.querySelector('.builder-workflow')).toBe(editor); expect(lineup()).toEqual([]);
    expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('film');
    expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    await click(button('Add to Set')); expect(api.importMovie).toHaveBeenLastCalledWith('42'); expect(lineup()).toEqual(['Imported film']);
    expect(window.location.hash).toBe('#/builder'); expect(harness.container.querySelector('.search-row')).toBeNull();
    expect(document.activeElement).toBe(harness.container.querySelector('input[maxlength="150"]'));
    vi.mocked(api.builders).mockResolvedValue([{id:'new-set',owner_member_id:'member-2',title:'',notes:'',movie_ids:['canonical-import'],revision:1,created_at:'2026-01-01',updated_at:''}]);
    await click(button('Save set')); await click(button('Open set')); expect(lineup()).toEqual(['Imported film']);
  });
  it.each([false,true])('successful Save returns to the reconciled list (existing=%s)',async existing => {
    const set={id:'existing',owner_member_id:'member-2',title:'Old',notes:'Old note',movie_ids:['saved-2','saved-0','saved-2'],revision:3,created_at:'2026-01-01',updated_at:''};
    vi.mocked(api.builders).mockResolvedValue(existing ? [set] : []);
    await navigate('builder'); await click(button(existing ? 'Open set' : 'New set'));
    await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!,'Saved title');
    expect(harness.container.querySelector('textarea')).toBeNull();
    vi.mocked(api.builders).mockResolvedValue([{...set,id:existing ? 'existing':'new-set',title:'Saved title',notes:existing ? 'Old note' : '',movie_ids:existing ? set.movie_ids : []}]);
    await click(button('Save set'));
    expect(button('Save set')).toBeUndefined(); expect(button('New set')).toBeTruthy(); expect(harness.container.textContent).toContain('Saved title'); if (existing) expect(harness.container.textContent).toContain('Old note');
    expect(harness.container.textContent).not.toContain('Private set saved.');
    expect(api.saveBuilder).toHaveBeenCalledWith({title:'Saved title',notes:existing ? 'Old note' : '',movie_ids:existing ? set.movie_ids:[],...(existing ? {revision:3}: {})},existing ? 'existing':undefined);
    await click(button('Open set')); expect(lineup()).toEqual(existing ? ['Film 2','Film 0','Film 2']:[]);
  });
  it('save rejection preserves editor and draft for retry',async () => {
    await openBuilder(); await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!,'Unsaved');
    await builderSearch();
    vi.mocked(api.saveBuilder).mockRejectedValueOnce(new Error('Save unavailable.')); await click(harness.container.querySelector<HTMLElement>('button[aria-label="Add Film 0"]')!);
    vi.mocked(api.saveBuilder).mockRejectedValueOnce(new Error('Save unavailable.')); await click(button('Save set'));
    expect(button('Save set')).toBeTruthy(); expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!.value).toBe('Unsaved'); expect(lineup()).toEqual(['Film 0']); expect(harness.container.textContent).toContain('Save unavailable.');
    await click(button('Save set')); expect(button('New set')).toBeTruthy();
  });
  it.each(['own','swapped-own','other','swapped-other','classics','historical','missing','inactive'])('uses effective current-turn identity (%s)',async kind => {
    const other={id:'sean',display_name:'Sean',sort_order:1,active:1,avatar:1};
    const turn: Rotation={id:1,nominal_slot:kind==='classics'?5:kind.startsWith('swapped')?1:2,cycle_id:null,version:9,updated_at:'',human_order:kind==='swapped-own'?{'1':'member-2'}:kind==='swapped-other'?{'1':'sean'}:kind==='other'||kind==='historical'?{'2':'sean'}:undefined};
    vi.mocked(api.catalog).mockResolvedValue({...catalog,members:[...catalog.members.map(m=>kind==='inactive'?{...m,active:0}:m),other]}); vi.mocked(api.rotation).mockResolvedValue(kind==='missing'?null:turn);
    await act(async () => harness.root.unmount()); harness.root=createRoot(harness.container); window.location.hash='/builder'; await act(async () => harness.root.render(createElement(App))); await flush();
    await click(button('New set')); await builderSearch(); await click(harness.container.querySelector<HTMLElement>('button[aria-label="Add Film 0"]')!);
    expect([...harness.container.querySelectorAll('.builder-editor-actions button')].map(b=>b.textContent)).toEqual(['All sets','Use set','Save set']);
    const eligible=kind==='own'||kind==='swapped-own';
    expect(button('Use set').disabled).toBe(!eligible);
    if (!eligible) { await click(button('Use set')); expect(harness.container.querySelector('#publish-heading')).toBeNull(); expect(api.publishBuilder).not.toHaveBeenCalled(); return; }
    await click(button('Use set'));
    expect(harness.container.querySelector('h2#publish-heading')?.textContent).toBe('Use this set?');
    expect(harness.container.textContent).toContain('1 film in the saved order. This will move this film into a Book Club event as the one you brought.');
    expect(button('Use set')).toBeTruthy(); expect(harness.container.textContent).not.toMatch(/Review publication|Confirm publication|Publishing…/);
    expect(harness.container.querySelector('.builder-turn-warning')).toBeNull();
    expect(harness.container.textContent).toContain('Actual host: MEMBER 2');
    expect(api.swapRotation).not.toHaveBeenCalled();
  });
  it('Use set keeps the ordered repeated IDs and original publish API payload',async () => {
    await openBuilder(); for (const index of [2,0,2]) { await builderSearch(); await click(harness.container.querySelector<HTMLElement>(`button[aria-label="Add Film ${index}"]`)!); }
    await click(button('Use set')); expect(harness.container.textContent).toContain('3 films in the saved order. This will move these films into a Book Club event as the ones you brought.');
    let resolve!: (value: Awaited<ReturnType<typeof api.publishBuilder>>) => void;
    vi.mocked(api.publishBuilder).mockImplementationOnce(() => new Promise(done => { resolve=done; }));
    await click(button('Use set')); expect(button('Using set…').disabled).toBe(true); expect(harness.container.textContent).not.toContain('Publishing');
    expect(api.saveBuilder).toHaveBeenLastCalledWith({title:'',notes:'',movie_ids:['saved-2','saved-0','saved-2'],revision:1},'new-set');
    expect(api.publishBuilder).toHaveBeenCalledWith('new-set',expect.objectContaining({revision:1,cycle_slot:2,complete_turn:true,turn_version:0}));
    await act(async () => resolve({} as Awaited<ReturnType<typeof api.publishBuilder>>)); await flush(); expect(window.location.hash).toBe('#/history');
  });
});

it('Builder queues optimistic changes, preserves newest text and draft on failure, and never reloads the list per save',async()=>{
 await navigate('builder');expect(harness.container.querySelector('.page-heading-actions button')?.textContent).toBe('New set');expect(harness.container.querySelector('.builder-workflow button')?.textContent).not.toBe('New set');await click(button('New set'));expect(api.saveBuilder).not.toHaveBeenCalled();
 const title=harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!;await input(title,'Local typing');expect(api.saveBuilder).not.toHaveBeenCalled();
 let resolve!:(set:BuilderSet)=>void;vi.mocked(api.saveBuilder).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await input(title,'Newer title');await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await act(async()=>resolve({id:'auto',owner_member_id:'member-2',title:'Local typing',notes:null,movie_ids:[],revision:8,created_at:'2026-01-01',updated_at:''}));await flush();
 expect(title.value).toBe('Newer title');expect(api.saveBuilder).toHaveBeenLastCalledWith({title:'Newer title',notes:'',movie_ids:[],revision:8},'auto');
 expect(api.builders).toHaveBeenCalledTimes(1);expect(harness.container.querySelector('summary')?.textContent).not.toContain('Add a film manually');
 vi.mocked(api.search).mockResolvedValue(results);await input(harness.container.querySelector('input[maxlength="150"]')!,'film');await act(async()=>harness.container.querySelector('.builder-workflow form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 expect(harness.container.querySelector('button[aria-label="Add Film 0"]')?.classList.contains('builder-result-add')).toBe(true);
 vi.mocked(api.saveBuilder).mockRejectedValueOnce(new Error('Autosave unavailable'));await click(harness.container.querySelector('button[aria-label="Add Film 0"]')!);
 expect(lineup()).toEqual(['Film 0']);expect(harness.container.textContent).toContain('Set changes are unsaved');expect(harness.container.querySelector('.builder-lineup-identity')?.firstElementChild?.textContent).toBe('#1');expect(harness.container.querySelector('.builder-lineup')?.textContent).not.toContain('Viewing position');
 await click(button('Save set'));expect(button('Save set')).toBeUndefined();expect(api.builders).toHaveBeenCalledTimes(1);expect(harness.container.querySelectorAll('.builder-poster-strip .poster')).toHaveLength(1);
});

it('All sets stays in the list when a newly queued draft finishes, and can reopen the optimistic draft',async()=>{
 await navigate('builder');await click(button('New set'));let resolve!:(set:BuilderSet)=>void;vi.mocked(api.saveBuilder).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const title=harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!;await input(title,'Queued set');await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();await click(button('All sets'));expect(button('Open set')).toBeTruthy();expect(button('Save set')).toBeUndefined();
 await act(async()=>resolve({id:'queued',owner_member_id:'member-2',title:'Queued set',notes:null,movie_ids:[],revision:1,created_at:'2026-01-01',updated_at:''}));await flush();expect(button('Save set')).toBeUndefined();await click(button('Open set'));expect(title.isConnected).toBe(false);expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!.value).toBe('Queued set');
});

it.each([1,2,3,9])('Builder displays only the first four shared poster previews (%i films)',async count=>{
 vi.mocked(api.builders).mockResolvedValue([{id:'posters',owner_member_id:'member-2',title:'Posters',notes:null,movie_ids:Array.from({length:count},(_,i)=>movies[i%movies.length].id),revision:1,created_at:'2026-01-01',updated_at:''}]);await navigate('builder');expect(harness.container.querySelectorAll('.builder-poster-strip .poster')).toHaveLength(Math.min(4,count));expect(harness.container.querySelector('.builder-poster-strip a')).toBeNull();expect(harness.container.querySelector('.poster-empty')).toBeTruthy();
});

it('Builder title blur creates a new draft while typing stays local',async()=>{
 await navigate('builder');await click(button('New set'));const control=harness.container.querySelector('input[maxlength="300"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(control,'Blur value');control.dispatchEvent(new Event('input',{bubbles:true}));});expect(api.saveBuilder).not.toHaveBeenCalled();
 await act(async()=>control.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));await flush();expect(api.saveBuilder).toHaveBeenCalledExactlyOnceWith({title:'Blur value',notes:'',movie_ids:[]},undefined);
});

it('Builder applies additions, move and removal before saving and Use set publishes the final revision',async()=>{
 await navigate('builder');await click(button('New set'));
 let first!:(set:BuilderSet)=>void,second!:(set:BuilderSet)=>void;
 vi.mocked(api.saveBuilder).mockImplementationOnce(()=>new Promise(done=>{first=done;})).mockImplementationOnce(()=>new Promise(done=>{second=done;}));
 const searchBuilder=async()=>{await input(harness.container.querySelector('input[maxlength="150"]')!,'film');await act(async()=>harness.container.querySelector('.builder-workflow form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();};
 await searchBuilder();await click(harness.container.querySelector('button[aria-label="Add Film 0"]')!);expect(lineup()).toEqual(['Film 0']);expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await searchBuilder();await click(harness.container.querySelector('button[aria-label="Add Film 1"]')!);await click(harness.container.querySelector('button[aria-label="Move Film 1 earlier"]')!);expect(lineup()).toEqual(['Film 1','Film 0']);await click(harness.container.querySelector('button[aria-label="Remove Film 0"]')!);expect(lineup()).toEqual(['Film 1']);expect(api.saveBuilder).toHaveBeenCalledTimes(1);
 await act(async()=>button('Use set').click());expect(button('Use set').disabled).toBe(true);expect(api.publishBuilder).not.toHaveBeenCalled();
 const set:BuilderSet={id:'race',owner_member_id:'member-2',title:null,notes:null,movie_ids:['saved-0'],revision:9,created_at:'2026-01-01',updated_at:''};
 await act(async()=>first(set));await flush();expect(api.saveBuilder).toHaveBeenLastCalledWith({title:'',notes:'',movie_ids:['saved-1'],revision:9},'race');expect(harness.container.querySelector('#publish-heading')).toBeNull();expect(lineup()).toEqual(['Film 1']);
 await act(async()=>second({...set,movie_ids:['saved-1'],revision:10}));await flush();expect(harness.container.querySelector('#publish-heading')).toBeTruthy();
 vi.mocked(api.publishBuilder).mockResolvedValue({} as Awaited<ReturnType<typeof api.publishBuilder>>);await click(button('Use set'));expect(api.publishBuilder).toHaveBeenCalledWith('race',expect.objectContaining({revision:10}));expect(api.builders).toHaveBeenCalledTimes(1);
});
