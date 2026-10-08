// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { availabilityProviderName } from '../frontend/availability-provider-name';
import { AustralianAvailability } from '../frontend/AustralianAvailability';
import { FilmPicker } from '../frontend/FilmPicker';
import { BuilderScreen } from '../frontend/BuilderScreen';
import { RankingCard, SessionCard } from '../frontend/components';
import { SeenScreen } from '../frontend/SeenScreen';
import { metricsFilm, metricsEvent } from './metrics-fixture';
import { rankMovie } from '../shared/ranking';
import { api } from '../frontend/api';
import type { AuWatchOffer, BuilderSet, Catalog, SearchResponse } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{search:vi.fn(),preview:vi.fn(),detail:vi.fn(),builders:vi.fn(),saveBuilder:vi.fn(),deleteBuilder:vi.fn()}}));
const members=[1,2,3,4].map(i=>({id:`m${i}`,display_name:`Member ${i}`,active:1,sort_order:i,avatar:i}));
const film=metricsFilm('film',{director:'Stored Director',au_classification:'M',classic:true,seen:[{member_id:'m1',seen:1,updated_at:''},{member_id:'m2',seen:0,updated_at:''},{member_id:'m3',seen:0,updated_at:''}]});
film.ranking=rankMovie(film.scores,film.seen,members);
const catalog:Catalog={members,movies:[film],sessions:[],cycles:[]};
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.resetAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);vi.mocked(api.builders).mockResolvedValue([]);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=async(element:React.ReactNode)=>act(async()=>root.render(element));
const button=(name:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
const click=async(element:HTMLElement)=>act(async()=>element.click());

it.each([
 ['Apple TV','Apple'],['Apple TV+','Apple'],['Apple TV Store','Apple'],[' amazon PRIME video ','Prime'],['Prime Video','Prime'],
 ['Google Play Movies','Google'],['Google TV','Google'],['YouTube Movies','YouTube'],['YouTube','YouTube'],
 ['Fetch TV','Fetch'],['Fetch','Fetch'],['BINGE','Binge'],['Disney+','Disney'],['Disney Plus','Disney'],
 ['NETFLIX','Netflix'],['Stan','Stan'],['SBS On Demand','SBS'],['ABC iview','ABC'],['Paramount Plus','Paramount'],
 ['BritBox Amazon Channel','BritBox'],['MUBI','MUBI'],['Tubi TV','Tubi'],['Unknown Brand Films','Unknown Brand Films'],
 ['Apple Cinema Club','Apple Cinema Club'],['Prime Independent','Prime Independent'],
])('uses a conservative display alias for %s', (name,expected)=>expect(availabilityProviderName(name)).toBe(expected));

const offer=(name:string,access_type:AuWatchOffer['access_type']):AuWatchOffer=>({name,access_type,service_id:name,link:null});
it('deduplicates normalised brands per category in original order without mutating cached offers',async()=>{
 const offers=[offer('Apple TV+','subscription'),offer('Netflix','subscription'),offer('Apple TV','subscription'),offer('NETFLIX','subscription'),offer('Unknown Brand','subscription'),offer('Apple TV Store','rent'),offer('Apple TV','rent'),offer('Apple TV','buy')];
 const before=JSON.stringify(offers);await render(h(AustralianAvailability,{movie:{...film,au_watch_offers:offers}}));
 expect([...container.querySelectorAll('.au-availability p')].map(p=>p.textContent)).toEqual(['Stream: Apple · Netflix · Unknown Brand','Rent: Apple']);
 expect([...container.querySelectorAll('.au-availability p')].map(p=>p.className)).toEqual(['meta','meta']);expect(JSON.stringify(offers)).toBe(before);
});
it.each(['subscription','rent','buy'] as const)('displays only supported summary categories for %s-only offers',async access=>{
 await render(h(AustralianAvailability,{movie:{...film,au_watch_offers:[offer('Apple TV',access)]},empty:true}));
 expect(container.textContent).toBe(access==='buy'?'No cached Australian streaming or rental options to display':`${access==='rent'?'Rent':'Stream'}: Apple`);
 expect(container.textContent).not.toContain('Buy:');
});
it('omits purchase-only summaries when empty explanations were not requested, retaining uncached wording',async()=>{
 await render(h(AustralianAvailability,{movie:{...film,au_watch_offers:[offer('Apple TV','buy')]}}));expect(container.innerHTML).toBe('');
 await render(h(AustralianAvailability,{movie:{...film,au_watch_offers:[]},empty:true}));expect(container.textContent).toBe('Australian streaming availability not currently cached');
});
it.each(['home','classics'] as const)('groups compact metadata and counts beside the poster on %s without duplicates',async variant=>{
 await render(h(RankingCard,{movie:film,variant,members,rank:1}));
 const copy=container.querySelector('.movie-copy')!;
 expect([...copy.children].map(c=>c.textContent)).toEqual(['Film film','2001 · 100 min · M','Stored Director',`1 Seen · 2 Haven't · 1 Unknown${variant==='classics'?' (Member 4)':''}`]);
 expect(container.querySelectorAll('.compact-seen-summary')).toHaveLength(1);expect(container.querySelector('.ranking-score > .meta')).toBeNull();
 expect(container.querySelector('.candidate-identity')?.nextElementSibling?.querySelector('.ranking-source-scores')).toBeTruthy();
});
it('shares title/metadata/director hierarchy for sessions and omits unavailable lines without inventing counts',async()=>{
 for(const variant of ['home','history'] as const){await render(h(SessionCard,{session:metricsEvent('event',[film]),members,variant}));expect([...container.querySelector('.movie-copy')!.children].map(c=>c.textContent)).toEqual(['Film film','2001 · 100 min · M','Stored Director']);expect(container.querySelector('.compact-seen-summary')).toBeNull();}
 await render(h(SessionCard,{session:metricsEvent('event',[{...film,director:'Unknown',au_classification:null}]),members,variant:'history'}));expect(container.querySelector('.film-director')).toBeNull();expect(container.querySelector('.movie-copy .meta')?.textContent).toBe('2001 · 100 min');
});

const results=(count:number):SearchResponse=>({local:Array.from({length:count},(_,i)=>({id:`f${i}`,title:`Original Film ${i}`,year:2001,tmdbId:null,poster:null})),external:[],lookup:{available:true,message:null}});
const search=async()=>{const input=container.querySelector<HTMLInputElement>('[aria-label="Search films"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'film');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>input.closest('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));};
it.each([0,1,6,7])('shows search pagination only when needed for %i results',async count=>{
 vi.mocked(api.search).mockResolvedValue(results(count));await render(h(FilmPicker,{selected:[],onSelected:vi.fn(),onMovie:vi.fn(),historyMovieIds:new Set(['f0'])}));
 expect(container.textContent).not.toContain('Search saved films');expect(container.querySelector('[aria-label="Search films"]')?.hasAttribute('required')).toBe(true);
 await search();expect(api.search).toHaveBeenCalledWith('film');expect(container.querySelectorAll('.search-pagination')).toHaveLength(count>6?1:0);
 if(count){const badge=container.querySelector('.search-history-badge')!;expect(badge.textContent).toBe('Seen it');expect(badge.previousElementSibling?.textContent).toBe('Original Film 0');expect(badge.parentElement?.className).toBe('film-title-line');expect(container.querySelectorAll('.search-history-badge')).toHaveLength(1);}
 if(count>6){expect(button('Previous').disabled).toBe(true);await click(button('Next'));expect(container.querySelector('.search-row .movie-title')?.textContent).toBe('Original Film 6');expect(button('Next').disabled).toBe(true);expect(container.querySelector('.search-pagination [role="status"]')).toBeTruthy();}
});
it('keeps existing-set deletion in the action row, requires confirmation, and flushes the latest revision',async()=>{
 const set:BuilderSet={id:'set',title:'Saved set',notes:'Preserved',movie_ids:[film.id],owner_member_id:'m1',revision:7,created_at:'2026-01-01',updated_at:''};
 vi.mocked(api.builders).mockResolvedValue([set]);vi.mocked(api.saveBuilder).mockImplementation(async body=>({...set,...body,revision:8}));vi.mocked(api.deleteBuilder).mockResolvedValue(undefined);
 await render(h(BuilderScreen,{catalog,viewer:{...members[0],role:'member'},rotation:{id:1,nominal_slot:1,cycle_id:null,version:1,updated_at:''},onMovie:vi.fn(),onPublished:vi.fn()}));await click(button('Open set'));
 expect([...container.querySelectorAll('.builder-editor-actions button')].map(b=>b.textContent)).toEqual(['All sets','Delete set','Use set','Save set']);expect(container.querySelector('.builder-delete')).toBeNull();
 await click(button('Delete set'));expect(api.deleteBuilder).not.toHaveBeenCalled();expect(container.querySelector('.builder-editor-actions')?.nextElementSibling?.getAttribute('aria-label')).toBe('Delete private set');await click(button('Keep set'));expect(container.querySelector('.inline-confirm')).toBeNull();
 const title=container.querySelector<HTMLInputElement>('input[maxlength="300"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(title,'Latest title');title.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>title.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
 await click(button('Delete set'));await click(button('Permanently delete set'));expect(api.deleteBuilder).toHaveBeenCalledWith('set',8);expect(api.saveBuilder).toHaveBeenCalledWith(expect.objectContaining({title:'Latest title',notes:'Preserved',revision:7}),'set');
});
it('does not offer deletion before a new set has been persisted',async()=>{
 await render(h(BuilderScreen,{catalog,viewer:{...members[0],role:'member'},rotation:null,onMovie:vi.fn(),onPublished:vi.fn(),newSetRequest:0}));
 await render(h(BuilderScreen,{catalog,viewer:{...members[0],role:'member'},rotation:null,onMovie:vi.fn(),onPublished:vi.fn(),newSetRequest:1}));
 expect([...container.querySelectorAll('.builder-editor-actions button')].map(b=>b.textContent)).toEqual(['All sets','Use set','Save set']);expect(button('Use set').disabled).toBe(true);
});
it('keeps Seen completion and recent empty text without redundant navigation or instructions',async()=>{
 await render(h(SeenScreen,{catalog:{...catalog,movies:[]},viewerId:'m1',writesEnabled:true,answer:vi.fn()}));
 expect(container.textContent).toContain('All caught up');expect(container.textContent).toContain('You have answered every current Classics candidate.');expect(container.textContent).toContain('THIS VISIT');expect(container.textContent).toContain('Your answers will appear here.');
 expect(container.textContent).not.toMatch(/Explore Classics|You can correct your recent answers below/);expect(container.querySelector('a[href="#/classics"]')).toBeNull();
});
