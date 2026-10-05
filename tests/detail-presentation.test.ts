// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DetailScreen } from '../frontend/DetailScreen';
import { FilmIdentity } from '../frontend/FilmIdentity';
import { api } from '../frontend/api';
import { rankMovie } from '../shared/ranking';
import type { MovieDetail } from '../shared/types';

vi.mock('../frontend/api',()=>({api:{detail:vi.fn()}}));
const members=['Sean','Troy','Matt','Jess'].map((display_name,i)=>({id:`m${i}`,display_name,sort_order:i,active:1}));
const scores=[['imdb','rating',81.4],['letterboxd','rating',98.7],['metacritic','critic',93],['rottentomatoes','audience',92],['rottentomatoes','critic',99]].map(([provider,metric,value])=>({provider:String(provider),metric:String(metric),raw_value:Number(value),raw_scale:100,normalized_value:Number(value),vote_count:null,fetched_at:'2026-01-01'}));
const seen=[{member_id:'m0',seen:1,updated_at:''},{member_id:'m1',seen:0,updated_at:''}];
const movie:MovieDetail={id:'film',title:'A Film',original_title:'Original Film',year:1982,runtime:188,release_date:'1982-01-01',director:'A Director',genres:['Drama','Mystery'],overview:'A full-width description.',assets:[],external_ids:[],classic:true,seen,scores,ranking:rankMovie(scores,seen,members),appearances:[]};
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.clearAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=async(film=movie)=>{vi.mocked(api.detail).mockResolvedValue(film);await act(async()=>root.render(createElement(DetailScreen,{key:film.id,id:film.id,members})));};

it('places Detail overview and informational status below poster and metadata, preserving identity and Preview',async()=>{
  await render();
  const identity=container.querySelector('.detail-identity')!;
  expect(identity.children[0].classList.contains('poster-large')).toBe(true);
  expect([...identity.children].slice(1).map(node=>node.className)).toEqual(['film-identity-metadata','detail-overview','badge detail-classics-status']);
  const metadata=identity.querySelector('.film-identity-metadata')!;
  for(const copy of ['A Film','Original title: Original Film','Runtime: 3 hrs, 8 mins','Release: 1982-01-01','Director: A Director','Drama · Mystery'])expect(metadata.textContent).toContain(copy);
  expect(metadata.textContent).not.toContain('1982 ·');expect(metadata.textContent).not.toContain('188 min');
  expect(identity.querySelector('.detail-overview')?.textContent).toBe(movie.overview);
  expect(identity.querySelector('.detail-classics-status')?.textContent).toBe('Classics candidate');
  expect(identity.querySelector('.detail-classics-status button')).toBeNull();
  const preview=document.createElement('div');preview.innerHTML=renderToStaticMarkup(createElement(FilmIdentity,{movie}));
  expect(preview.textContent).toContain('1982 · 188 min');expect(preview.querySelector('.detail-identity,.detail-overview')).toBeNull();
  expect(preview.querySelector('.film-identity-metadata')?.textContent).toContain(movie.overview);
});

it.each([[188,'3 hrs, 8 mins'],[93,'1 hr, 33 mins'],[47,'47 mins'],[60,'1 hr'],[61,'1 hr, 1 min'],[120,'2 hrs'],[1,'1 min']])('formats runtime %s without a standalone year', (runtime,label)=>{
  const html=renderToStaticMarkup(createElement(FilmIdentity,{movie:{...movie,runtime},variant:'detail'}));
  const element=document.createElement('div');element.innerHTML=html;
  expect(element.querySelector('p.meta')?.textContent).toBe(`Runtime: ${label}`);
  expect(element.textContent).not.toContain('1982 ·');
});

it('preserves missing overview fallback',()=>{
  expect(renderToStaticMarkup(createElement(FilmIdentity,{movie:{...movie,overview:null},variant:'detail'}))).toContain('No overview available yet.');
});

it('uses two affirmed Seen columns with no parent heading or unanswered identities',async()=>{
  await render();
  expect([...container.querySelectorAll('.detail-seen-column h3')].map(node=>node.textContent)).toEqual(["Haven't Seen It",'Seen It']);
  expect([...container.querySelectorAll('.detail-seen-column')].map(column=>[...column.querySelectorAll('.club-identity')].map(node=>node.textContent))).toEqual([['TROY'],['SEAN']]);
  expect(container.querySelector('.detail-seen-column-yes')).toBeTruthy();
  expect([...container.querySelectorAll('h2')].map(node=>node.textContent)).not.toContain('Seen It?');
});

it.each([false,true])('shows score only for a Classics candidate with ranking data (%s)',async(classic)=>{
  await render({...movie,classic});expect(Boolean(container.querySelector('.detail-classics-score'))).toBe(classic);
  await render({...movie,id:'no-ranking',classic,ranking:null});expect(container.querySelector('.detail-classics-score')).toBeNull();
});

it('shows all six effective ratings in order with integer presentation, without summary clutter or stored snapshots',async()=>{
  await render({...movie,scores:[{...scores[0],raw_value:1,normalized_value:1}]});
  expect([...container.querySelectorAll('.detail-rating-summary li')].map(node=>node.textContent)).toEqual(['IMDb Rating: 81/100','Letterboxd Rating: 99/100','Metacritic Critic Score: 93/100','Rotten Tomatoes Audience Score: 92/100','Rotten Tomatoes Critic Score: 99/100','TMDB Rating: - (average used)']);
  expect(container.querySelector('.score,.rank-top,.source-record')).toBeNull();
  expect(container.querySelector('.detail-rating-summary')?.textContent).not.toContain('residual score');
  expect(container.textContent).not.toMatch(/\d+ Seen|\d+ No|\d+ Unknown|Missing:|Source & capture details/);
  expect([...container.querySelectorAll('h2')].map(node=>node.textContent)).not.toContain('Ratings');
  expect(movie.ranking!.sources[0].value).toBe(81.4);
});

it('keeps collapsed breakdown, imputed average and actual ranking results under the requested headings',async()=>{
  // Deliberately distinct residual and final results prevent using the wrong field or recomputing.
  const ranking={...movie.ranking!,rawScore:52438.4,residualScore:-55222.8,finalScore:55222.8,unseenMultiplier:1.051};
  await render({...movie,ranking});
  const disclosure=container.querySelector<HTMLDetailsElement>('.detail-score-breakdown')!;
  expect(disclosure.open).toBe(false);expect(disclosure.querySelector('summary')?.textContent).toBe('Score breakdown');
  expect([...disclosure.querySelectorAll('h3')].map(node=>node.textContent)).toEqual(['Scores','Modifiers','Crunchy math']);
  const groups=disclosure.querySelectorAll('section');
  expect([...groups[0].querySelectorAll('p')].map(node=>node.textContent)).toEqual(['IMDb (rating)81/100','Letterboxd (rating)99/100','Metacritic (critic)93/100','Rotten Tomatoes (audience)92/100','Rotten Tomatoes (critic)99/100','TMDB (missing)93/100']);
  expect([...groups[1].querySelectorAll('p')].map(node=>node.textContent)).toEqual(['Unseen multiplier1.05x']);
  expect([...groups[2].querySelectorAll('p')].map(node=>node.textContent)).toEqual(['Sum of Squares of Scores (SoSoS)52,438','SoSoS × Modifiers (residual score)-55,223']);
  expect(disclosure.textContent).not.toMatch(/Unknown|tie.break|average used/);
});

it('does not claim an average or fabricate numeric values when no rating is usable',async()=>{
  await render({...movie,scores:[],ranking:rankMovie([],[],members)});
  expect([...container.querySelectorAll('.detail-rating-summary strong')].map(node=>node.textContent)).toEqual(Array(6).fill('-'));
  const groups=container.querySelectorAll('.detail-score-breakdown section');
  expect([...groups[0].querySelectorAll('p span')].every(node=>node.textContent?.endsWith('(missing)'))).toBe(true);
  expect([...groups[0].querySelectorAll('strong')].map(node=>node.textContent)).toEqual(Array(6).fill('-'));
  expect(groups[1].textContent).toContain('1.00x');
  expect([...groups[2].querySelectorAll('strong')].map(node=>node.textContent)).toEqual(['—','—']);
});

it('removes Detail utility sections while retaining appearances, History and possessive names',async()=>{
  await render({...movie,appearances:[{id:'event',event_date:'2026-01-01',date_precision:'exact',kind:'hosted',host_member_id:'m3',position:1}]});
  expect(container.textContent).not.toMatch(/Classics membership|Admin · score maintenance|Technical identifiers & artwork/);
  expect(container.textContent).toContain('Book Club appearances');expect(container.textContent).toContain("Jess' week");
  expect(container.querySelector('a[href="#/history"]')?.textContent).toBe('History');
});

it('scopes responsive full-width overview and fit-content status to Detail and right-aligns Seen',()=>{
  const css=readFileSync('frontend/app.css','utf8');
  expect(css).toContain('.detail-identity { display: grid; grid-template-columns: auto minmax(0,1fr); }');
  expect(css).toMatch(/\.detail-identity \.detail-overview \{ grid-column: 1 \/ -1;.*font-weight: 300;.*line-height: 1.6;/);
  expect(css).toMatch(/\.detail-classics-status \{ grid-column: 1 \/ -1; width: fit-content;/);
  expect(css).toContain('.detail-seen-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); }');
  expect(css).toContain('.detail-seen-column-yes { text-align: right; padding-right: 0; }');
  expect(css).toContain('.detail-seen-column-yes .detail-seen-members { justify-content: flex-end; }');
});
