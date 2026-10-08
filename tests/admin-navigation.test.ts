// @vitest-environment jsdom
import { harness, movies, catalog, flush, navigate, button, click } from './helpers/app-integration';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { api, setDevMember } from '../frontend/api';
import { App } from '../frontend/App';

describe('Admin screen and Account navigation',() => {
  const asAdmin = async () => {
    vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
    await act(async()=>harness.root.unmount()); harness.root=createRoot(harness.container);
    await act(async()=>harness.root.render(createElement(App))); await flush();
  };
  it('uses ordinary not-found treatment for a member',async()=>{
    await click(harness.container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect(harness.container.querySelector('.account-menu-dropdown')?.textContent).toBe('Logout');
    expect(harness.container.querySelector('a[href="#/admin"]')).toBeNull();
    await navigate('admin');
    expect(harness.container.querySelector('h1')?.textContent).toBe('Page not found');
    expect(button('Fill missing TMDB metadata')).toBeUndefined();
    expect(button('Populate missing scores')).toBeUndefined();
    expect(harness.container.textContent).not.toContain('Scores and OMDb metadata');
  });
  it('renders six maintenance operations and Swap Turn only on Admin and keeps them out of navigation and member screens',async()=>{
    await asAdmin(); await navigate('admin');
    expect(harness.container.querySelector('h1')?.textContent).toBe('Admin');
    expect(harness.container.querySelectorAll('main section.card h2')).toHaveLength(7);
    for(const label of ['Populate missing scores','Refresh scores','Refresh OMDb metadata','Fill missing TMDB metadata']) expect(button(label)).toBeTruthy();
    expect(harness.container.textContent).toContain('Refresh OMDb metadata');
    expect(harness.container.textContent).toContain('Fill missing TMDB metadata and artwork');
    expect(harness.container.textContent).toContain('Refresh TMDB enrichment');
    expect(harness.container.textContent).toContain('Refresh MDBList enrichment');
    await click(harness.container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect(harness.container.querySelector('.account-menu-dropdown')?.textContent).toBe('AdminLogout');
    expect(harness.container.querySelector('.account-menu-dropdown a[href="#/admin"]')).not.toBeNull();
    for(const nav of harness.container.querySelectorAll('nav')) expect(nav.textContent).not.toContain('Admin');
    await navigate('classics');
    for(const tab of ['Ranked','Unranked','Seen']) {
      await click(button(tab)); expect(button('Populate missing scores')).toBeUndefined();
      expect(harness.container.querySelector('.classics-maintenance')).toBeNull();
    }
    await navigate('metrics'); expect(button('Fill missing TMDB metadata')).toBeUndefined();
    await navigate('home'); expect(harness.container.textContent).not.toContain('Swap current turn');
    await navigate('admin'); expect(harness.container.querySelector('main .card h2')?.textContent).toBe('Swap current turn'); expect(harness.container.querySelector('main .card:first-child details')).toBeNull();
    await navigate('movie/saved-7'); expect(harness.container.textContent).not.toContain('Admin · score maintenance');
    expect(button('Refresh scores')).toBeUndefined();
  });
  it('navigates from the admin Account link and closes the dropdown',async()=>{
    await asAdmin(); await navigate('home');
    await click(harness.container.querySelector<HTMLButtonElement>('.account-menu-trigger')!);
    expect([...harness.container.querySelectorAll('.account-menu-dropdown .select__option')].map(item=>item.textContent)).toEqual(['Admin','Logout']);
    await click(harness.container.querySelector<HTMLAnchorElement>('.account-menu-dropdown a[href="#/admin"]')!);
    expect(window.location.hash).toBe('#/admin');
    await vi.waitFor(async()=>{await flush();expect(harness.container.querySelector('h1')?.textContent).toBe('Admin');});
    expect(harness.container.querySelector('h1')?.textContent).toBe('Admin');
    expect(harness.container.querySelector('.account-menu-dropdown')).toBeNull();
  });
  it('runs both moved maintenance actions and retains their live feedback',async()=>{
    const movie=movies[7];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,sessions:[{id:'event',movies:[movie],event_date:'2030-01-01',date_precision:'exact',host_member_id:'member-2',kind:'hosted',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]});
    vi.mocked(api.maintainMovies).mockResolvedValue({results:[{movie:{...movie,appearances:[]},providers:[{provider:'tmdb',status:'success',count:1,message:'Saved'}]}]} as Awaited<ReturnType<typeof api.maintainMovies>>);
    vi.mocked(api.enrichMetadataSelected).mockResolvedValue({results:[{movieId:movie.id,title:movie.title,provider:'tmdb',status:'success',message:'Updated.'}]});
    await asAdmin(); await navigate('admin');
    const bootstrapCalls=[vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length],catalogCalls=vi.mocked(api.catalog).mock.calls.length;
    await click(button('Refresh scores'));
    expect(api.maintainMovies).toHaveBeenCalledWith('refresh',[movie.id]);
    expect(harness.container.querySelector('progress')?.value).toBe(1);
    vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:catalog.movies.map(m=>m.id===movie.id ? {...m,director:'Director',tmdb_metadata_checked_at:new Date().toISOString(),tmdb_artwork_checked_at:new Date().toISOString()} : m)});
    await click(button('Fill missing TMDB metadata'));
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();
    expect(harness.container.textContent).toContain('1 successfully updated');
    expect(harness.container.textContent).toContain('0 identified films remaining');
    expect([vi.mocked(api.health).mock.calls.length,vi.mocked(api.me).mock.calls.length]).toEqual(bootstrapCalls);
    expect(api.catalog).toHaveBeenCalledTimes(catalogCalls+2);
  });
  it('does not render admin controls without an authenticated viewer',async()=>{
    vi.mocked(api.me).mockResolvedValue({viewer:null});
    await act(async()=>harness.root.unmount()); harness.root=createRoot(harness.container);
    window.location.hash='/admin'; await act(async()=>harness.root.render(createElement(App))); await flush();
    expect(button('Populate missing scores')).toBeUndefined(); expect(button('Fill missing TMDB metadata')).toBeUndefined();
    expect(harness.container.querySelector('h1')?.textContent).not.toBe('Admin');
  });
  it('stops TMDB work after the pending batch and preserves partial counts on Admin',async()=>{
    let release!: (value: Awaited<ReturnType<typeof api.enrichMetadataSelected>>) => void;
    const queue=[...catalog.movies,{...movies[7],id:'second',external_ids:[{provider:'tmdb',external_id:'108'}]},{...movies[7],id:'third',external_ids:[{provider:'tmdb',external_id:'109'}]}];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:queue});
    vi.mocked(api.enrichMetadataSelected).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    await asAdmin(); await navigate('admin');
    await click(button('Fill missing TMDB metadata'));
    expect(button('Fill missing TMDB metadata').disabled).toBe(true);
    await click(button('Stop after this batch'));
    const sent=vi.mocked(api.enrichMetadataSelected).mock.calls[0][0];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,movies:queue.map(m=>sent.includes(m.id) ? {...m,director:'Director',tmdb_metadata_checked_at:new Date().toISOString(),tmdb_artwork_checked_at:new Date().toISOString()} : m)});
    await act(async()=>release({results:sent.map(movieId=>({movieId,title:'Film',provider:'tmdb',status:'success',message:'Updated.'}))}));
    await flush();
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();
    expect(harness.container.textContent).toContain('1 identified films remaining');
    expect(harness.container.textContent).toContain('2 successfully updated');
    expect(harness.container.textContent).toContain('Stopped. Completed updates are saved');
    expect(button('Stop after this batch')).toBeUndefined();
  });
  it('keeps provider failures and cooldown feedback beside both Admin maintenance sections',async()=>{
    const movie=movies[7];
    vi.mocked(api.catalog).mockResolvedValue({...catalog,sessions:[{id:'event',movies:[movie],event_date:'2030-01-01',date_precision:'exact',host_member_id:'member-2',kind:'hosted',cycle_id:null,cycle_slot:null,legacy_cycle_label:null}]});
    vi.mocked(api.maintainMovies).mockResolvedValue({results:[{movie:{...movie,appearances:[]},providers:[{provider:'tmdb',status:'failed',count:0,message:'Score quota reached.',retryAfter:120}]}]});
    vi.mocked(api.enrichMetadataSelected).mockResolvedValue({results:[{movieId:movie.id,title:movie.title,provider:'tmdb',status:'failed',message:'Artwork quota reached.',retryAfter:60}]});
    await asAdmin(); await navigate('admin');
    await click(button('Refresh scores'));
    expect(harness.container.querySelector('#refresh-maintenance-heading')?.closest('section')?.textContent).toContain('Score quota reached. Wait 2 min before retrying.');
    await click(button('Fill missing TMDB metadata'));
    const tmdbSection=harness.container.querySelector('[aria-labelledby="tmdb-maintenance-heading"]');
    expect(tmdbSection?.textContent).toContain('1 failures');
    expect(tmdbSection?.textContent).toContain('Artwork quota reached. Retry after at least 1 min.');
    expect(tmdbSection?.textContent).toContain('Completed updates are saved');
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();
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
