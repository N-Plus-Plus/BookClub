// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applicationCss } from './helpers/application-css';
import { RelocatedReports } from './helpers/metrics-relocated-reports';
import { DiscoveryRankings } from '../frontend/metrics/Discoveries';
import { selectedAppearances } from '../shared/metrics';
import { discoveries } from '../shared/metrics-staging/films';
import { metricsFixture,metricsFilm,metricsEvent,observation } from './metrics-fixture';
import { emptyEnrichmentMovie,type MetricsEnrichment } from '../shared/metrics-enrichment';
import { parseCollectionRoster } from '../shared/collection-roster';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const css=applicationCss();
it('renders exact subtitles, only spread axes, six right-aligned star columns/Total and six-column pagination',async()=>{
  const catalog=metricsFixture(),film=metricsFilm('shared');catalog.movies=[film];catalog.sessions=catalog.members.map(m=>metricsEvent(m.id,[film,film],m.id));catalog.sessions.push(metricsEvent('classic',[film,film],null));
  const data={movies:{shared:{...emptyEnrichmentMovie(),credits:Array.from({length:21},(_,i)=>({kind:'cast',role:'cast',person_id:String(i),name:`Actor ${i}`}))}}};
  const node=document.createElement('div'),root=createRoot(node),all=selectedAppearances(catalog);
  try{await act(async()=>root.render(createElement(RelocatedReports,{catalog,all,rows:all,filter:{kind:'all'},data})));
    expect(node.querySelector('[aria-label="Release-year spread"] > p')?.textContent).toBe('Mean release year and standard deviation spread, on a shared timeline.');
    expect(node.querySelector('[aria-label="Shared stars"] > p')?.textContent).toBe('Actors shared across the boobs.');
    expect(node.querySelector('[aria-label="Critics or audiences?"] .staging-axis')).toBeNull();expect(node.querySelectorAll('.staging-axis')).toHaveLength(2);
    const table=node.querySelector('.staging-stars-table')!;expect([...table.querySelectorAll('thead th')].map(e=>e.textContent)).toEqual(['Actor','Sean','Troy','Matt','Jess','Total']);expect([...table.querySelectorAll('tbody tr:first-child td')].map(e=>e.textContent)).toEqual(['2','2','2','2','8']);expect(table.querySelector('.metrics-table-pages td')?.getAttribute('colspan')).toBe('6');
    expect(css).toMatch(/\.staging-stars-table th:not\(:first-child\),\.staging-stars-table td \{ text-align: right; font-variant-numeric: tabular-nums;/);expect(css).toContain('.staging-table-scroll { max-width: 100%; overflow-x: auto; }');
  }finally{await act(async()=>root.unmount());}
});
it('preserves streamable unions and renders only deduplicated Rent and Buy counts including zero',async()=>{
  const catalog=metricsFixture(),film=metricsFilm('stream',{au_watch_offers:['subscription','free','ads','rent','rent'].map(access_type=>({service_id:'1',name:'Service',access_type:access_type as 'subscription'|'free'|'ads'|'rent',link:null}))});catalog.movies=[film];catalog.sessions=[metricsEvent('s',[film,film])];
  const node=document.createElement('div'),root=createRoot(node),all=selectedAppearances(catalog);
  try{await act(async()=>root.render(createElement(RelocatedReports,{catalog,all,rows:all,filter:{kind:'all'},data:{movies:{}}})));const row=node.querySelector('[aria-label="Streaming platform representation"] .staging-data-row')!;expect(row.children[1].textContent).toBe('Stream 1 distinct films · 100.0%');expect(row.children[2].textContent).toBe('Rent 1 · Buy 0');}finally{await act(async()=>root.unmount());}
});
it('uses compact metadata lists, equal gross labels and responsive nonwrapping classifications at the owning style level',()=>{
  expect(css).toContain('.metrics-metadata-films > li { margin: 0; padding: 0; }');expect(css).toMatch(/\.metrics-metadata-films \{[^}]*margin: 0;[^}]*gap: 0;[^}]*font-size: var\(--text-metadata\)/);expect(css).toContain('.metrics-metadata-films .movie-link { min-height: 0; color: inherit; }');
  expect(css).toContain('.staging-gross-film .movie-title { font-size: var(--text-body); font-weight: 600; }');expect(css).toMatch(/\.staging-revenue-table th \{[^}]*font-size: var\(--text-body\); font-weight: 600;/);
  expect(css).toContain('grid-template-columns: 9rem minmax(0,1fr)');expect(css).toMatch(/\.staging-classification h3 \{ white-space: nowrap;/);expect(css).toContain('grid-template-columns: 7rem minmax(0,1fr)');expect(readFileSync('style.css','utf8')).not.toContain('metrics-metadata-films');
});
it('moved rankings retain every fifth-place tie and scoring with reception before canonical metadata and an independent index',async()=>{
  const films=Array.from({length:8},(_,i)=>metricsFilm(String(i),{title:`Film ${i}`,year:2001,runtime:125,au_classification:'M',director:'Known director',scores:[observation('imdb','rating',8,10,250),observation('metacritic','critic',60,100)]}));
  const catalog={...metricsFixture(),movies:films,sessions:[metricsEvent('a',films),metricsEvent('b',[films[0]],'m2')]},all=selectedAppearances(catalog);
  expect(discoveries(all).hidden).toHaveLength(8);expect(discoveries(all).cult).toHaveLength(8);
  const node=document.createElement('div'),root=createRoot(node);
  try{await act(async()=>root.render(createElement(DiscoveryRankings,{rows:all})));expect(node.querySelectorAll('.staging-discoveries > li')).toHaveLength(16);
    for(const row of node.querySelectorAll('.staging-discoveries > li')){const text=row.querySelector('.movie-copy')!;expect(text.children[0].textContent).toMatch(/^Film/);expect(text.children[1].textContent).toMatch(/^Audience 80.0/);expect(text.children[2].textContent).toBe('2001 · 125 min · M');expect(text.children[3].textContent).toBe('Known director');expect(row.querySelector('.staging-discovery-index')?.parentElement).toBe(row);expect(row.querySelector('a')?.getAttribute('href')).toMatch(/#\/movie\/\d/);}
    expect(node.querySelector('[aria-label="Top 5 hidden gems"] .staging-discovery-index')?.textContent).toBe('25.0 index');expect(node.querySelector('[aria-label="Top 5 most cult"] .staging-discovery-index')?.textContent).toBe('+20.0 points');
    await act(async()=>root.render(createElement(DiscoveryRankings,{rows:selectedAppearances(catalog,{kind:'member',memberId:'m2'})})));expect(node.querySelectorAll('.staging-discoveries > li')).toHaveLength(2);
  }finally{await act(async()=>root.unmount());}
});
it('keeps collection reports club-wide under filtering and links only historical films',async()=>{
  const a=metricsFilm('a',{external_ids:[{provider:'tmdb',external_id:'42'}]}),b=metricsFilm('b',{external_ids:[{provider:'tmdb',external_id:'43'}]});
  const catalog={...metricsFixture(),movies:[a,b],sessions:[metricsEvent('a',[a,a]),metricsEvent('b',[b],'m2')]},all=selectedAppearances(catalog);
  const data:MetricsEnrichment={movies:Object.fromEntries([a,b].map((m,i)=>[m.id,{...emptyEnrichmentMovie(),collection:{status:'checked_present' as const,external_id:String(42+i),checked_at:'2026',collection_id:7,collection_name:'Series'}}])),collections:{7:{status:'checked',attempted_at:'2026',roster:parseCollectionRoster({id:7,name:'Series',parts:[{id:42,title:'A',release_date:'2000-01-01'},{id:43,title:'B',release_date:'2001-01-01'},{id:44,title:'Released missing film',release_date:'2000-01-01'}]},7,'2026-01-01T00:00:00.000Z')}}};
  const node=document.createElement('div'),root=createRoot(node);
  try{for(const filter of [{kind:'all' as const},{kind:'member' as const,memberId:'m1'},{kind:'classics' as const}]){await act(async()=>root.render(createElement(RelocatedReports,{catalog,all,rows:selectedAppearances(catalog,filter),filter,data})));const report=node.querySelector('[aria-label="Incomplete collections"]')!;expect(report.textContent).toContain('2 of 3 films');expect(report.querySelectorAll('.metrics-metadata-films a')).toHaveLength(2);expect(report.querySelector('.staging-missing-films')?.textContent).toBe('Not brought:Released missing film');expect(report.querySelector('.staging-missing-films a')).toBeNull();expect(report.querySelector('.club-identity')).toBeNull();expect(node.querySelector('[aria-label="Top 5 hidden gems"]')).toBeNull();}}
  finally{await act(async()=>root.unmount());}
});
