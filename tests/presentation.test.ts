// @vitest-environment jsdom
import { applicationCss } from './helpers/application-css';

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { Catalog, Movie, Rotation, Session } from '../shared/types';
import { rankMovie } from '../shared/ranking';
import { formatScore100, currentTurnLabel, historicalTurnLabel, possessiveName } from '../frontend/presentation';
import { SessionCard, RankingScore, eventDateLabel } from '../frontend/components';
import { TurnFields } from '../frontend/TurnFields';
import { HistoryEvidence } from '../frontend/HistoryEvidence';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { DetailScreen } from '../frontend/DetailScreen';
import { api } from '../frontend/api';
vi.mock('../frontend/api',() => ({api:{detail:vi.fn(),metricsEnrichment:vi.fn().mockResolvedValue({movies:{}})}}));
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

it.each([
  ['exact',null,'1 January 2026 · Cycle 1 Film 1'],
  ['cycle_rough',null,'Cycle 1 Film 1'],
  ['unknown',null,'Cycle 1 Film 1'],
  ['exact','legacy-spreadsheet','Cycle 1 Film 1'],
])('Metrics ranking metadata respects %s precision and %s provenance', async(precision,source,expected)=>{
  const data={...catalog,sessions:[{...session,date_precision:precision as Session['date_precision']}],cycles:[{...catalog.cycles[0],title:'Custom cycle title',import_source:source}]};
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const element=document.createElement('div'),root=createRoot(element);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog:data,viewer:null,onUpdated:async()=>{}})));
    await act(async()=>[...element.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b=>b.textContent==='Top / Bottom')!.click());
    expect([...element.querySelectorAll('.metrics-film-item p.meta')].map(e=>e.textContent)).toEqual([expected,expected]);
  } finally {await act(async()=>root.unmount());}
});

it('presents named historical controls without raw turn numbers or nominal terminology',() => {
  expect([1,2,3,4,5].map(historicalTurnLabel)).toEqual(["Sean's turn","Troy's turn","Matt's turn","Jess' turn",'Classics week']);
  const html=renderToStaticMarkup(createElement(TurnFields,{catalog,rotation,complete:false,onComplete:vi.fn(),cycle:'cycle',onCycle:vi.fn(),slot:1,onSlot:vi.fn()}));
  const element=document.createElement('div');element.innerHTML=html;
  expect([...element.querySelectorAll('[name=cycle_slot] option')].map(e=>e.textContent)).toEqual(['Turn not recorded',"Sean's turn","Troy's turn","Matt's turn","Jess' turn",'Classics week']);
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
  expect(ranking).toContain('IMDb 87');expect(ranking).toContain('RT-A 87.5');expect(ranking).toContain('RT-C 87.3');
  expect(ranking).toContain('87 / 100');expect(ranking).toContain('87.5 / 100');
  expect(ranking).toContain(movie.ranking!.finalScore!.toFixed(2));expect(ranking).toContain(movie.ranking!.rawScore!.toFixed(2));expect(ranking).toContain('1.000000');
  const metrics=text(renderToStaticMarkup(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
  expect(metrics).toContain('8.7');expect(metrics).toContain('8.7 / 10');expect(metrics).not.toMatch(/nominal|slot/i);
});


it.each([
  [{...session,date_precision:'cycle_rough' as const},"Matt's turn",'Cycle started 1 January 2026'],
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

it('uses cycle started and stored host identity in Film Detail appearances',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.mocked(api.detail).mockResolvedValue({...movie,appearances:[
  {id:'hosted',event_date:'2026-01-01',date_precision:'cycle_rough',kind:'hosted',host_member_id:'m3',position:1},
  {id:'jess',event_date:'2026-11-28',date_precision:'cycle_rough',kind:'hosted',host_member_id:'m4',position:1},
  {id:'classics',event_date:'2026-01-02',date_precision:'exact',kind:'classics',host_member_id:null,position:2},
  {id:'former',event_date:'2026-01-03',date_precision:'unknown',kind:'hosted',host_member_id:'former',position:1},
 ]});
 const container=document.createElement('div');const root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(DetailScreen,{id:movie.id,members})));
  expect(container.textContent).toContain("Cycle started 1 January 2026 · Matt's week · film 1");
  expect(container.textContent).toContain("Cycle started 28 November 2026 · Jess' week · film 1");
  expect(container.textContent).toContain('2 January 2026 · Classics week · film 2');
  expect(container.textContent).toContain('Date unknown · Former member’s week');
  expect(container.textContent).not.toMatch(/Cycle reference|actual date unknown|Book Club night|Classics Collection/);
 } finally {await act(async()=>root.unmount());}
 const card=text(renderToStaticMarkup(createElement(SessionCard,{session:{...session,date_precision:'cycle_rough'},members})));
 expect(card).toContain('Cycle started 1 January 2026');expect(card).toContain("Matt's week");
 const evidence=text(renderToStaticMarkup(createElement(HistoryEvidence,{json:JSON.stringify({before:{...session,date_precision:'cycle_rough'}}),catalog})));
 expect(evidence).toContain('Cycle started 1 January 2026');expect(evidence).toContain("Matt's week");
});

it('compact ranking shows all six genuine labels and never presents imputation as a provider rating',()=>{
 const extra=[['letterboxd','rating',4,5],['metacritic','critic',80,100],['tmdb','rating',8,10]].map(([provider,metric,value,scale])=>({provider:String(provider),metric:String(metric),raw_value:Number(value),raw_scale:Number(scale),normalized_value:null,vote_count:null,fetched_at:'2026-01-01'}));
 const film={...movie,scores:[...movie.scores,...extra]};film.ranking=rankMovie(film.scores,[],members);
 const result=text(renderToStaticMarkup(createElement(RankingScore,{movie:film,variant:'classics',compact:true})));
 for(const label of ['IMDb 87','RT-A 87.5','RT-C 87.3','LB 80','MC 80','TMDB 80'])expect(result).toContain(label);
 expect(result).not.toMatch(/residual score|Score breakdown/);
 const partial={...movie,scores:movie.scores.slice(0,1),ranking:rankMovie(movie.scores.slice(0,1),[],members)};
 const element=document.createElement('div');element.innerHTML=renderToStaticMarkup(createElement(RankingScore,{movie:partial,variant:'classics',compact:true}));
 expect(element.querySelectorAll('p.meta')[1].textContent).toBe('IMDb 87');
 expect(element.textContent).not.toContain('using available-score average');
});


it.each([['Sean',"Sean's"],['Troy',"Troy's"],['Matt',"Matt's"],['Jess',"Jess'"],['JESS',"JESS'"],['James',"James'"],['Alex',"Alex's"]])('formats possessive display name %s', (name,expected) => {
  expect(possessiveName(name)).toBe(expected);
});

it.each([['m1',"Sean's week"],['m4',"Jess' week"],[null,'Classics week']])('groups History date and %s heading opposite actions and identity', (host,expected) => {
  const event = {...session,event_date:'2026-11-28',date_precision:'cycle_rough' as const,host_member_id:host,kind:host ? 'hosted' as const : 'classics' as const};
  const actions = createElement('button',{'aria-label':'Edit event',className:'button button--icon'},'Edit');
  const element = document.createElement('div');
  element.innerHTML = renderToStaticMarkup(createElement(SessionCard,{variant:'history',session:event,members,actions}));
  const header = element.querySelector('.history-event-header')!;
  expect([...header.children].map(child=>child.className)).toEqual(['history-event-heading','history-event-actions']);
  const heading = header.firstElementChild!;
  expect(heading.querySelector('.eyebrow')?.textContent).toBe('Cycle started 28 November 2026');
  expect(heading.querySelector('h3')?.textContent).toBe(expected);
  expect(header.lastElementChild?.querySelector('[aria-label="Edit event"]')).toBeTruthy();
  expect(header.lastElementChild?.querySelector('.history-event-identity .club-identity')).toBeTruthy();
  expect(header.querySelector('.film-list')).toBeNull();
  expect(element.querySelector('.film-list')?.parentElement).toBe(header.parentElement);
  expect(eventDateLabel(event)).toBe('Cycle started 28 November 2026');
});

it('uses Jess’ turn for Home and effective current rotation and Jess’ week in audit evidence',()=>{
  const event = {...session,host_member_id:'m4'};
  const element = document.createElement('div');
  element.innerHTML = renderToStaticMarkup(createElement(SessionCard,{variant:'home',session:event,members}));
  expect(element.querySelector('h3')?.textContent).toBe("Jess' turn");
  expect(currentTurnLabel(members,{...rotation,nominal_slot:4,human_order:{}})).toBe("Jess' turn");
  expect(historicalTurnLabel(4)).toBe("Jess' turn");
  expect(text(renderToStaticMarkup(createElement(HistoryEvidence,{json:JSON.stringify({before:event}),catalog})))).toContain("Jess' week");
});


it.each([false,true])('keeps History action order with audit=%s followed by identity', (audit) => {
  const buttons = ['Edit event',...(audit ? ['Audit event'] : []), 'Delete event'].map(label => createElement('button',{key:label,'aria-label':label,className:'button button--icon'}));
  const element = document.createElement('div');
  element.innerHTML = renderToStaticMarkup(createElement(SessionCard,{variant:'history',session,members,actions:buttons}));
  const group = element.querySelector('.history-event-actions')!;
  expect([...group.children].map(child => child.getAttribute('aria-label') ?? child.className)).toEqual(['Edit event',...(audit ? ['Audit event'] : []),'Delete event','history-event-identity']);
});


it('applies a single row of full-width controls beside a flexible History text column',()=>{
  const stylesheet=document.createElement('style');
  stylesheet.textContent=applicationCss();
  const element=document.createElement('div');
  const buttons=['Edit event','Audit event','Delete event'].map(label=>createElement('button',{key:label,'aria-label':label,className:'button button--icon'}));
  element.innerHTML=renderToStaticMarkup(createElement(SessionCard,{variant:'history',session,members,actions:buttons}));
  document.head.appendChild(stylesheet);document.body.appendChild(element);
  try {
    const header=getComputedStyle(element.querySelector('.history-event-header')!);
    const controls=getComputedStyle(element.querySelector('.history-event-actions')!);
    expect(header.gridTemplateColumns).toBe('minmax(0,1fr) max-content');
    expect(controls.display).toBe('grid');
    expect(controls.gridAutoFlow).toBe('column');
    expect(controls.gridAutoColumns).toBe('max-content');
    expect(getComputedStyle(element.querySelector('.history-event-heading')!).minWidth).toBe('0');
    expect(getComputedStyle(element.querySelector('.eyebrow')!).whiteSpace).toBe('normal');
  } finally {stylesheet.remove();element.remove();}
});

it('keeps the Google render target transparent without changing its sizing',()=>{
 const style=document.createElement('style');style.textContent=applicationCss();document.head.appendChild(style);
 const wrapper=document.createElement('div');wrapper.className='google-sign-in';
 const injected=document.createElement('iframe');injected.style.width='320px';wrapper.appendChild(injected);document.body.appendChild(wrapper);
 try {
  const css=getComputedStyle(wrapper);
  expect(css.backgroundColor).toBe('rgba(0, 0, 0, 0)');expect(css.borderTopWidth).toBe('0px');expect(css.padding).toBe('0px');
  expect(css.width).toBe('100%');expect(css.maxWidth).toBe('100%');expect(injected.style.width).toBe('320px');
 } finally {wrapper.remove();style.remove();}
});
