// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../frontend/App';
import { api } from '../frontend/api';
import { nonHomeTitles, selectShellTitle } from '../frontend/app-shell-title';
import type { Catalog } from '../shared/types';

vi.mock('../frontend/api',() => ({
  api:{health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(),seen:vi.fn()},
  ApiClientError:class extends Error {},hasSession:()=>true,setUnauthorizedHandler:vi.fn(),
  clearSession:vi.fn(),storeSession:vi.fn(),setDevMember:vi.fn(),
}));
vi.mock('../frontend/AdminScreen',()=>({AdminScreen:()=>null}));
vi.mock('../frontend/DetailScreen',()=>({DetailScreen:()=>null}));
let root:Root,container:HTMLDivElement;
let resolveCatalog:(catalog:Catalog)=>void;
const catalog:Catalog={members:[],movies:[],sessions:[],cycles:[]};
const title=()=>container.querySelector('.site-header .brand > span')!.firstChild!.textContent;
const mount=async(page:string)=>{
  window.history.replaceState(null,'',`#/${page}`);
  await act(async()=>root.render(createElement(App)));
};
const navigate=async(page:string)=>{
  await act(async()=>{
    window.history.replaceState(null,'',`#/${page}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};
beforeEach(()=>{
  vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('requestAnimationFrame',()=>0);
  vi.spyOn(Math,'random').mockReturnValue(0);
  vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'production',authenticationRequired:true,googleAuthConfigured:true,tmdbConfigured:true,mdblistConfigured:true,omdbConfigured:true,demo:false});
  vi.mocked(api.me).mockResolvedValue({viewer:{id:'owner',display_name:'Owner',sort_order:1,avatar:1,role:'admin'}});
  vi.mocked(api.catalog).mockImplementation(()=>new Promise(resolve=>{resolveCatalog=resolve;}));
  vi.mocked(api.rotation).mockResolvedValue(null);
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('Home including the default route has exactly Book Club without random selection',async()=>{
  expect(selectShellTitle('home')).toBe('Book Club');expect(Math.random).not.toHaveBeenCalled();
  await mount('');expect(title()).toBe('Book Club');
  await act(async()=>resolveCatalog(catalog));expect(title()).toBe('Book Club');
});
it.each(['classics','seen','movie/one','preview/tmdb/123','event/one','admin','unknown'])('direct %s entry selects an authorised non-Home title',async(page)=>{
  await mount(page);expect(title()).toBe(nonHomeTitles[0]);expect(title()).not.toBe('Book Club');
  expect(Math.random).toHaveBeenCalledTimes(1);
  if(page==='admin'){
    await act(async()=>resolveCatalog(catalog));
    expect(container.querySelector('h1')?.textContent).toBe('Admin');expect(title()).toBe(nonHomeTitles[0]);
  }
});
it('selects on each page transition, restores Home immediately and ignores repeated route events',async()=>{
  vi.mocked(Math.random).mockReturnValueOnce(0).mockReturnValueOnce(.5).mockReturnValueOnce(.99);
  await mount('home');expect(title()).toBe('Book Club');
  await navigate('classics');expect(title()).toBe(nonHomeTitles[0]);
  await navigate('seen');expect(title()).toBe(nonHomeTitles[9]);
  await navigate('seen');expect(title()).toBe(nonHomeTitles[9]);expect(Math.random).toHaveBeenCalledTimes(2);
  await navigate('home');expect(title()).toBe('Book Club');expect(Math.random).toHaveBeenCalledTimes(2);
  await navigate('admin');expect(title()).toBe(nonHomeTitles[17]);expect(Math.random).toHaveBeenCalledTimes(3);
});
it('keeps the title stable through data loading, parent rerender and navigation-pane toggle',async()=>{
  await mount('admin');const selected=title();
  await act(async()=>resolveCatalog(catalog));
  await act(async()=>root.render(createElement(App)));
  await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Collapse navigation"]')!.click());
  expect(title()).toBe(selected);expect(Math.random).toHaveBeenCalledTimes(1);
});
it('selects again between individual movie pages and on a fresh mount',async()=>{
  vi.mocked(Math.random).mockReturnValueOnce(0).mockReturnValueOnce(.5).mockReturnValueOnce(.99);
  await mount('movie/one');await navigate('movie/two');expect(title()).toBe(nonHomeTitles[9]);
  await act(async()=>root.unmount());root=createRoot(container);
  await mount('movie/two');expect(title()).toBe(nonHomeTitles[17]);expect(Math.random).toHaveBeenCalledTimes(3);
});
it('keeps the complete pool unique and selects its first and last exact entries',()=>{
  expect(nonHomeTitles).toHaveLength(18);expect(new Set(nonHomeTitles).size).toBe(18);
  expect(nonHomeTitles[0]).toBe('BOOb lucK');expect(nonHomeTitles[17]).toBe('lOu cObB, K?');
});
