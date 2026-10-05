// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { Catalog, Movie, Rotation, Session } from '../shared/types';
import { rankMovie } from '../shared/ranking';
import { formatScore100, currentTurnLabel, historicalTurnLabel } from '../frontend/presentation';
import { SessionCard, RankingScore } from '../frontend/components';
import { TurnFields } from '../frontend/TurnFields';
import { HistoryEvidence } from '../frontend/HistoryEvidence';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { DetailScreen } from '../frontend/DetailScreen';
import { api } from '../frontend/api';
vi.mock('../frontend/api',() => ({api:{detail:vi.fn()}}));
const members = ['Sean','Troy','Matt','Jess'].map((display_name,i) => ({id:`m${i+1}`,display_name,sort_order:i+1,active:1}));
const movie: Movie = {id:'film',title:'A Film',original_title:null,year:2001,release_date:null,runtime:100,overview:null,genres:['Drama'],assets:[],external_ids:[],seen:[],classic:true,ranking:null,scores:[
  {provider:'imdb',metric:'rating',raw_value:8.7,raw_scale:10,normalized_value:87,vote_count:null,fetched_at:'2026-01-01'},
  {provider:'rottentomatoes',metric:'audience',raw_value:87.5,raw_scale:100,normalized_value:87.5,vote_count:null,fetched_at:'2026-01-01'},
  {provider:'rottentomatoes',metric:'critic',raw_value:87.26,raw_scale:100,normalized_value:87.26,vote_count:null,fetched_at:'2026-01-01'},
]};
movie.ranking = rankMovie(movie.scores,[],members);
const session: Session = {id:'event',movies:[movie],event_date:'2026-01-01',host_member_id:'m3',cycle_slot:1,cycle_id:'cycle',kind:'hosted',date_precision:'exact',legacy_cycle_label:null};
const catalog: Catalog = {members,movies:[movie],sessions:[session],cycles:[{id:'cycle',ordinal:1,title:null,rough_date:'2026-01-01',import_source:null,import_key:null,created_at:'',updated_at:''}]};
const rotation: Rotation = {id:1,nominal_slot:1,cycle_id:'cycle',version:2,updated_at:'',human_order:{'1':'m3','3':'m1'}};
const text = (markup: string) => {const element=document.createElement('div');element.innerHTML=markup;return element.textContent!;};

it.each([[87,'87'],[87.5,'87.5'],[87.26,'87.3']])('formats /100 %s as %s', (value,expected) => expect(formatScore100(value as number)).toBe(expected));

it('presents named historical controls without raw turn numbers or nominal terminology',() => {
  expect([1,2,3,4,5].map(historicalTurnLabel)).toEqual(["Sean's turn","Troy's turn","Matt's turn","Jess's turn",'Classics week']);
  const html=renderToStaticMarkup(createElement(TurnFields,{catalog,rotation,complete:false,onComplete:vi.fn(),cycle:'cycle',onCycle:vi.fn(),slot:1,onSlot:vi.fn()}));
  const element=document.createElement('div');element.innerHTML=html;
  expect([...element.querySelectorAll('[name=cycle_slot] option')].map(e=>e.textContent)).toEqual(['Turn not recorded',"Sean's turn","Troy's turn","Matt's turn","Jess's turn",'Classics week']);
  expect(element.textContent).toContain('Historical backfill · cycle & turn');
  expect(element.textContent).toContain("New cycle (Sean's turn only)");
  expect(element.textContent).not.toMatch(/nominal|slot/i);
  const card=text(renderToStaticMarkup(createElement(SessionCard,{session,members})));
  expect(card).not.toMatch(/nominal|slot|Sean's turn/i);expect(card).toContain('MATT');
});

it('uses effective current members after swaps while historical turns retain their names',() => {
  expect(currentTurnLabel(members,rotation)).toBe("Matt's turn");
  expect(historicalTurnLabel(rotation.nominal_slot)).toBe("Sean's turn");
  expect(currentTurnLabel(members,{...rotation,nominal_slot:5})).toBe('Classics week');
});

it('humanises known audit evidence and omits internal fields and JSON',() => {
  const json=JSON.stringify({before:{...session,movies:undefined,films:[{movie_id:'film',position:1}],builder_id:'private-internal'},after:{event_date:'2026-01-02',cycle_slot:5,kind:'classics',host_member_id:null,movie_ids:['film'],complete_turn:true},turn_before:rotation,planned_at:'2025-12-31T12:00:00Z',rotation_unchanged:true,requires_rotation_review:true,cycle_anchor_correction:true});
  const result=text(renderToStaticMarkup(createElement(HistoryEvidence,{json,catalog})));
  for (const label of ['Before','After','1 January 2026','2 January 2026','Matt',"Sean's turn",'Classics week',"Matt's turn",'A Film','Cycle 1','Planned:','Rotation unchanged.','Cycle anchor corrected']) expect(result).toContain(label);
  expect(result).not.toMatch(/cycle_slot|nominal|human_order|builder_id|private-internal|"m3"|Full change evidence|slot/i);
});

it('supports partial anchor, delete and restore evidence and malformed evidence safely',() => {
  for (const changes of [{before:{event_date:'2026-01-01'},rotation_unchanged:true},{before:{event_date:'2026-01-01'},after:{event_date:'2026-01-02'},cycle_anchor_correction:true},{before:null,after:{movie_ids:[],cycle_slot:null}}]) {
    const result=text(renderToStaticMarkup(createElement(HistoryEvidence,{json:JSON.stringify(changes),catalog})));
    expect(result).not.toMatch(/cycle_slot|nominal|human_order|slot/i);
  }
  expect(text(renderToStaticMarkup(createElement(HistoryEvidence,{json:'invalid',catalog})))).toBe('Change details unavailable.');
});

it('uses /100 formatting in ranking without changing derived precision or native Metrics IMDb',() => {
  const ranking=text(renderToStaticMarkup(createElement(RankingScore,{movie})));
  expect(ranking).toContain('IMDb 87 · RT audience 87.5 · RT critic 87.3');
  expect(ranking).toContain('87 / 100');expect(ranking).toContain('87.5 / 100');
  expect(ranking).toContain(movie.ranking!.finalScore!.toFixed(2));expect(ranking).toContain(movie.ranking!.rawScore!.toFixed(2));expect(ranking).toContain('1.000000');
  const metrics=text(renderToStaticMarkup(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
  expect(metrics).toContain('8.7');expect(metrics).toContain('8.70 / 10');expect(metrics).not.toMatch(/nominal|slot/i);
});

it('keeps raw Detail observations and explicit scales while formatting normalised /100 values',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.mocked(api.detail).mockResolvedValue({...movie,appearances:[]});
  const container=document.createElement('div');const root=createRoot(container);
  try {
    await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members,writesEnabled:false,isAdmin:false,onMovie:vi.fn()})));
    const result=container.textContent!;
    expect(result).toContain('8.7 / 10 · normalised 87');
    expect(result).toContain('87.5 / 100 · normalised 87.5');
    expect(result).toContain('87.26 / 100 · normalised 87.3');
    expect(result).not.toContain('normalised 87.0');
  } finally {await act(async()=>root.unmount());}
});

it.each([
  [{...session,date_precision:'cycle_rough' as const},"Matt's turn",'Cycle beginning 1 January 2026'],
  [{...session,kind:'classics' as const,host_member_id:null},'Classics week','1 January 2026'],
  [{...session,host_member_id:'former'},'Former member’s turn','1 January 2026'],
  [{...session,date_precision:'unknown' as const},"Matt's turn",'Date unknown'],
])('Home last turn preserves date precision and historical identity', (event,heading,date)=>{
  const element=document.createElement('div');element.innerHTML=renderToStaticMarkup(createElement(SessionCard,{variant:'home',session:event,members}));
  expect(element.querySelector('h3')?.textContent).toBe(heading);expect(element.querySelector('.eyebrow')?.textContent).toBe(date);
  expect(element.querySelector('.home-session-identity')).toBeTruthy();expect(element.querySelector('.session-meta')).toBeNull();
  expect(element.querySelector('.position')?.textContent).toBe('#1');expect(element.querySelector('.movie-row')?.getAttribute('href')).toBe('#/movie/film');expect(element.textContent).toContain('2001 · 100 min');
  if(event.host_member_id==='former')expect(element.textContent).toContain('Hosted by a former member');
});
