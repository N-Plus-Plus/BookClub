// @vitest-environment jsdom
import { harness, movies, catalog, flush, navigate, button, click, input, lineup } from './helpers/app-integration';
import { createElement, act } from 'react';

import { expect, it, vi } from 'vitest';

import { rankMovie } from '../shared/ranking';
import { api } from '../frontend/api';
import { App } from '../frontend/App';

it('canonical provider title is shared by Home, History, all Classics tabs, Seen, Detail, Builder, Event, search, Metrics and confirmation',async()=>{
 const title='Correct Provider Name';
 const members=catalog.members;
 const score={provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:100,fetched_at:'2026-01-01',retrieved_via:'omdb'};
 const fixture=['ranked','unranked','seen'].map((id,i)=>{
   const seen=i===1?[]:[{member_id:members[0].id,seen:i===2?1:0,updated_at:''}];
   return {...movies[0],id,title,classic:true,scores:[score],seen,ranking:rankMovie([score],seen,members),legacy_title:'Wrong Legacy Name'};
 });
 const session={id:'canonical-event',movies:[fixture[0]],host_member_id:members[0].id,event_date:'2026-01-01',cycle_id:null,cycle_slot:2,kind:'hosted' as const,date_precision:'exact' as const,legacy_cycle_label:null};
 const canonical={...catalog,movies:fixture,sessions:[session]};
 vi.mocked(api.catalog).mockResolvedValue(canonical);
 vi.mocked(api.me).mockResolvedValue({viewer:{...members[0],avatar:2,role:'admin'}});
 vi.mocked(api.detail).mockImplementation(async id=>({...fixture.find(m=>m.id===id)!,appearances:[]}));
 vi.mocked(api.search).mockResolvedValue({local:[{id:'ranked',title,year:1998,poster:null,tmdbId:null}],external:[],lookup:{available:true,message:null}});
 vi.mocked(api.builders).mockResolvedValue([{id:'canonical-set',owner_member_id:members[0].id,title:'Private set',notes:null,movie_ids:['ranked'],revision:1,created_at:'2026-01-01',updated_at:''}]);
 await act(async()=>harness.root.render(createElement(App,{key:'canonical-fixture'})));await flush();
 const visible=()=>[...harness.container.querySelectorAll('main')].map(e=>e.textContent).join('');
 for(const route of ['home','history','classics','seen','movie/ranked','metrics','event/canonical-event']) {
   await navigate(route);
   if(route==='metrics')await act(async()=>[...harness.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent==='Top 5')!.click());
   expect(visible(),route).toContain(title);expect(visible(),route).not.toContain('Wrong Legacy Name');
   if(route==='metrics') {
     for(const [tab,selectors] of [['Top 5',['.metrics-rankings','.metrics-popularity-list']],['Records',['.metrics-extremes']]] as const) {
       await act(async()=>[...harness.container.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent===tab)!.click());
       if(tab==='Top 5')await act(async()=>harness.container.querySelectorAll<HTMLButtonElement>('.metrics-rankings section:first-child button')[1].click());
       for(const selector of selectors)expect(harness.container.querySelector(selector)?.textContent).toContain(title);
     }
   }
 }
 await navigate('classics');
 for(const tab of ['Ranked','Unranked','Seen']) {
   await click([...harness.container.querySelectorAll<HTMLButtonElement>('.classics-filters button')].find(b=>b.textContent?.startsWith(tab))!);
   expect(harness.container.querySelector('.ranking-list')?.textContent).toContain(title);
 }
 await click(harness.container.querySelector<HTMLButtonElement>('.classic-remove')!);expect(harness.container.querySelector('dialog')?.textContent).toContain(title);await click(button('Cancel'));
 await click(button('Add Classic'));await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,title);
 await act(async()=>harness.container.querySelector('dialog form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();
 expect(harness.container.querySelector('dialog .search-row')?.textContent).toContain(title);await click(harness.container.querySelector<HTMLButtonElement>('button[aria-label="Close Add Classic"]')!);
 await navigate('builder');await click(button('Open set'));expect(lineup()).toEqual([title]);
 await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,title);
 await act(async()=>harness.container.querySelector('.builder-workflow .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await flush();expect(harness.container.querySelector('.search-row')?.textContent).toContain(title);
 await navigate('home');await click(button('Use from Builder'));expect(harness.container.querySelector('dialog')?.textContent).toContain(title);await click(button('Cancel'));
 expect(api.importMovie).not.toHaveBeenCalled();
});
