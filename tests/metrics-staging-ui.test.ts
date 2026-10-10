import { metricsInventory } from './helpers/metrics-inventory';
// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { it,expect,vi,afterEach } from 'vitest';
import { ReceptionRecords, ClassicsViewedRecords } from '../frontend/metrics/ReceptionRecords';
import { DiversityMetrics } from '../frontend/metrics/Diversity';
import { metricsFilm } from './metrics-fixture';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { CollectionReports, AwardsReport } from '../frontend/metrics/staging/Evidence';
import { PairedBars, grossMillions, Matrix } from '../frontend/metrics/staging/primitives';
import { oscarSummary } from '../shared/provider-evidence';
import { RelocatedReports } from './helpers/metrics-relocated-reports';
import * as overlapCalculations from '../shared/metrics-staging/overlap';
import { api } from '../frontend/api';
import { selectedAppearances } from '../shared/metrics';
import { metricsFixture,metricsEvent,observation } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
vi.mock('../frontend/api',()=>({api:{metricsEnrichment:vi.fn()}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
afterEach(()=>{vi.resetAllMocks();vi.restoreAllMocks();});
const headings=['Cycle scorecards','Release-year spread','Runtime spread','Critics or audiences?','Genre taste overlap','First shared theme','Shared stars','Creative partnerships','Highest-grossing film by genre','Most expensive flops','Classification versus acclaim','Streaming platform representation','Franchise / collection completed','Incomplete collections','Awards and nominations'];
it('renders relocated reports at their owning destinations across four tabs without additional reads',async()=>{
  const combinations=vi.spyOn(overlapCalculations,'genreCombinations');
  const catalog=metricsFixture(),data=metricsEnrichmentFixture();
  catalog.movies[0].scores=[observation('metacritic','critic',60,100),observation('imdb','rating',8,10,250)];
  catalog.movies[0].au_watch_offers=[{service_id:'1',name:'Fictional service',access_type:'subscription',link:null}];
  data.movies.a.collection={status:'checked_present',external_id:'1',checked_at:'2026',collection_id:123,collection_name:'Fictional collection'};
  data.movies.a.awards={status:'checked_quantified',external_id:'tt1',checked_at:'2026',wins:0,nominations:3,awards_text:'0 wins & 3 nominations.'};
  catalog.movies[0].classic=true;catalog.movies[0].seen=catalog.members.map(m=>({member_id:m.id,seen:1,updated_at:''}));
  vi.mocked(api.metricsEnrichment).mockResolvedValue(data);
  const container=document.createElement('div'),root=createRoot(container);document.body.appendChild(container);
  try {
    await act(async()=>root.render(createElement(MetricsScreen,{catalog,viewer:null,onUpdated:async()=>{}})));
    expect(container.querySelector('.metrics-genre-combinations > .meta')?.textContent).toBe('Unique genre subsets of two or more genres.');
    const tabs=[...container.querySelectorAll<HTMLButtonElement>('[role=tab]')];expect(tabs.map(t=>t.textContent)).toEqual(['Top 5','Tastes','Breakdowns','Records']);
    await act(async()=>tabs[2].click());
    expect([...container.querySelectorAll('.staging-report > h2')].map(h=>h.textContent)).toEqual(metricsInventory.Breakdowns.filter(title=>headings.includes(title)));
    expect(container.textContent).not.toContain('0 wins & 3 nominations.');expect(container.textContent).toContain('Fictional service');
    expect(container.querySelector('[aria-label="Top 5 most cult"]')).toBeNull();expect(container.querySelector('[aria-label="Top 5 hidden gems"]')).toBeNull();expect(container.querySelector('[role="table"][aria-label="Reliably quantified OMDb awards"]')).not.toBeNull();
    expect(container.querySelectorAll('.staging-matrix')).toHaveLength(0);
    const originalAxes=[...container.querySelectorAll('[aria-label^="Shared"]')].map(n=>n.getAttribute('aria-label'));
    await act(async()=>container.querySelectorAll<HTMLButtonElement>('.metrics-filters button')[1].click());
    expect([...container.querySelectorAll('[aria-label^="Shared"]')].map(n=>n.getAttribute('aria-label'))).toEqual(originalAxes);
    expect(container.querySelectorAll('.staging-chart-row')).toHaveLength(3);await act(async()=>tabs[1].click());expect(container.querySelectorAll('.staging-matrix tbody tr')).toHaveLength(10);expect(container.querySelectorAll('.staging-matrix td[title]')).toHaveLength(50);expect(container.querySelectorAll('.staging-comparison-group')).toHaveLength(10);expect(container.querySelectorAll('.staging-comparison-group li')).toHaveLength(40);for(const report of container.querySelectorAll('.staging-mobile-comparisons')){const groups=[...report.querySelectorAll('.staging-comparison-group')];const names=['Sean','Troy','Matt','Jess','Classics'];groups.forEach((group,a)=>{expect([...group.querySelectorAll('li > span:first-child')].map(n=>n.textContent)).toEqual(names.filter((_,b)=>a!==b).map(n=>`${n}: `));for(const line of group.querySelectorAll('li'))expect(line.getAttribute('aria-label')).toBeTruthy();});}expect(container.querySelector('[data-emphasis=true]')).not.toBeNull();
    await act(async()=>tabs[3].click());
    expect(container.querySelectorAll('.metrics-film-extreme')).toHaveLength(10);expect(container.querySelectorAll('.metrics-reception-record')).toHaveLength(2);expect(container.querySelectorAll('.metrics-viewed-record')).toHaveLength(2);
    expect(container.textContent).toContain('Most aligned critics and audiences');expect(container.textContent).toContain('Most misaligned critics and audiences');expect(container.textContent).toContain('Most Classics viewed');expect(container.textContent).toContain('Least Classics viewed');
    await act(async()=>tabs[1].click());expect(container.querySelector('.metrics-fingerprint')).not.toBeNull();
    await act(async()=>tabs[2].click());expect(container.textContent).toContain('Ratings profile');
    await act(async()=>tabs[0].click());expect(container.querySelector('.metrics-rankings')).not.toBeNull();
    const combinationReads=combinations.mock.calls.length;await act(async()=>tabs[2].click());expect(combinations).toHaveBeenCalledTimes(combinationReads);expect(container.querySelector('.metrics-genre-combinations')).toBeNull();
    expect(api.metricsEnrichment).toHaveBeenCalledTimes(1);expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  } finally {await act(async()=>root.unmount());container.remove();}
});
it('keeps every complete historical cycle in a named keyboard-scrollable region and missing reports truthful',async()=>{
  const catalog=metricsFixture();catalog.cycles=Array.from({length:8},(_,i)=>({id:`cycle${i}`,ordinal:i+1,rough_date:'2026-01-01',title:null,import_source:'fixture',import_key:`cycle${i}`,created_at:'',updated_at:''}));
  catalog.sessions=catalog.cycles.flatMap(c=>Array.from({length:5},(_,i)=>({...metricsEvent(`${c.id}-${i}`,[catalog.movies[0]],i===4?null:`m${i+1}`),cycle_id:c.id,cycle_slot:i+1})));
  const all=selectedAppearances(catalog),container=document.createElement('div'),root=createRoot(container);
  try {
    await act(async()=>root.render(createElement(RelocatedReports,{catalog,all,rows:all,filter:{kind:'all'},data:{movies:{}}})));
    const cycles=container.querySelector('.staging-cycles')!;expect(cycles.getAttribute('tabindex')).toBe('0');expect(cycles.getAttribute('role')).toBe('region');expect(cycles.children).toHaveLength(8);expect(cycles.firstElementChild?.querySelector('h3')?.textContent).toBe('8');expect(cycles.lastElementChild?.querySelector('h3')?.textContent).toBe('1');
    expect(container.querySelector('[aria-label="Awards and nominations"]')?.textContent).toContain('No qualifying evidence');
    expect(container.querySelector('[aria-label="Franchise / collection completed"]')?.textContent).toContain('No qualifying evidence');
    expect(container.querySelector('[aria-label="Shared stars"]')?.textContent).toContain('No qualifying evidence');expect(container.querySelector('[aria-label="Streaming platform representation"]')?.textContent).toContain('cached Australian availability');
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  } finally {await act(async()=>root.unmount());}
});

it('keeps concise labels, rounded years/runtimes, touching bar order and all-human stars columns',async()=>{
  const catalog=metricsFixture(),data=metricsEnrichmentFixture();
  catalog.movies[0].runtime=125.836;catalog.movies[0].year=1969;
  const all=selectedAppearances(catalog),container=document.createElement('div'),root=createRoot(container);
  try{
    await act(async()=>root.render(createElement(RelocatedReports,{catalog,all,rows:all,filter:{kind:'all'},data})));
    expect(container.querySelector('[aria-label="Release-year spread"]')?.textContent).toContain('Mean 1969');
    expect(container.querySelector('[aria-label="Release-year spread"]')?.textContent).not.toContain('1,969');
    const runtime=container.querySelector('[aria-label="Runtime spread"]')!;expect(runtime.textContent).toContain('Mean 2 hrs, 6 mins');expect(runtime.textContent).toContain('Shortest: 2 hrs, 6 mins · Longest: 2 hrs, 6 mins');expect(runtime.textContent).not.toMatch(/known|125\.836/);
    const leaning=container.querySelector('[aria-label="Critics or audiences?"]')!;expect(leaning.textContent).toMatch(/\d critic \/ \d audience \/ \d neutral · [\d.]+% (critic|audience|neutral) leaning/);expect(leaning.textContent).not.toMatch(/\([\d.% /]+\)/);
    const paired=container.querySelector('.staging-paired')!;expect([...paired.children].map(n=>n.className)).toEqual(['meta','staging-score-track','staging-score-track','meta']);expect(paired.lastElementChild?.textContent).toContain('Audience:');expect(paired.textContent).not.toContain('scored appearances');
    expect([...container.querySelectorAll('.staging-stars-table thead th')].map(n=>n.querySelector('.stars-heading-desktop')?.textContent ?? n.textContent)).toEqual(['Actor','Sean','Troy','Matt','Jess','Total']);
    expect(container.querySelector('.staging-revenue-table .meta')?.textContent).toMatch(/^\$[\d,]+M USD$/);
    expect(container.querySelector('.staging-flop-content')?.children).toHaveLength(4);
    for(const report of container.querySelectorAll('.staging-discoveries > li')){expect(report.querySelector('.staging-discovery-rank')?.textContent).toMatch(/^#\d/);expect(report.querySelector('.poster')).not.toBeNull();expect(report.querySelector('.staging-discovery-index')).not.toBeNull();}
  }finally{await act(async()=>root.unmount());}
});

it('alignment posters retain complete equal-score details, canonical links and every paginated tie',async()=>{
 const movies=Array.from({length:26},(_,i)=>metricsFilm(String(i),{scores:[observation('imdb','rating',8,10),observation('metacritic','critic',80,100)]}));
 const catalog={...metricsFixture(),movies,sessions:[metricsEvent('ties',movies)]};
 const container=document.createElement('div'),root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(ReceptionRecords,{rows:selectedAppearances(catalog)})));
  for(const section of container.querySelectorAll('.metrics-reception-record')) {
   expect(section.querySelectorAll('.metrics-reception-film')).toHaveLength(5);
   for(const row of section.querySelectorAll('.metrics-reception-film')) {
    expect(row.getAttribute('href')).toMatch(/^#\/movie\//);expect(row.querySelector('.poster-empty')).not.toBeNull();
    expect(row.textContent).toContain('Critics 80.0 · Audiences 80.0 / 100 · 0.0 points · Equal');
   }
   const next=()=>[...section.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Next')!;
   for(let i=0;i<5;i++)await act(async()=>next().click());
   expect(section.querySelectorAll('.metrics-reception-film')).toHaveLength(1);
   expect(section.textContent).toContain('Film 9');
  }
 }finally{await act(async()=>root.unmount());}
});
it.each([[1,0,0,0],[1,0,1,0]])('Classics viewed shows every winning identity with one aligned count: %s',async(...answers)=>{
 const catalog=metricsFixture();catalog.movies=[metricsFilm('classic',{classic:true,seen:catalog.members.map((member,i)=>({member_id:member.id,seen:answers[i] as 0|1,updated_at:''}))})];
 const container=document.createElement('div'),root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(ClassicsViewedRecords,{catalog})));
  const sections=container.querySelectorAll('.metrics-viewed-record');
  for(const [i,section] of [...sections].entries()) {
   const winners=catalog.members.filter((_,index)=>answers[index]===(i===0?1:0));
   expect([...section.querySelectorAll('.metrics-viewed-row .club-identity')].map(e=>e.textContent)).toEqual(winners.map(m=>m.display_name.toUpperCase()));
   expect([...section.querySelectorAll('.metrics-viewed-row > strong')].map(e=>e.textContent)).toEqual(winners.map(()=>`${i===0?1:0} viewed`));
   expect(section.querySelectorAll('.club-avatar')).toHaveLength(winners.length);
   expect(section.textContent).not.toMatch(/tied members|canonical Classic candidates/);
  }
 }finally{await act(async()=>root.unmount());}
});
it('diversity percentages retain missing evidence and densities above 100 percent',async()=>{
 const container=document.createElement('div'),root=createRoot(container);
 try {
  await act(async()=>root.render(createElement(DiversityMetrics,{diversity:[{dimension:'countries',values:[{label:'Dense',perTen:25,distinct:5,covered:2,total:2},{label:'Fractional',perTen:1.875,distinct:3,covered:16,total:16},{label:'Missing',perTen:null,distinct:0,covered:0,total:0}]}]})));
  expect([...container.querySelectorAll('.metrics-distribution-label strong')].map(e=>e.textContent)).toEqual(['250%','18.8%','No evidence']);
  expect(container.textContent).toContain('5 distinct');
 }finally{await act(async()=>root.unmount());}
});

it('extracts only explicit Oscar clauses and formats compact positive grosses',()=>{
 expect(oscarSummary('Won 2 Oscars. 12 wins & 8 nominations.')).toBe('Won 2 Oscars');
 expect(oscarSummary('Nominated for 4 Oscars. 8 nominations.')).toBe('Nominated for 4 Oscars');
 expect(oscarSummary('Won 1 Oscar.')).toBe('Won 1 Oscar');
 for(const text of ['12 wins & 8 nominations.','Won 2 BAFTAs.','Oscar winner','Won 2 Oscars and 3 BAFTAs.','Won 2 Oscars. Nominated for 3 Oscars.',null])expect(oscarSummary(text)).toBeNull();
 expect(grossMillions(124600000)).toBe('$125M USD');expect(grossMillions(1234567890)).toBe('$1,235M USD');expect(grossMillions(1)).toBe('<$1M USD');
});
it.each([0,45.5,100,null])('preserves paired score widths and unavailable semantics: %s',async(score)=>{
 const node=document.createElement('div'),root=createRoot(node);
 try{await act(async()=>root.render(createElement(PairedBars,{critic:score,audience:score,criticCount:score===null?0:1,audienceCount:score===null?0:1})));expect([...node.querySelectorAll<HTMLElement>('.staging-score-track > span')].map(e=>e.style.width)).toEqual([`${score??0}%`,`${score??0}%`]);expect(node.textContent).toContain(score===null?'Unavailable':`${score.toFixed(1)} / 100`);}finally{await act(async()=>root.unmount());}
});
it('caps awards at twenty ordered rows with posters, separate scores and no pagination',async()=>{
 const movies=Array.from({length:25},(_,i)=>metricsFilm(String(i).padStart(2,'0'))),catalog={...metricsFixture(),movies,sessions:[metricsEvent('awards',movies)]};
 const all=selectedAppearances(catalog),data={movies:Object.fromEntries(movies.map(movie=>[movie.id,{...metricsEnrichmentFixture().movies.a,awards:{status:'checked_quantified' as const,external_id:'tt0000001',checked_at:'2026',wins:1000,nominations:2000,awards_text:'Won 2 Oscars. 1000 wins & 2000 nominations.'}}]))};
 const node=document.createElement('div'),root=createRoot(node);
 try{await act(async()=>root.render(createElement(AwardsReport,{catalog,all,rows:all,filter:{kind:'all'},data})));const awards=node.querySelector('[aria-label="Awards and nominations"]')!;expect(awards.querySelectorAll('.staging-awards-row')).toHaveLength(20);expect([...awards.querySelectorAll('.staging-awards-film a')].map(e=>e.textContent)).toEqual(movies.slice(0,20).map(m=>m.title));expect(awards.querySelectorAll('.poster-empty')).toHaveLength(20);expect(awards.textContent).toContain('Won 2 Oscars');expect(awards.textContent).not.toContain('1000 wins');expect(awards.textContent).toContain('1,000');expect(awards.querySelectorAll('button')).toHaveLength(0);expect(awards.querySelector('[role=region]')?.getAttribute('tabindex')).toBe('0');expect([...awards.querySelectorAll('[role=columnheader]')].map(e=>e.textContent)).toEqual(['Film incl. Oscars','Won','Nom.']);}finally{await act(async()=>root.unmount());}
});
it('renders release-adjusted collection partitions and changes at the release boundary with retained cache',async()=>{
 const catalog=metricsFixture();catalog.movies.slice(0,2).forEach((m,i)=>m.external_ids=[{provider:'tmdb',external_id:String(i+1)}]);
 const data=metricsEnrichmentFixture();for(const [i,m] of catalog.movies.slice(0,2).entries())data.movies[m.id].collection={status:'checked_present',external_id:String(i+1),checked_at:'2026',collection_id:7,collection_name:'Series'};
 data.collections={7:{status:'checked',attempted_at:null,roster:{id:7,name:'Series',checked_at:'2026-01-01',parts:[{id:1,title:'First',release_date:'2000-01-01'},{id:2,title:'Second',release_date:'2001-01-01'},{id:3,title:'Future sequel',release_date:'2026-10-11'},{id:4,title:'Untitled Now You See Me 4',release_date:null}]}}};
 const all=selectedAppearances(catalog),reportCache=new Map<string,unknown>(),node=document.createElement('div'),root=createRoot(node);vi.useFakeTimers();
 try{vi.setSystemTime(new Date(2026,9,10,12));await act(async()=>root.render(createElement(CollectionReports,{catalog,all,rows:all,filter:{kind:'all'},data,reportCache})));expect(node.querySelector('[aria-label="Franchise / collection completed"]')?.textContent).toContain('2 of 2 films');expect(node.querySelector('.staging-missing-films')).toBeNull();expect(node.textContent).not.toContain('Untitled Now You See Me 4');await act(async()=>{await vi.advanceTimersByTimeAsync(12*60*60*1000);});expect(node.querySelector('[aria-label="Incomplete collections"]')?.textContent).toContain('2 of 3 films');expect(node.querySelector('.staging-missing-films')?.textContent).toContain('Future sequel');expect(node.querySelector('[aria-label="Franchise / collection completed"]')?.textContent).toContain('No qualifying evidence');
 const refreshed={...data,collections:{7:{...data.collections![7],roster:{...data.collections![7].roster!,parts:data.collections![7].roster!.parts.map(part=>part.id===4?{...part,release_date:'2002-01-01'}:part)}}}};
 await act(async()=>root.render(createElement(CollectionReports,{catalog,all,rows:all,filter:{kind:'all'},data:refreshed,reportCache:new Map<string,unknown>()})));
 expect(node.querySelector('[aria-label="Incomplete collections"]')?.textContent).toContain('2 of 4 films');expect(node.querySelector('.staging-missing-films')?.textContent).toContain('Untitled Now You See Me 4');
 }finally{await act(async()=>root.unmount());vi.useRealTimers();}
});

it.each([1,2,3])('reception Records describes %s exact winners truthfully',async(count)=>{
 const movies=Array.from({length:count},(_,i)=>metricsFilm(`tie-${i}`,{scores:[observation('metacritic','critic',60,100),observation('imdb','rating',7.25,10)]}));
 const catalog={...metricsFixture(),movies,sessions:[metricsEvent('ties',movies)]},node=document.createElement('div'),root=createRoot(node);
 try{await act(async()=>root.render(createElement(ReceptionRecords,{rows:selectedAppearances(catalog)})));for(const section of node.querySelectorAll('.metrics-reception-record')){expect(section.querySelector('p')?.textContent).toBe(`${count===1?'No tie':`${count} tied films`} · 12.5 points absolute difference`);expect(section.querySelectorAll('.metrics-reception-film')).toHaveLength(count);}}finally{await act(async()=>root.unmount());}
});

it('mobile comparison cells preserve unknown evidence and pair colours from the desktop data',async()=>{
 const catalog=metricsFixture(),scopes=[...catalog.members.slice().sort((a,b)=>a.sort_order-b.sort_order).map(member=>({label:member.display_name,filter:{kind:'member' as const,memberId:member.id}})),{label:'Classics',filter:{kind:'classics' as const}}];
 const node=document.createElement('div'),root=createRoot(node),cell=(a:number,b:number)=>({text:a===0||b===0?'Unavailable':'84.2%',detail:a===0||b===0?'No usable genre evidence':'84.2% cosine similarity',colour:a===0||b===0?undefined:'grass'});
 try{await act(async()=>root.render(createElement(Matrix,{catalog,scopes,filter:{kind:'member',memberId:'m2'},label:'Fixture comparison',cell})));const groups=node.querySelectorAll('.staging-comparison-group');expect(groups).toHaveLength(5);expect(groups[0].querySelectorAll('li')).toHaveLength(4);expect(groups[0].textContent).toContain('Unavailable');expect(groups[0].querySelector('li')?.getAttribute('aria-label')).toContain('No usable genre evidence');expect(groups[1].querySelectorAll<HTMLElement>('li > span:last-child')[1].style.color).toBe('var(--grass)');expect(node.querySelectorAll('.staging-matrix td')).toHaveLength(25);expect(groups[1].getAttribute('data-emphasis')).toBe('true');}finally{await act(async()=>root.unmount());}
});

it('collection disclosures are independently collapsed across both reports and retain result pagination',async()=>{
 const movies=Array.from({length:46},(_,i)=>metricsFilm(`collection-${i}`,{external_ids:[{provider:'tmdb',external_id:String(i+1)}]}));
 const catalog={...metricsFixture(),movies,sessions:[metricsEvent('collection-fixture',movies)]},data={movies:{},collections:{}} as ReturnType<typeof metricsEnrichmentFixture>;
 for(let i=0;i<23;i++){const id=i+1;const pair=movies.slice(i*2,i*2+2);for(const movie of pair)data.movies[movie.id]={...metricsEnrichmentFixture().movies.a,collection:{status:'checked_present',external_id:movie.external_ids[0].external_id,checked_at:'2026',collection_id:id,collection_name:`Series ${String(i).padStart(2,'0')}`}};data.collections![id]={status:'checked',attempted_at:null,roster:{id,name:`Series ${String(i).padStart(2,'0')}`,checked_at:'2026-01-01',parts:[...pair.map(m=>({id:Number(m.external_ids[0].external_id),title:m.title,release_date:'2000-01-01'})),...(i<2?[]:[{id:100+i,title:'Released missing title',release_date:'2000-01-01'}])]}};}
 const all=selectedAppearances(catalog),node=document.createElement('div'),root=createRoot(node);
 try{await act(async()=>root.render(createElement(CollectionReports,{catalog,all,rows:all,filter:{kind:'all'},data})));const rows=node.querySelectorAll<HTMLDetailsElement>('.staging-collection');expect(rows).toHaveLength(22);expect([...rows].every(row=>!row.open)).toBe(true);expect(node.querySelectorAll('summary a')).toHaveLength(0);expect(node.querySelectorAll('summary h3')).toHaveLength(22);rows[0].open=true;rows[2].open=true;expect(rows[1].open).toBe(false);expect(rows[3].open).toBe(false);expect(rows[2].querySelector('.staging-missing-films')?.textContent).toContain('Released missing title');const next=node.querySelector<HTMLButtonElement>('[aria-label="Incomplete collections pages"] button:last-child');expect(next).not.toBeNull();await act(async()=>next!.click());expect(node.querySelectorAll('.staging-collection')).toHaveLength(3);expect(node.querySelector('[aria-label="Incomplete collections"]')?.textContent).toContain('Released missing title');}finally{await act(async()=>root.unmount());}
});
