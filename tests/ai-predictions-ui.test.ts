// @vitest-environment jsdom
import { act,createElement as h } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PredictionPresentation,shufflePredictions } from '../frontend/PredictionPresentation';
import { RotationCard } from '../frontend/RotationCard';
import { useAiPredictions } from '../frontend/useAiPredictions';
import { AiPredictionsCard } from '../frontend/AiPredictionsCard';
import { api } from '../frontend/api';
import type { Catalog,Movie,Viewer } from '../shared/types';
vi.mock('../frontend/api',()=>({api:{preferences:vi.fn(),setShowAi:vi.fn(),predictions:vi.fn(),addPrediction:vi.fn(),removePrediction:vi.fn(),search:vi.fn(),detail:vi.fn(),importMovie:vi.fn(),historyExport:vi.fn()}}));
const movies:Movie[]=['a','b','c'].map(id=>({id,title:`Film ${id}`,year:2000,original_title:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],scores:[],external_ids:[],seen:[],classic:false,ranking:null}));
const members=[1,2,3,4].map(n=>({id:`m${n}`,display_name:`Member ${n}`,sort_order:n,active:1,avatar:n}));
const catalog:Catalog={movies,members,sessions:[],cycles:[]};
const viewer:Viewer={...members[0],avatar:1,role:'admin'};
let root:Root,container:HTMLDivElement,reduced=false;
beforeEach(()=>{vi.resetAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);reduced=false;vi.stubGlobal('matchMedia',()=>({matches:reduced,addEventListener:vi.fn(),removeEventListener:vi.fn()}));vi.mocked(api.preferences).mockResolvedValue({show_ai:false});vi.mocked(api.predictions).mockResolvedValue(movies.map(m=>({member_id:'m1',movie_id:m.id})));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
const render=async(component:Parameters<typeof root.render>[0])=>act(async()=>root.render(component));
const current=()=>container.querySelector('.prediction-poster')?.getAttribute('aria-label');
it('shuffles once, loops the same sequence every 6.1 seconds and cleans up; unrelated rerenders retain the sequence',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);await render(h(PredictionPresentation,{movies}));
  const initialCalls=vi.mocked(Math.random).mock.calls.length;expect(shufflePredictions(['a','b','c'],()=>0)).toEqual(['b','c','a']);expect(current()).toBe('Film b');
  for(const film of ['Film c','Film a','Film b','Film c','Film a','Film b']) {await act(async()=>vi.advanceTimersByTime(6099));expect(current()).not.toBe(film);await act(async()=>vi.advanceTimersByTime(1));expect(current()).toBe(film);}
  expect(Math.random).toHaveBeenCalledTimes(initialCalls);await render(h(PredictionPresentation,{movies:[...movies]}));expect(Math.random).toHaveBeenCalledTimes(initialCalls);
  expect(container.querySelector('[aria-live]')).toBeNull();await act(async()=>root.unmount());expect(vi.getTimerCount()).toBe(0);root=createRoot(container);
  const css=readFileSync('frontend/styles/home-history.css','utf8');expect(css).toContain('6.1s linear both');expect(css).toContain('98.360656%,100%');
});
it('holds the focused poster and restarts the cycle on blur without leaking timers',async()=>{
  vi.useFakeTimers();await render(h(PredictionPresentation,{movies}));const poster=container.querySelector<HTMLAnchorElement>('.prediction-poster')!;
  await act(async()=>poster.focus());const held=current();expect(container.querySelector('.prediction-animated')).toBeNull();await act(async()=>vi.advanceTimersByTime(20000));expect(current()).toBe(held);
  await act(async()=>poster.blur());expect(container.querySelector('.prediction-animated')).not.toBeNull();await act(async()=>vi.advanceTimersByTime(6099));expect(current()).toBe(held);await act(async()=>vi.advanceTimersByTime(1));expect(current()).not.toBe(held);
});
it('handles zero/one film and reduced motion without periodic updates, retaining Film Detail navigation',async()=>{
  vi.useFakeTimers();await render(h(PredictionPresentation,{movies:[]}));expect(current()).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
  await render(h(PredictionPresentation,{key:'one',movies:movies.slice(0,1)}));expect(current()).toBe('Film a');expect(container.querySelector('a')?.getAttribute('href')).toBe('#/movie/a');expect(vi.getTimerCount()).toBe(0);
  reduced=true;await render(h(PredictionPresentation,{key:'reduced',movies}));const initial=current();await act(async()=>vi.advanceTimersByTime(30000));expect(current()).toBe(initial);expect(container.querySelector('.prediction-animated')).toBeNull();expect(vi.getTimerCount()).toBe(0);
});
it('reestablishes presentation on membership/participant changes, hides by default and never shows Classics predictions',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);const rotation={id:1,nominal_slot:1,cycle_id:null,version:1,updated_at:''};
  const predictions=[...movies.map(m=>({member_id:'m1',movie_id:m.id})),{member_id:'m2',movie_id:'c'}];const props={catalog,rotation,viewer,onUpdated:vi.fn(),onUseBuilder:vi.fn(),predictions};
  await render(h(RotationCard,props));expect(current()).toBeUndefined();expect(container.querySelector('.turn-actions a:last-child')?.textContent).toBe('Event');
  await render(h(RotationCard,{...props,showAi:true}));expect(current()).toBe('Film b');await act(async()=>vi.advanceTimersByTime(6100));expect(current()).toBe('Film c');
  await render(h(RotationCard,{...props,showAi:true,predictions:predictions.filter(p=>p.movie_id!=='c')}));expect(current()).toBe('Film b');
  await render(h(RotationCard,{...props,showAi:true,rotation:{...rotation,human_order:{'1':'m2','2':'m1'}}}));expect(current()).toBe('Film c');
  await render(h(RotationCard,{...props,showAi:true,rotation:{...rotation,nominal_slot:5}}));expect(current()).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
});
it('never exposes a previous member preference or delayed loads/writes, toggles immediately and restores failed saves',async()=>{
  let state!:ReturnType<typeof useAiPredictions>;
  function Harness({member}:{member:Viewer|null}){state=useAiPredictions(member,catalog);return h('span',null,String(state.show));}
  await render(h(Harness,{member:viewer}));expect(state.show).toBe(false);
  vi.mocked(api.setShowAi).mockResolvedValue({show_ai:true});await act(async()=>state.toggle());expect(state.show).toBe(true);expect(api.setShowAi).toHaveBeenCalledWith(true);
  let pending!:(value:{show_ai:boolean})=>void;vi.mocked(api.preferences).mockImplementation(()=>new Promise(resolve=>pending=resolve));
  await render(h(Harness,{member:{...viewer,id:'m2'}}));expect(state.show).toBe(false);await act(async()=>pending({show_ai:false}));expect(state.show).toBe(false);
  vi.mocked(api.setShowAi).mockRejectedValue(new Error('Save failed'));await act(async()=>state.toggle());expect(state.show).toBe(false);expect(state.error).toBe('Save failed');
  await render(h(Harness,{member:null}));await render(h(Harness,{member:viewer}));expect(state.show).toBe(false);await act(async()=>pending({show_ai:true}));expect(state.show).toBe(true);
  let late!:(value:{show_ai:boolean})=>void;vi.mocked(api.preferences).mockImplementation(()=>new Promise(resolve=>late=resolve));
  await render(h(Harness,{member:{...viewer,id:'m3'}}));await render(h(Harness,{member:null}));await act(async()=>late({show_ai:true}));expect(state.show).toBe(false);
});
it('manages predictions using the common lookup, separate participant selectors and one-click removal',async()=>{
  vi.mocked(api.removePrediction).mockResolvedValue([]);await render(h(AiPredictionsCard,{catalog,writesEnabled:true,onMovie:vi.fn()}));
  expect(container.querySelector('h2')?.textContent).toBe('AI predicted');expect(container.querySelectorAll('select')).toHaveLength(2);expect([...container.querySelectorAll('select option')].map(e=>e.textContent)).not.toContain('Classics');
  const [participant,exportParticipant]=container.querySelectorAll('select');
  expect(participant.value).toBe('');expect(participant.options[0].value).toBe('');expect(exportParticipant.value).toBe('m1');
  expect(container.querySelector('.prediction-list')).toBeNull();expect(container.querySelector('.film-search-form')).toBeNull();expect(api.addPrediction).not.toHaveBeenCalled();expect(api.removePrediction).not.toHaveBeenCalled();
  await act(async()=>{participant.value='m1';participant.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelectorAll('.prediction-list li')).toHaveLength(3);
  await act(async()=>{participant.value='';participant.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelector('.prediction-list')).toBeNull();expect(container.querySelector('.film-search-form')).toBeNull();expect(exportParticipant.value).toBe('m1');expect(api.removePrediction).not.toHaveBeenCalled();
  await act(async()=>{participant.value='m1';participant.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelectorAll('.prediction-list li')).toHaveLength(3);
  const remove=container.querySelector<HTMLButtonElement>('button[aria-label="Remove Film a prediction"]')!;await act(async()=>remove.click());expect(api.removePrediction).toHaveBeenCalledWith('m1','a');expect(container.querySelector('dialog')).toBeNull();expect(container.querySelectorAll('.prediction-list li')).toHaveLength(0);
});
