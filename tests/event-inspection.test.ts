// @vitest-environment jsdom
import { harness, movies, catalog, preview, flush, navigate, button, click, input, search, lineup } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { BuilderSet, TmdbPreview } from '../shared/types';

import { api } from '../frontend/api';
import { App } from '../frontend/App';

describe('preserved Event film inspection',() => {
  it('Nope and browser Back preserve the exact editor, query, page, manual fields and selected order',async () => {
    expect(harness.container.textContent).not.toContain('Review event');
    expect(harness.container.textContent).not.toContain('films in viewing order');
    const editor = harness.container.querySelector('.event-workflow');
    await input(harness.container.querySelector('input[name="event_date"]')!,'2030-04-05');
    const complete = harness.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!; await click(complete);
    await input(harness.container.querySelector<HTMLInputElement>('.manual-form input[maxlength="300"]')!,'Unfinished manual title');
    await click(button('Save event')); expect(harness.container.textContent).toContain('Add at least one film.');
    await search();
    expect(harness.container.querySelectorAll('.search-row')).toHaveLength(6); expect(button('Previous').disabled).toBe(true);
    await click(button('Next')); expect(harness.container.querySelectorAll('.search-row')).toHaveLength(3); expect(button('Next').disabled).toBe(true);
    await click(harness.container.querySelectorAll<HTMLAnchorElement>('.search-row a')[0]);
    expect(harness.container.querySelector('.event-workflow')).toBe(editor); expect(editor?.parentElement?.hidden).toBe(true);
    expect(button("Nope, this isn't it")).toBeTruthy(); expect(api.importMovie).not.toHaveBeenCalled();
    await click(button("Nope, this isn't it")); await flush();
    expect(harness.container.querySelector('.event-workflow')).toBe(editor); expect(editor?.parentElement?.hidden).toBe(false);
    expect(harness.container.querySelector<HTMLInputElement>('input[name="event_date"]')!.value).toBe('2030-04-05');
    expect(complete.checked).toBe(false); expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe('film');
    expect(harness.container.querySelector<HTMLInputElement>('.manual-form input[maxlength="300"]')!.value).toBe('Unfinished manual title');
    expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    expect(harness.container.textContent).toContain('Add at least one film.');
    expect(lineup()).toEqual([]); expect(harness.container.querySelector('.search-row .movie-title')?.textContent).toBe('Film 6');
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);
    await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve,20)); }); await flush();
    expect(window.location.hash).toBe('#/event'); expect(button('Yes, this one!')).toBeUndefined();
    expect(harness.container.querySelector('.event-workflow')).toBe(editor); expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 2 of 2');
    await search(); expect(harness.container.querySelector('.search-pagination')?.textContent).toContain('Page 1 of 2');
    expect(api.saveSession).not.toHaveBeenCalled(); expect(api.importMovie).not.toHaveBeenCalled();
  });
  it('Yes local appends the canonical movie and ordinary detail has no confirmation actions',async () => {
    await search(); await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);
    expect(api.detail).toHaveBeenCalledWith('saved-0'); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 0']); expect(api.importMovie).not.toHaveBeenCalled();
    expect(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!.value).toBe(''); expect(harness.container.querySelector('.search-row')).toBeNull();
    await search(); await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 0','Film 0']);
    await navigate('movie/saved-0'); expect(button('Yes, this one!')).toBeUndefined();
  });
  it('loads preview only on inspection, caches on Previous/Next and imports external only on Yes with retry',async () => {
    await search(); expect(api.preview).not.toHaveBeenCalled();
    await click(button('Next')); expect(api.preview).not.toHaveBeenCalled();
    expect(harness.container.querySelectorAll('.search-row')[2].textContent).toBe('External film2001');
    await click(button('Previous')); await click(button('Next')); expect(api.preview).not.toHaveBeenCalled();
    const editor = harness.container.querySelector('.event-workflow');
    await click(harness.container.querySelectorAll<HTMLAnchorElement>('.search-row a')[2]);
    expect(api.preview).toHaveBeenCalledTimes(1); expect(api.importMovie).not.toHaveBeenCalled();
    expect(harness.container.querySelector('.detail-header')?.textContent).toContain('Preview only');
    expect(harness.container.querySelector('.detail-grid')).toBeNull();
    vi.mocked(api.importMovie).mockRejectedValueOnce(new Error('Import temporarily unavailable.'));
    await click(button('Yes, this one!')); expect(window.location.hash).toBe('#/preview/tmdb/42');
    expect(harness.container.textContent).toContain('Import temporarily unavailable.'); expect(lineup()).toEqual([]);
    await click(button('Yes, this one!')); await flush();
    expect(api.importMovie).toHaveBeenCalledTimes(2); expect(harness.container.querySelector('.event-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Imported film']); expect(api.saveSession).not.toHaveBeenCalled();
  });
  it('director failures preserve valid search rows without an unknown placeholder',async () => {
    vi.mocked(api.preview).mockRejectedValue(new Error('TMDB unavailable.'));
    await search(); await click(button('Next'));
    expect(harness.container.querySelectorAll('.search-row')).toHaveLength(3);
    expect(harness.container.querySelectorAll('.search-row')[2].textContent).not.toContain('Director: Unknown');
    await click(button('Previous')); await click(button('Next')); expect(api.preview).not.toHaveBeenCalled();
  });
  it('never prefetches visible external rows and deduplicates actual inspections',async () => {
    vi.mocked(api.search).mockResolvedValue({local:[],external:Array.from({length:14},(_,i) => ({provider:'tmdb',externalId:String(i+1),title:`Candidate ${i+1}`,year:null,poster:null})),lookup:{available:true,message:null}});
    await search(); await flush();
    expect(api.preview).not.toHaveBeenCalled(); expect(harness.container.querySelectorAll('.search-row')).toHaveLength(6);
    await click(button('Next')); await click(button('Previous')); expect(api.preview).not.toHaveBeenCalled();
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); expect(api.preview).toHaveBeenCalledTimes(1);
    await click(button("Nope, this isn't it"));
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); expect(api.preview).toHaveBeenCalledTimes(1);
  });
  it('shares an in-flight preview across repeated inspections',async () => {
    vi.mocked(api.search).mockResolvedValue({local:[],external:[{provider:'tmdb',externalId:'1',title:'Candidate',year:null,poster:null}],lookup:{available:true,message:null}});
    let resolve!: (value: TmdbPreview) => void;
    vi.mocked(api.preview).mockImplementation(() => new Promise(done => { resolve = done; }));
    await search(); expect(api.preview).not.toHaveBeenCalled();
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);
    await click(button("Nope, this isn't it"));
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);
    expect(api.preview).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({...preview,externalId:'1'}); }); await flush();
    expect(harness.container.querySelector('.detail-header')?.textContent).toContain('Preview only');
    expect(api.importMovie).not.toHaveBeenCalled();
  });
  it('Builder prefill seeds once in exact order and survives Nope and Yes',async () => {
    await navigate('home');
    vi.mocked(api.builders).mockResolvedValue([{id:'set',owner_member_id:'member-2',title:'Saved set',movie_ids:['saved-2','saved-0','saved-2']} as BuilderSet]);
    await click(button('Use from Builder')); await click(button('Use this set')); await flush();
    expect(lineup()).toEqual(['Film 2','Film 0','Film 2']); const editor = harness.container.querySelector('.event-workflow');
    await search(); await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button("Nope, this isn't it")); await flush();
    expect(lineup()).toEqual(['Film 2','Film 0','Film 2']); expect(harness.container.querySelector('.event-workflow')).toBe(editor);
    await click(harness.container.querySelectorAll<HTMLAnchorElement>('.search-row a')[1]); await click(button('Yes, this one!')); await flush();
    expect(lineup()).toEqual(['Film 2','Film 0','Film 2','Film 1']);
    await navigate('home'); await navigate('event'); expect(lineup()).toEqual([]);
  });
  it('existing Event corrections also retain the editor during inspection',async () => {
    vi.mocked(api.catalog).mockResolvedValue({...catalog,sessions:[{id:'historic',event_date:'2000-01-01',kind:'hosted',host_member_id:'former',movies:[movies[2]],cycle_id:null,cycle_slot:null,date_precision:'exact',legacy_cycle_label:null}]});
    await act(async () => harness.root.unmount()); harness.root = createRoot(harness.container);
    window.location.hash = '/event/historic'; await act(async () => harness.root.render(createElement(App))); await flush();
    const editor = harness.container.querySelector('.event-workflow'); await search();
    await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!); await click(button('Yes, this one!')); await flush();
    expect(window.location.hash).toBe('#/event/historic'); expect(harness.container.querySelector('.event-workflow')).toBe(editor);
    expect(lineup()).toEqual(['Film 2','Film 0']); expect(harness.container.textContent).not.toContain('Actual host');
  });
});

it('Event save reconciles the returned session without follow-up catalogue or rotation reads',async()=>{
 await search();await click(harness.container.querySelector<HTMLAnchorElement>('.search-row a')!);await click(button('Yes, this one!'));
 await input(harness.container.querySelector<HTMLInputElement>('input[name="event_date"]')!,'2030-01-01');
 await click(harness.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
 vi.mocked(api.saveSession).mockResolvedValue({session:{id:'new-event',movies:[movies[0]],event_date:'2030-01-01',host_member_id:'member-2',kind:'hosted',date_precision:'exact',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}});
 await click(button('Save event'));await flush();
 expect(api.saveSession).toHaveBeenCalledOnce();expect(api.catalog).toHaveBeenCalledOnce();expect(api.rotation).toHaveBeenCalledOnce();expect(harness.container.textContent).toContain('Film 0');
 expect(api.health).toHaveBeenCalledOnce();expect(api.me).toHaveBeenCalledOnce();
});
