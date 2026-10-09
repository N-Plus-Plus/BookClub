// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import type { Catalog, Movie, SearchResponse, TmdbPreview } from '../../shared/types';

import { api } from '../../frontend/api';
import { installJobMocks } from './maintenance-jobs';
import { App } from '../../frontend/App';




vi.mock('../../frontend/api',() => ({
  api:{maintenanceJobs:vi.fn(),maintenanceJob:vi.fn(),createMaintenanceJob:vi.fn(),claimMaintenanceJob:vi.fn(),stepMaintenanceJob:vi.fn(),releaseMaintenanceJob:vi.fn(),stopMaintenanceJob:vi.fn(),retryMaintenanceJob:vi.fn(),importMaintenanceJob:vi.fn(),collectionRosterStatus:vi.fn(async()=>({collections:[],unavailable:null})),maintainCollectionRosters:vi.fn(),maintenanceCoverage:vi.fn(),maintenanceProvider:vi.fn(),metricsEnrichment:vi.fn(async()=>({movies:{}})),swapRotation:vi.fn(),scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:['f1','f2','f3','f99','saved-7'],eligibleDimensions:30,unavailableDimensions:0,unavailableFilms:0})),maintainMovies:vi.fn(),enrichMetadataSelected:vi.fn(),audit:vi.fn(),deleteSession:vi.fn(),health:vi.fn(),me:vi.fn(),catalog:vi.fn(),rotation:vi.fn(),search:vi.fn(),preview:vi.fn(),detail:vi.fn(),seen:vi.fn(),importMovie:vi.fn(),saveSession:vi.fn(),builders:vi.fn(),saveBuilder:vi.fn(),publishBuilder:vi.fn()},
  ApiClientError:class extends Error {},hasSession:() => true,setUnauthorizedHandler:vi.fn(),setDevMember:vi.fn(),clearSession:vi.fn(),storeSession:vi.fn(),
}));
export const movies: Movie[] = Array.from({length:8},(_,i) => ({id:`saved-${i}`,title:`Film ${i}`,year:1998,original_title:null,release_date:null,runtime:100,overview:'Overview',genres:[],assets:[],external_ids:i === 7 ? [{provider:'tmdb',external_id:'107'}] : [],scores:[],seen:[],classic:false,ranking:null}));
export const catalog: Catalog = {movies,members:[{id:'member-2',display_name:'Member 2',sort_order:2,active:1,avatar:2}],sessions:[],cycles:[]};
export const results: SearchResponse = {local:movies.map(movie => ({id:movie.id,title:movie.title,year:movie.year,poster:null,tmdbId:movie.external_ids[0]?.external_id ?? null})),external:[{provider:'tmdb',externalId:'42',title:'External film',year:2001,poster:'/poster.jpg'}],lookup:{available:true,message:null}};
export const preview: TmdbPreview = {provider:'tmdb',externalId:'42',title:'External film',original_title:null,year:2001,release_date:null,runtime:110,overview:'Preview only',genres:['Drama'],assets:[],director:'Director Name'};
export const harness = {} as {root: Root; container: HTMLDivElement};
export const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve,0)); }); };
export const navigate = async (route: string) => {
  await act(async () => { window.location.hash = `/${route}`; window.dispatchEvent(new HashChangeEvent('hashchange')); }); await flush();
  if (route === 'metrics' || route === 'admin' && harness.container.querySelector('h1')?.textContent === 'Admin') {
    await vi.waitFor(async()=>{await flush();expect(harness.container.querySelector('main .loading-placeholder')).toBeNull();});
  }
};
export const button = (text: string) => [...harness.container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text)!;
export const click = async (element: HTMLElement) => { expect(element).toBeTruthy(); await act(async () => { element.click(); }); await flush(); };
export const input = async (element: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})); });
};
export const search = async () => {
  await input(harness.container.querySelector<HTMLInputElement>('input[maxlength="150"]')!,'film');
  await act(async () => { harness.container.querySelector('.event-workflow .card form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }); await flush();
};
export const lineup = () => [...harness.container.querySelectorAll('.lineup-list .movie-title')].map(element => element.textContent);
beforeEach(async () => {
  vi.resetAllMocks();installJobMocks();vi.mocked(api.collectionRosterStatus).mockResolvedValue({collections:[],unavailable:null});
  localStorage.clear();
  vi.mocked(api.maintenanceCoverage).mockResolvedValue({checks:[],negativeScores:[],enrichment:[],evidence:[],evidenceSupported:true,fieldsSupported:true,fields:[],unavailable:{tmdb:null,omdb:null,mdblist:null},next:null});
  vi.mocked(api.maintenanceProvider).mockImplementation(async(_intent,units)=>({results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'updated',message:'Saved'})),canonicalChanged:true,cacheChanged:false}));
  vi.mocked(api.metricsEnrichment).mockResolvedValue({movies:{}});
  vi.mocked(api.scoreMaintenanceStatus).mockResolvedValue({candidateIds:['f1','f2','f3','f99','saved-7'],eligibleDimensions:30,unavailableDimensions:0,unavailableFilms:0});
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('scrollTo',vi.fn()); vi.stubGlobal('requestAnimationFrame',(callback: FrameRequestCallback) => { callback(0); return 0; });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.mocked(api.health).mockResolvedValue({status:'ok',environment:'test',authenticationRequired:true,googleAuthConfigured:false,demo:false} as Awaited<ReturnType<typeof api.health>>);
  vi.mocked(api.me).mockResolvedValue({viewer:{id:'member-2',display_name:'Member 2',sort_order:2,avatar:2,role:'member'}});
  vi.mocked(api.catalog).mockResolvedValue(catalog);
  vi.mocked(api.rotation).mockResolvedValue({id:1,nominal_slot:2,cycle_id:null,version:0,updated_at:''});
  vi.mocked(api.search).mockResolvedValue(results);
  vi.mocked(api.preview).mockImplementation(async id => ({...preview,externalId:id}));
  vi.mocked(api.detail).mockImplementation(async id => ({...movies.find(movie => movie.id === id)!,appearances:[]}));
  vi.mocked(api.importMovie).mockResolvedValue({...movies[0],id:'canonical-import',title:'Imported film',appearances:[]});
  vi.mocked(api.builders).mockResolvedValue([]);
  vi.mocked(api.saveBuilder).mockImplementation(async (body,id) => ({...body,id:id ?? 'new-set',owner_member_id:'member-2',title:body.title ?? null,notes:body.notes ?? null,revision:1,created_at:'2026-01-01',updated_at:''}));
  window.location.hash = '/event';
  harness.container = document.createElement('div'); document.body.appendChild(harness.container); harness.root = createRoot(harness.container);
  await act(async () => { harness.root.render(createElement(App)); }); await flush();
});
afterEach(async () => { await act(async () => harness.root.unmount()); harness.container.remove(); vi.unstubAllGlobals(); });
