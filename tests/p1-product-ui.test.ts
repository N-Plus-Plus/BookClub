// @vitest-environment jsdom
import { AustralianAvailability } from '../frontend/AustralianAvailability';
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EventScreen } from '../frontend/EventScreen';
import { FilmPicker } from '../frontend/FilmPicker';
import { AdminScreen } from '../frontend/AdminScreen';
import { patchCatalogMovie } from '../frontend/seen-answers';
import { rankMovie } from '../shared/ranking';
import { api } from '../frontend/api';
import type { Catalog, Movie, Rotation, Session } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{dataHealth:vi.fn(async()=>({films:[],scanned:0,next:null,partial:false})),predictions:vi.fn(async()=>[]),maintenanceJobs:vi.fn(async()=>({jobs:[]})),collectionRosterStatus:vi.fn(async()=>({collections:[],unavailable:null})),maintainCollectionRosters:vi.fn(),maintenanceCoverage:vi.fn(async()=>({checks:[],negativeScores:[],enrichment:[],evidence:[],evidenceSupported:true,fieldsSupported:true,fields:[],unavailable:{tmdb:null,omdb:null,mdblist:null},next:null})),saveSession:vi.fn(),search:vi.fn(),preview:vi.fn(),detail:vi.fn(),enrichProvider:vi.fn(),scoreMaintenanceStatus:vi.fn(async()=>({candidateIds:['f1'],eligibleDimensions:1,unavailableDimensions:0,unavailableFilms:0}))},ApiClientError:class extends Error {fields=[];}}));
let root:Root,container:HTMLDivElement,catalog:Catalog;
const rotation:Rotation={id:1,cycle_id:null,nominal_slot:5,version:9,updated_at:''};
const saved=vi.fn();
const button=(name:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent===name)!;
const click=async(element:HTMLElement)=>act(async()=>element.click());
function film(i:number):Movie{
 const seen=[{member_id:'member',seen:0,updated_at:''}],scores=[{provider:'imdb',metric:'rating',raw_value:10-i,raw_scale:10,normalized_value:100-i*10,vote_count:1,fetched_at:'',retrieved_via:'omdb'}];
 return {id:`f${i}`,title:`Film ${i}`,original_title:null,year:2000,runtime:100,release_date:null,overview:null,genres:[],assets:[],external_ids:[{provider:'tmdb',external_id:String(i)},{provider:'imdb',external_id:`tt000000${i}`}],scores,seen,classic:true,ranking:rankMovie(scores,seen,[{id:'member',display_name:'Member',active:1,sort_order:1}],i)};
}
const renderEvent=async(options:Partial<Parameters<typeof EventScreen>[0]>={})=>act(async()=>root.render(h(EventScreen,{catalog,rotation,writesEnabled:true,onMovie:()=>{},onSaved:saved,viewer:null,...options})));
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});HTMLElement.prototype.scrollIntoView=vi.fn();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);catalog={members:[{id:'member',display_name:'Member',active:1,sort_order:1}],movies:[film(3),film(1),film(2),{...film(4),ranking:null}],sessions:[],cycles:[]};vi.mocked(api.saveSession).mockResolvedValue({});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
it.each([0,1,2,3])('attests only available ranked films (%i), locking first two and initially excluding third',async count=>{
 catalog.movies=catalog.movies.filter(movie=>Number(movie.id.slice(1))<=count || movie.id==='f4');await renderEvent();
 const choices=[...container.querySelectorAll<HTMLInputElement>('.classics-attestation input')];expect(choices).toHaveLength(count);
 for(const [index,choice] of choices.entries()){expect(choice.checked).toBe(index<2);expect(choice.disabled).toBe(index<2);expect(choice.getAttribute('aria-label')).toContain(index<2?'required next Classic':'optional third Classic');}
 expect(container.querySelector('.classics-attestation')?.textContent).not.toContain('Film 4');expect(container.textContent).toContain('Add another film');
 if(count){await click(button('Save event'));expect(api.saveSession).toHaveBeenLastCalledWith(expect.objectContaining({movie_ids:Array.from({length:Math.min(count,2)},(_,i)=>`f${i+1}`),complete_turn:true,turn_version:9}),undefined);}
 else {expect(container.textContent).toContain('No eligible ranked Classics');await click(button('Save event'));expect(api.saveSession).not.toHaveBeenCalled();}
});
it('optional toggle submits once, removes on uncheck, and manual confirmation cannot duplicate locked recommendations',async()=>{
 await renderEvent();const third=container.querySelectorAll<HTMLInputElement>('.classics-attestation input')[2];await click(third);await renderEvent({confirmedMovie:catalog.movies.find(movie=>movie.id==='f1')!});await click(button('Save event'));
 expect(api.saveSession).toHaveBeenLastCalledWith(expect.objectContaining({movie_ids:['f1','f2','f3']}),undefined);
 await click(third);await renderEvent({confirmedMovie:film(5)});await click(button('Save event'));expect(api.saveSession).toHaveBeenLastCalledWith(expect.objectContaining({movie_ids:['f1','f2','f5']}),undefined);
 expect(container.querySelector('button[aria-label="Remove Film 1"]')).toBeNull();
});
it('catalogue rerender retains locked seeds and removes a now-ineligible optional film',async()=>{
 await renderEvent();await click(container.querySelectorAll<HTMLInputElement>('.classics-attestation input')[2]);
 catalog={...catalog,movies:catalog.movies.map(movie=>movie.id==='f3'?{...movie,ranking:{...movie.ranking!,eligible:false}}:movie)};await renderEvent();
 expect(container.querySelectorAll('.classics-attestation input')).toHaveLength(2);await click(button('Save event'));expect(api.saveSession).toHaveBeenLastCalledWith(expect.objectContaining({movie_ids:['f1','f2']}),undefined);
});
it.each(['member','historical'])('does not inject recommendations into %s event',async mode=>{
 await renderEvent(mode==='member'?{rotation:{...rotation,nominal_slot:2}}:{initial:{id:'old',kind:'classics',movies:[film(4)],event_date:'2000-01-01',date_precision:'exact',cycle_id:null,cycle_slot:5,host_member_id:null,legacy_cycle_label:null} as Session});expect(container.querySelector('.classics-attestation')).toBeNull();
 if(mode==='historical') expect(container.querySelector('.lineup-list')?.textContent).toContain('Film 4');
});
it('availability groups cached primary options and equal-weight rent, suppressing buy without making provider calls, including saved search results',async()=>{
 const movie={...film(1),au_watch_offers:([{service_id:'1',name:'Netflix',access_type:'subscription',link:null},{service_id:'2',name:'ABC iview',access_type:'free',link:null},{service_id:'3',name:'SBS',access_type:'ads',link:null},{service_id:'4',name:'Apple TV',access_type:'rent',link:null},{service_id:'4',name:'Apple TV',access_type:'buy',link:null}] as const).map(offer=>({...offer}))};
 await act(async()=>root.render(h(FilmPicker,{builder:true,selected:[movie],movieById:new Map([[movie.id,movie]]),onSelected:()=>{},onMovie:()=>{}})));
 expect(container.textContent).toContain('Stream: Netflix');expect(container.textContent).toContain('Free: ABC');expect(container.textContent).not.toContain('With ads: SBS');expect([...container.querySelectorAll('.au-availability .meta')].map(p=>p.textContent)).toEqual(['Stream: Netflix','Rent: Apple']);expect(container.textContent).not.toContain('Buy:');
 expect(api.preview).not.toHaveBeenCalled();expect(api.enrichProvider).not.toHaveBeenCalled();expect(api.search).not.toHaveBeenCalled();
 const patched=patchCatalogMovie({...catalog,movies:[movie]},film(1));expect(patched.movies[0].au_watch_offers).toEqual(movie.au_watch_offers);
 expect(patchCatalogMovie(patched,{...film(1),au_watch_offers:[]}).movies[0].au_watch_offers).toEqual([]);
 vi.mocked(api.search).mockResolvedValue({local:[{id:movie.id,title:movie.title,year:movie.year,tmdbId:'1',poster:null}],external:[{provider:'tmdb',externalId:'9',title:'Unsaved',year:2000,poster:null}],lookup:{available:true,message:null}});
 const input=container.querySelector<HTMLInputElement>('input[maxlength="150"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'film');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(container.querySelector('.search-row .au-availability')?.textContent).toContain('Stream: Netflix');expect(container.querySelectorAll('.search-row .au-availability')).toHaveLength(1);expect(api.preview).not.toHaveBeenCalled();expect(api.enrichProvider).not.toHaveBeenCalled();

});
it('Admin renders both groups, eighteen cards and accurate AU collection text',async()=>{
 await act(async()=>root.render(h(AdminScreen,{catalog,writesEnabled:true,onMovie:()=>{},onUpdated:async()=>{}})));
 const titles=[...container.querySelectorAll('section.card:not(.ai-predictions-card) h3')].map(h=>h.textContent);
 expect(titles).toEqual(['Populate missing data','Populate missing scores','Populate missing OMDb metadata','Populate missing TMDB metadata and artwork','Populate missing TMDB enrichment','Populate missing MDBList enrichment','Populate missing TMDB collections','Populate missing OMDb awards','Refresh all data','Refresh scores','Refresh OMDb metadata','Refresh TMDB metadata and artwork','Refresh TMDB enrichment','Refresh MDBList enrichment','Refresh TMDB collections','Refresh OMDb awards','Populate missing collection rosters','Refresh collection rosters']);
 for(const title of titles.slice(0,16)){const heading=[...container.querySelectorAll('h3')].find(h=>h.textContent===title)!;const section=heading.closest('section')!;expect(section.contains(button(title!))).toBe(true);expect(section.textContent).toContain('Progress and unresolved issues are stored on the server');}
 expect(container.querySelector('#refresh-tmdb-enrichment-heading')?.closest('section')?.textContent).toContain('Australian watch availability');expect(container.querySelector('#refresh-mdblist-enrichment-heading')?.closest('section')?.textContent).toContain('regionless watch data is excluded');
});

it('seeds hostless Classics at the first exceptional position and does not attest Sean at the last',async()=>{
 await renderEvent({rotation:{...rotation,nominal_slot:1,cycle_id:null,classics_first:1}});expect(container.querySelector('.classics-attestation')).toBeTruthy();
 await act(async()=>root.unmount());root=createRoot(container);
 await renderEvent({rotation:{...rotation,nominal_slot:5,cycle_id:'exceptional',classics_first:1}});expect(container.querySelector('.classics-attestation')).toBeNull();
});

it('shared availability retains ads outside the selected Builder lineup',async()=>{
 const movie={...film(1),au_watch_offers:[{service_id:'ads',name:'SBS',access_type:'ads' as const,link:null}]};
 await act(async()=>root.render(h(AustralianAvailability,{movie,empty:true})));expect(container.textContent).toContain('With ads: SBS');
 await act(async()=>root.render(h(AustralianAvailability,{movie,empty:true,showAds:false})));expect(container.textContent).toContain('No cached Australian streaming or rental options to display');expect(movie.au_watch_offers).toHaveLength(1);
});
