// @vitest-environment jsdom
import { harness, movies, catalog, flush, navigate, button, click } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { Movie } from '../shared/types';

import { api } from '../frontend/api';
import { App } from '../frontend/App';

it('Seen queue, corrections and Detail context stay personal alongside the Home group total',async()=>{
  const personal={...movies[0],classic:true,director:'Stored Director',seen:[{member_id:'other',seen:1,updated_at:''}]};
  const other={id:'other',display_name:'Other',sort_order:1,active:1,avatar:1};
  vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:[personal],members:[catalog.members[0],other]});
  vi.mocked(api.detail).mockResolvedValue({...personal,appearances:[]});
  await act(async()=>harness.root.unmount()); harness.root=createRoot(harness.container);
  window.location.hash='/home'; await act(async()=>harness.root.render(createElement(App))); await flush();
  expect(harness.container.querySelector('.stat-link strong')?.textContent).toBe('1');
  const badge=()=>harness.container.querySelector('.desktop-navigation a[href="#/seen"] .navigation-count');
  expect(badge()?.textContent).toBe('1');
  expect(harness.container.querySelector('.desktop-navigation a[href="#/classics"] .navigation-count')).toBeNull();
  await navigate('seen');
  expect(harness.container.textContent).toContain('1 remaining'); expect(harness.container.textContent).toContain('HAVE YOU SEEN...');
  expect(harness.container.textContent).toContain('Director: Stored Director'); expect(harness.container.textContent).not.toContain('Answer unknown');
  expect(harness.container.querySelector<HTMLAnchorElement>('.answer-card')!.getAttribute('href')).toBe('#/movie/saved-0');
  await navigate('movie/saved-0');
  expect(button('Back')).toBeTruthy(); expect(button('Yes, this one!')).toBeUndefined();
  const columns=harness.container.querySelectorAll('.detail-seen-column');
  expect(columns[0].textContent).toBe("Haven't"); expect(columns[1].textContent).toContain('OTHER'); expect(columns[1].textContent).not.toContain('MEMBER 2');
  expect(harness.container.querySelector('.member-state')).toBeNull();
  await click(button('Back')); expect(window.location.hash).toBe('#/seen');
  vi.mocked(api.seen).mockImplementation(async (_id,memberId,value)=>({...personal,appearances:[],seen:value === null ? personal.seen : [...personal.seen,{member_id:memberId,seen:Number(value),updated_at:''}]}));
  await click(button('Yes, seen it')); expect(api.seen).toHaveBeenLastCalledWith(personal.id,'member-2',true);
  expect(harness.container.textContent).toContain('0 remaining');expect(badge()).toBeNull();
  expect(button('Undo last answer')).toBeUndefined();
  await click(button('Change to No')); expect(api.seen).toHaveBeenLastCalledWith(personal.id,'member-2',false);
  expect(harness.container.textContent).toContain('0 remaining');expect(badge()).toBeNull();
  await navigate('home');expect(harness.container.querySelector('.stat-link strong')?.textContent).toBe('0'); await navigate('movie/saved-0'); expect(button('Back')).toBeTruthy();
});

it('Detail groups explicit answers in member order and omits unanswered members',async()=>{
  const members=[4,2,1,3].map(n=>({id:`m${n}`,display_name:`Person ${n}`,sort_order:n,active:1,avatar:n}));
  vi.mocked(api.catalog).mockResolvedValue({...catalog,members});
  vi.mocked(api.detail).mockResolvedValue({...movies[0],classic:true,appearances:[],seen:[{member_id:'m4',seen:0,updated_at:''},{member_id:'m1',seen:0,updated_at:''},{member_id:'m3',seen:1,updated_at:''}]});
  await act(async()=>harness.root.unmount()); harness.root=createRoot(harness.container); window.location.hash='/movie/saved-0';
  await act(async()=>harness.root.render(createElement(App))); await flush();
  const groups=[...harness.container.querySelectorAll('.detail-seen-column')].map(column=>[...column.querySelectorAll('.club-identity')].map(member=>member.textContent));
  expect(groups).toEqual([['PERSON 1','PERSON 4'],['PERSON 3']]);
});

it('keeps App-owned Seen saves serial through navigation and exposes failures for retry on return',async()=>{
 const pool=movies.slice(0,3).map(m=>({...m,classic:true}));
 vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:pool});
 await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);await act(async()=>harness.root.render(createElement(App)));await flush();
 const requests:{resolve:(movie:Movie)=>void;reject:(error:Error)=>void}[]=[];
 vi.mocked(api.seen).mockImplementation(()=>new Promise((resolve,reject)=>requests.push({resolve:movie=>resolve({...movie,appearances:[]}),reject})));
 await navigate('seen');await click(button('Yes, seen it'));expect(harness.container.querySelector('.answer-card')?.textContent).toContain('Film 1');
 await click(button('No, not yet'));expect(api.seen).toHaveBeenCalledTimes(1);expect(harness.container.querySelectorAll('.recent-answer')).toHaveLength(2);
 await navigate('home');await act(async()=>requests[0].reject(new Error('Offline')));await flush();
 expect(api.seen).toHaveBeenCalledTimes(2);expect(harness.container.textContent).toContain('Seen answers are unsaved');
 await act(async()=>requests[1].resolve({...pool[1],seen:[{member_id:'member-2',seen:0,updated_at:'saved'}]}));await flush();
 await navigate('seen');expect(harness.container.textContent).toContain('Film 0: Seen');expect(harness.container.querySelector('.answer-card')?.textContent).toContain('Film 2');
 await click(button('Retry saving Film 0'));expect(api.seen).toHaveBeenLastCalledWith('saved-0','member-2',true);
 await act(async()=>requests[2].resolve({...pool[0],seen:[{member_id:'member-2',seen:1,updated_at:'saved'}]}));await flush();
 expect(harness.container.querySelector('[role="alert"]')).toBeNull();
});

it('desktop Missing answers follows session viewers and membership while excluding active History',async()=>{
 const member=catalog.members[0],other={id:'other',display_name:'Other',sort_order:1,active:1,avatar:1};
 const pool=movies.slice(0,3).map((m,i)=>({...m,classic:true,seen:i===0?[{member_id:member.id,seen:0,updated_at:''}]:[]}));
 const history={id:'history',event_date:'2026-01-01',date_precision:'exact' as const,kind:'hosted' as const,host_member_id:member.id,cycle_id:null,cycle_slot:null,legacy_cycle_label:null,movies:[pool[2]]};
 const remount=async(viewer:typeof member,present=pool)=>{
  vi.mocked(api.me).mockResolvedValue({viewer:{...viewer,avatar:viewer.avatar!,role:'member'}});
  vi.mocked(api.catalog).mockResolvedValue({...catalog,members:[member,other],movies:present,sessions:[history]});
  await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);
  await act(async()=>harness.root.render(createElement(App)));await flush();
 };
 const label=()=>harness.container.querySelector('.desktop-navigation a[href="#/seen"]')?.getAttribute('aria-label');
 await remount(member);expect(label()).toBe('Seen: 1 missing answer');await navigate('home');expect(harness.container.querySelector('.stat-link strong')?.textContent).toBe('3');expect(harness.container.querySelector('.stat-link span')?.textContent).toBe("Missing answers");
 await remount(other);expect(label()).toBe('Seen: 2 missing answers');expect(harness.container.querySelector('.stat-link strong')?.textContent).toBe('3');
 await remount(other,pool.map(m=>({...m,classic:m.id!==pool[1].id})));expect(label()).toBe('Seen: 1 missing answer');
 await remount(member,pool.map(m=>({...m,classic:m.id!==pool[1].id})));expect(label()).toBe('Seen');
});
