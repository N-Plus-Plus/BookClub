// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../frontend/App';
import { api } from '../frontend/api';
import { metricsFixture } from './metrics-fixture';

const chunks=vi.hoisted(()=>{
  let metricsReady!:()=>void, adminReady!:()=>void;
  const metricsGate=new Promise<void>(resolve=>{metricsReady=resolve;});
  const adminGate=new Promise<void>(resolve=>{adminReady=resolve;});
  return {metricsReady,adminReady,metricsGate,adminGate,metricsLoaded:vi.fn(),adminLoaded:vi.fn()};
});
vi.mock('../frontend/MetricsScreen',async importOriginal=>{
  chunks.metricsLoaded(); await chunks.metricsGate;
  return importOriginal();
});
vi.mock('../frontend/AdminScreen',async importOriginal=>{
  chunks.adminLoaded(); await chunks.adminGate;
  return importOriginal();
});
vi.mock('../frontend/api',()=>({
  api:{preferences:vi.fn(async()=>({show_ai:false})),predictions:vi.fn(async()=>[]),maintenanceJobs:vi.fn(async()=>({jobs:[]})),health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(async()=>null),seen:vi.fn(),
    metricsEnrichment:vi.fn(async()=>({movies:{}})),
    scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:[],eligibleDimensions:0,unavailableDimensions:0,unavailableFilms:0}))},
  ApiClientError:class extends Error {},hasSession:()=>true,setUnauthorizedHandler:vi.fn(),
  clearSession:vi.fn(),storeSession:vi.fn(),setDevMember:vi.fn(),
}));
let root:Root,container:HTMLDivElement;
const mount=async(path:string,role:'admin'|'member'='member')=>{
  vi.mocked(api.me).mockResolvedValue({viewer:{id:'m1',display_name:'Sean',sort_order:1,avatar:0,role}});
  window.history.replaceState(null,'',`#/${path}`);
  await act(async()=>root.render(createElement(App)));
};
const navigate=async(path:string)=>{
  await act(async()=>{
    window.history.replaceState(null,'',`#/${path}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};
const waitFor=async(selector:string)=>{
  await vi.waitFor(async()=>{
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    expect(container.querySelector(selector)).not.toBeNull();
  });
};
beforeEach(()=>{
  vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('requestAnimationFrame',()=>0);
  HTMLElement.prototype.scrollIntoView=vi.fn();
  vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'test',authenticationRequired:true,googleAuthConfigured:true,demo:false} as Awaited<ReturnType<typeof api.health>>);
  vi.mocked(api.catalog).mockResolvedValue(metricsFixture());
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});

it('keeps Home and denied Admin out of heavy modules, preserves the shell during loading and reuses enrichment across visits',async()=>{
  await mount('home');
  expect(container.textContent).toContain('Quick facts');
  expect(chunks.metricsLoaded).not.toHaveBeenCalled();expect(chunks.adminLoaded).not.toHaveBeenCalled();
  await navigate('admin');
  expect(container.querySelector('h1')?.textContent).toBe('Page not found');
  expect(chunks.adminLoaded).not.toHaveBeenCalled();
  await navigate('metrics');
  await vi.waitFor(()=>expect(chunks.metricsLoaded).toHaveBeenCalledOnce());
  expect(container.querySelector('.loading-placeholder')).not.toBeNull();
  expect(container.querySelector('h1')?.textContent).toBe('Metrics');
  expect(container.querySelector('nav')).not.toBeNull();expect(container.querySelector('.site-header')).not.toBeNull();
  expect(container.querySelector('.account-menu-trigger')).not.toBeNull();
  expect(api.metricsEnrichment).not.toHaveBeenCalled();
  await act(async()=>chunks.metricsReady());await waitFor('[role=tab]');
  expect(api.metricsEnrichment).toHaveBeenCalledOnce();
  await navigate('home');await navigate('metrics');await waitFor('[role=tab]');
  expect(api.metricsEnrichment).toHaveBeenCalledOnce();
  await act(async()=>root.unmount());root=createRoot(container);
  await mount('admin','admin');
  await vi.waitFor(()=>expect(chunks.adminLoaded).toHaveBeenCalledOnce());
  expect(container.querySelector('h1')?.textContent).toBe('Admin');
  expect(container.querySelector('.loading-placeholder')).not.toBeNull();
  expect(container.querySelector('.account-menu-trigger')).not.toBeNull();
  await act(async()=>chunks.adminReady());await waitFor('main section.card');
  expect(container.textContent).toContain('Refresh OMDb metadata');
});
it('renders a direct Metrics entry and a fresh authenticated Admin entry',async()=>{
  chunks.metricsReady();chunks.adminReady();
  await mount('metrics');await waitFor('[role=tab]');
  expect(container.querySelector('h1')?.textContent).toBe('Metrics');
  expect(api.metricsEnrichment).toHaveBeenCalledOnce();
  await act(async()=>root.unmount());root=createRoot(container);
  await mount('admin','admin');await waitFor('main section.card');
  expect(container.querySelector('h1')?.textContent).toBe('Admin');
});
it('keeps direct member Admin entry denied even after its chunk has loaded',async()=>{
  await mount('admin');
  expect(container.querySelector('h1')?.textContent).toBe('Page not found');
  expect(container.textContent).not.toContain('Refresh OMDb metadata');
  expect(api.scoreMaintenanceStatus).not.toHaveBeenCalled();
});
