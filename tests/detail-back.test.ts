// @vitest-environment jsdom
import { harness,movies,flush,navigate,button,click,input,lineup } from './helpers/app-integration';
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import { api } from '../frontend/api';
import { App } from '../frontend/App';

it('returns from ordinary Builder lineup links to the same editor and unsaved draft',async()=>{
  vi.mocked(api.builders).mockResolvedValue([{id:'set',owner_member_id:'member-2',title:'Original',notes:null,movie_ids:[movies[0].id],revision:1,created_at:'2026-01-01',updated_at:''}]);
  vi.mocked(api.saveBuilder).mockImplementation(()=>new Promise(()=>{}));
  await navigate('builder');await click(button('Open set'));
  const title=harness.container.querySelector<HTMLInputElement>('input[maxlength="300"]')!;
  await input(title,'Private pending draft');
  const editor=harness.container.querySelector('.builder-workflow');
  await click(harness.container.querySelector<HTMLAnchorElement>('.builder-lineup .movie-link')!);
  await vi.waitFor(async()=>{await flush();expect(button('Back')).toBeTruthy();});expect(button('Add to set')).toBeUndefined();expect(editor?.parentElement?.hidden).toBe(true);
  await click(button('Back'));await vi.waitFor(async()=>{await flush();expect(harness.container.querySelector('h1')?.textContent).toBe('Builder');});
  expect(harness.container.querySelector('.builder-workflow')).toBe(editor);
  expect(title.value).toBe('Private pending draft');expect(lineup()).toEqual(['Film 0']);expect(api.builders).toHaveBeenCalledTimes(1);
});
it('direct detail and refreshed preview entries use Home without leaving the app',async()=>{
  for(const route of ['movie/saved-0','preview/tmdb/42']){
    await act(async()=>harness.root.unmount());harness.root=createRoot(harness.container);window.location.hash=`/${route}`;
    await act(async()=>harness.root.render(createElement(App)));await flush();
    await click(button('Back'));await flush();expect(window.location.hash).toBe('#/home');expect(harness.container.querySelector('h1')?.textContent).toBe('Home');
  }
});


it('returns from saved overview links through browser and app Back without reloading sets',async()=>{
 vi.mocked(api.builders).mockResolvedValue([{id:'private-overview',owner_member_id:'member-2',title:'Private overview',notes:'Private note',movie_ids:[movies[0].id,movies[1].id],revision:1,created_at:'2026-01-01',updated_at:''}]);
 await navigate('builder');const overview=harness.container.querySelector('.builder-workflow');
 const openFilm=async()=>{await click(harness.container.querySelector<HTMLAnchorElement>('.builder-poster-film')!);await vi.waitFor(async()=>{await flush();expect(button('Back')).toBeTruthy();});expect(window.location.hash).toBe(`#/movie/${movies[0].id}`);};
 const returned=async()=>vi.waitFor(async()=>{await flush();expect(harness.container.querySelector('h1')?.textContent).toBe('Builder');});
 await openFilm();window.history.back();await returned();expect(harness.container.querySelector('.builder-workflow')).toBe(overview);
 window.history.forward();await vi.waitFor(async()=>{await flush();expect(button('Back')).toBeTruthy();});await click(button('Back'));await returned();
 expect(api.builders).toHaveBeenCalledTimes(1);await click(button('Open set'));expect(lineup()).toEqual(['Film 0','Film 1']);
});
