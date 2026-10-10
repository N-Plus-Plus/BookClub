// @vitest-environment jsdom
import { harness, catalog, flush, navigate, button, click } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { api, setDevMember } from '../frontend/api';
import { jobFixture,installJobMocks } from './helpers/maintenance-jobs';
import { App } from '../frontend/App';

describe('Admin screen and Account navigation',() => {
  const asAdmin = async () => {
    vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
    await act(async()=>harness.root.unmount()); harness.root=createRoot(harness.container);
    await act(async()=>harness.root.render(createElement(App))); await flush();
  };
  it('uses ordinary not-found treatment for a member',async()=>{
    await click(harness.container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect(harness.container.querySelector('.account-menu-dropdown')?.textContent).toBe('Show AILogout');
    expect(harness.container.querySelector('a[href="#/admin"]')).toBeNull();
    await navigate('admin');
    expect(harness.container.querySelector('h1')?.textContent).toBe('Page not found');
    expect(button('Populate missing TMDB metadata and artwork')).toBeUndefined();
    expect(button('Populate missing scores')).toBeUndefined();
    expect(harness.container.textContent).not.toContain('Scores and OMDb metadata');
  });
  it('renders eighteen maintenance operations and Swap Turn only on Admin and keeps them out of navigation and member screens',async()=>{
    await asAdmin(); await navigate('admin');
    expect(harness.container.querySelector('h1')?.textContent).toBe('Admin');
    expect(harness.container.querySelectorAll('main section.card h2,main section.card h3')).toHaveLength(22);
    for(const label of ['Populate missing scores','Refresh scores','Refresh OMDb metadata','Populate missing TMDB metadata and artwork']) expect(button(label)).toBeTruthy();
    expect(harness.container.textContent).toContain('Refresh OMDb metadata');
    expect(harness.container.textContent).toContain('Populate missing TMDB metadata and artwork');
    expect(harness.container.textContent).toContain('Refresh TMDB enrichment');
    expect(harness.container.textContent).toContain('Refresh MDBList enrichment');
    await click(harness.container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect(harness.container.querySelector('.account-menu-dropdown')?.textContent).toBe('AdminShow AILogout');
    expect(harness.container.querySelector('.account-menu-dropdown a[href="#/admin"]')).not.toBeNull();
    for(const nav of harness.container.querySelectorAll('nav')) expect(nav.textContent).not.toContain('Admin');
    await navigate('classics');
    for(const tab of ['Ranked','Unranked','Seen']) {
      await click(button(tab)); expect(button('Populate missing scores')).toBeUndefined();
      expect(harness.container.querySelector('.classics-maintenance')).toBeNull();
    }
    await navigate('metrics'); expect(button('Populate missing TMDB metadata and artwork')).toBeUndefined();
    await navigate('home'); expect(harness.container.textContent).not.toContain('Swap current turn');
    await navigate('admin'); expect(harness.container.querySelector('main .card h2')?.textContent).toBe('Swap current turn'); expect(harness.container.querySelector('main .card:first-child details')).toBeNull();
    await navigate('movie/saved-7'); expect(harness.container.textContent).not.toContain('Admin Ã‚Â· score maintenance');
    expect(button('Refresh scores')).toBeUndefined();
  });
  it('navigates from the admin Account link and closes the dropdown',async()=>{
    await asAdmin(); await navigate('home');
    await click(harness.container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect([...harness.container.querySelectorAll('.account-menu-dropdown .select__option')].map(item=>item.textContent)).toEqual(['Admin','Show AI','Logout']);
    await click(harness.container.querySelector<HTMLAnchorElement>('.account-menu-dropdown a[href="#/admin"]')!);
    expect(window.location.hash).toBe('#/admin');
    await vi.waitFor(async()=>{await flush();expect(harness.container.querySelector('h1')?.textContent).toBe('Admin');});
    expect(harness.container.querySelector('h1')?.textContent).toBe('Admin');
    expect(harness.container.querySelector('.account-menu-dropdown')).toBeNull();
  });
  it('runs both moved actions through durable jobs and retains live feedback',async()=>{
    await asAdmin();await navigate('admin');
    const bootstrap=[vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length],catalogCalls=vi.mocked(api.catalog).mock.calls.length;
    await click(button('Refresh scores'));expect(api.createMaintenanceJob).toHaveBeenCalledWith(expect.any(String),'refresh','scores');
    await click(button('Populate missing TMDB metadata and artwork'));expect(api.createMaintenanceJob).toHaveBeenCalledWith(expect.any(String),'populate','tmdb-metadata');
    expect(harness.container.textContent).toContain('1 successful');expect(api.maintenanceProvider).not.toHaveBeenCalled();
    expect([vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length]).toEqual(bootstrap);expect(api.catalog).toHaveBeenCalledTimes(catalogCalls+2);
  });
  it('does not render admin controls without an authenticated viewer',async()=>{
    vi.mocked(api.me).mockResolvedValue({viewer:null});
    await act(async()=>harness.root.unmount()); harness.root=createRoot(harness.container);
    window.location.hash='/admin'; await act(async()=>harness.root.render(createElement(App))); await flush();
    expect(button('Populate missing scores')).toBeUndefined(); expect(button('Populate missing TMDB metadata and artwork')).toBeUndefined();
    expect(harness.container.querySelector('h1')?.textContent).not.toBe('Admin');
  });
  it('stops after a pending durable batch and preserves partial counts',async()=>{
    const saved={...jobFixture('tmdb-metadata','populate'),counts:{...jobFixture().counts,pending:3}};
    const state=installJobMocks(saved);let release!:(value:typeof saved)=>void;
    vi.mocked(api.stepMaintenanceJob).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    await asAdmin();await navigate('admin');await click(button('Resume remaining'));
    expect(button('Refresh scores').disabled).toBe(true);await click(button('Stop after current batch'));
    state.set({...saved,state:'paused',counts:{...saved.counts,pending:1,successful:2,updated:2},requests:2});
    vi.mocked(api.stepMaintenanceJob).mockImplementation(async()=>state.get()!);
    await act(async()=>release(state.get()!));await flush();expect(harness.container.textContent).toContain('2 successful');expect(harness.container.textContent).toContain('1 unfinished');
    expect(button('Resume remaining')).toBeTruthy();expect(api.stopMaintenanceJob).toHaveBeenCalled();expect(api.createMaintenanceJob).not.toHaveBeenCalled();
  });
  it('keeps provider cooldown diagnostics beside the owning durable card',async()=>{
    installJobMocks({...jobFixture('scores'),state:'awaiting_cooldown',diagnostic:'Score quota reached.',counts:{...jobFixture().counts,pending:0,blocked:1}});
    await asAdmin();await navigate('admin');const card=harness.container.querySelector('#refresh-scores-heading')!.closest('section')!;
    expect(card.textContent).toContain('Score quota reached.');expect(card.textContent).toContain('1 temporarily blocked');expect(card.querySelector('progress')?.dataset.state).toBe('interrupted');
    expect(api.stepMaintenanceJob).not.toHaveBeenCalled();
  });

});

it('shows dev tools only on local Admin and reloads identity through bootstrap',async()=>{
 vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,tmdbConfigured:false,mdblistConfigured:false,omdbConfigured:false,demo:true});
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
 await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);await act(async()=>harness.root.render(createElement(App)));await flush();
 await navigate('classics');expect(harness.container.querySelector('.developer-tools')).toBeNull();
 expect(harness.container.querySelector('.app-layout > .demo-label')?.textContent).toBe('Local disposable database');
 expect(harness.container.querySelector('main .demo-label,.page-heading .demo-label')).toBeNull();
 await navigate('admin');await vi.waitFor(async () => { await flush(); expect(harness.container.querySelector('.developer-tools')).toBeTruthy(); });
 expect(button('Refresh dev DB from production')).toBeTruthy();expect(button('Confirm local replacement')).toBeUndefined();
 await click(button('Refresh dev DB from production'));expect(button('Confirm local replacement')).toBeTruthy();await click(button('Cancel'));
 const before=[vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length];
 vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'member'}});
 await act(async()=>{const select=harness.container.querySelector('.developer-tools select')!;Object.assign(select,{value:catalog.members[0].id});select.dispatchEvent(new Event('change',{bubbles:true}));});await flush();
 expect(setDevMember).toHaveBeenCalledWith(catalog.members[0].id);
 expect([vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length]).toEqual(before.map(n=>n+1));
 expect(harness.container.querySelector('h1')?.textContent).toBe('Page not found');expect(harness.container.querySelector('.developer-tools')).toBeNull();
});
