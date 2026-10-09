import { describe,it,expect } from 'vitest';
import { selectedAppearances } from '../shared/metrics';
import { metricsFilm,metricsEvent,metricsFixture,observation } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
import { emptyEnrichmentMovie, type MetricsEnrichment } from '../shared/metrics-enrichment';
import { cycleScorecards,contributorSpreads,contributorLeaning,receptionExtremes,classicsViewed } from '../shared/metrics-staging/numerical';
import { genreCombinations,genreOverlap,firstSharedTheme } from '../shared/metrics-staging/overlap';
import { sharedStars,partnerships,genreRevenue,expensiveFlops,classificationAcclaim,platforms,discoveries,percentile,collectionSpotlight,awardsReport } from '../shared/metrics-staging/films';
import type { Catalog } from '../shared/types';
const allFilter={kind:'all'} as const;
const scores=(critic:number,audience:number,votes=100)=>[observation('metacritic','critic',critic,100),observation('imdb','rating',audience/10,10,votes)];
function simple():Catalog {
  const c=metricsFixture();c.movies=[metricsFilm('a',{scores:scores(60,80),genres:['Drama','Comedy','Crime'],year:2000,runtime:100}),metricsFilm('b',{scores:scores(80,60),genres:['Comedy','Drama'],year:2020,runtime:200}),metricsFilm('c',{scores:scores(70,70),genres:[],year:null,runtime:null}),metricsFilm('d',{scores:[],genres:['Unknown']})];
  c.sessions=[metricsEvent('one',c.movies),metricsEvent('two',[c.movies[0]],'m2'),metricsEvent('three',[c.movies[0]],'m3'),metricsEvent('four',[c.movies[1]],'m4'),metricsEvent('classics',[c.movies[0]],null)];return c;
}
describe('Staging numerical reports',()=>{
  it('requires all five legitimate completed turns, supports imports and Classics-first and keeps filtered qualification',()=>{
    const c=simple();c.cycles=Array.from({length:8},(_,i)=>({id:`c${i}`,ordinal:i+1,rough_date:'2026-01-01',title:null,import_source:i===0?'synthetic':null,import_key:i===0?'cycle':null,created_at:'',updated_at:'',classics_first:i===1?1:0}));
    c.sessions=c.cycles.flatMap(cycle=>Array.from({length:5},(_,i)=>({...metricsEvent(`${cycle.id}-${i}`,[c.movies[0]],i+1===(cycle.classics_first?1:5)?null:`m${i===4?1:i+1}`),cycle_id:cycle.id,cycle_slot:i+1,completed_turn_version:cycle.import_source?null:i+1})));
    let all=selectedAppearances(c);expect(cycleScorecards(c,all,all)).toHaveLength(8);
    const selected=all.filter(r=>r.session.host_member_id==='m1');expect(cycleScorecards(c,all,selected).map(r=>r.criticCount)).toEqual(Array(8).fill(1));
    c.sessions.find(s=>s.cycle_id==='c7'&&s.cycle_slot===2)!.completed_turn_version=null;
    c.sessions.find(s=>s.cycle_id==='c6'&&s.cycle_slot===3)!.deleted_at='deleted';
    c.sessions.find(s=>s.cycle_id==='c5'&&s.cycle_slot===5)!.kind='hosted';
    all=selectedAppearances(c);expect(cycleScorecards(c,all,all).map(r=>r.cycle.ordinal)).toEqual([5,4,3,2,1]);
    c.movies[0].scores=[];all=selectedAppearances(c);expect(cycleScorecards(c,all,all)[0]).toMatchObject({critic:null,audience:null,criticCount:0});
  });
  it('uses population SD rather than min/max, excludes invalids, and keeps axes stable for single/empty rows',()=>{
    const c=simple(),all=selectedAppearances(c),years=contributorSpreads(c,all,allFilter,'year'),runtime=contributorSpreads(c,all,allFilter,'runtime');
    expect(years.groups[0]).toMatchObject({mean:2007,low:2007-Math.sqrt(254/3),high:2007+Math.sqrt(254/3),count:3});
    expect(runtime.groups[0]).toMatchObject({mean:400/3,low:100,high:200,count:3});
    expect([years.minimum,years.maximum]).toEqual([2000,2020]);
    const filtered=contributorSpreads(c,all,{kind:'member',memberId:'m2'},'year');expect(filtered.minimum).toBe(years.minimum);expect(filtered.maximum).toBe(years.maximum);expect(filtered.groups[0]).toMatchObject({count:1,low:2000,high:2000,sd:0});
    c.movies.forEach(m=>{m.runtime=NaN;m.year=-1;});const missing=contributorSpreads(c,selectedAppearances(c),allFilter,'year');expect(missing.groups.every(g=>g.mean===null&&g.count===0)).toBe(true);
  });
  it('counts binary leaning with neutrals and excludes missing composite categories',()=>{
    const c=simple(),all=selectedAppearances(c),leaning=contributorLeaning(c,all,allFilter);
    expect(leaning[0]).toMatchObject({critic:1,audience:1,neutral:1,count:3,leaning:0});expect(leaning[1].leaning).toBe(100);
    c.movies[0].scores=scores(1,100);expect(contributorLeaning(c,selectedAppearances(c),allFilter)[0].leaning).toBe(0);
    c.movies.forEach(m=>m.scores=[]);expect(contributorLeaning(c,selectedAppearances(c),allFilter)[0].leaning).toBeNull();
  });
});
describe('Staging overlap reports',()=>{
  it('enumerates all subsets once per canonical film, including triples and fifth-place ties',()=>{
    const c=simple();c.movies[0].genres=['Crime','Comedy','Drama','Drama'];c.sessions.push(metricsEvent('repeat',[c.movies[0]]));
    const values=genreCombinations(selectedAppearances(c));expect(values.find(v=>v.label==='Comedy + Drama')?.count).toBe(2);expect(values.find(v=>v.label==='Comedy + Crime + Drama')?.count).toBe(1);expect(values).toHaveLength(4);
    c.movies[0].genres=['Crime','Comedy','Drama','Fantasy'];expect(genreCombinations(selectedAppearances(c))).toHaveLength(11);
  });
  it('fractionally weights genre distributions, remains symmetric/bounded and distinguishes disjoint from empty',()=>{
    const c=simple(),report=genreOverlap(c,selectedAppearances(c));
    report.values.forEach((row,i)=>row.forEach((n,j)=>{expect(n).toBeCloseTo(report.values[j][i]!);expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThanOrEqual(100);}));
    expect(report.values[1][2]).toBeCloseTo(100);
    c.movies[1].genres=['Western'];c.movies[0].genres=[];const next=genreOverlap(c,selectedAppearances(c));expect(next.values[1][1]).toBeNull();expect(next.values[0][3]).toBeCloseTo(100);
    c.movies[0].genres=['Crime'];expect(genreOverlap(c,selectedAppearances(c)).values[1][3]).toBe(0);
  });
  it('selects intersections by min max-rank, then rank sum and name, with cleaned deduplicated keyword frequencies',()=>{
    const c=simple();c.sessions=[metricsEvent('a',[c.movies[0]]),metricsEvent('b',[c.movies[1]],'m2')];
    const data:MetricsEnrichment={movies:{a:{...emptyEnrichmentMovie(),keywords:['alpha','beta','shared','shared','oscar-winner'].map(name=>({provider:'tmdb',name}))},b:{...emptyEnrichmentMovie(),keywords:['aardvark','shared','zebra'].map(name=>({provider:'tmdb',name}))}}};
    const report=firstSharedTheme(c,selectedAppearances(c),data);expect(report.values[0][1]).toMatchObject({label:'Shared',rankA:3,rankB:2,countA:1,countB:1});expect(report.values[1][0]).toMatchObject({rankA:2,rankB:3});expect(report.values[0][2]).toBeNull();
    data.movies.b.keywords=['beta','shared'].map(name=>({provider:'tmdb',name}));expect(firstSharedTheme(c,selectedAppearances(c),data).values[0][1]?.label).toBe('Beta');
    for(const [id,name] of [['a','alpha'],['b','other'],['c','gamma'],['d','beta']])data.movies[id]={...emptyEnrichmentMovie(),keywords:[{provider:'tmdb',name}]};
    c.sessions=[metricsEvent('a',[c.movies[0],c.movies[0],c.movies[0],c.movies[2],c.movies[2],c.movies[3]]),metricsEvent('b',[c.movies[1],c.movies[1],c.movies[1],c.movies[3],c.movies[3],c.movies[0]],'m2')];
    // Alpha (1,3) beats Beta (3,2) on the rank sum after both reach maximum rank 3.
    expect(firstSharedTheme(c,selectedAppearances(c),data).values[0][1]).toMatchObject({label:'Alpha',rankA:1,rankB:3});
    c.sessions=[metricsEvent('a',[c.movies[0],c.movies[0],c.movies[3]]),metricsEvent('b',[c.movies[3],c.movies[3],c.movies[0]],'m2')];
    // Alpha (1,2) and Beta (2,1) tie on both rank comparisons; alphabetical display wins.
    expect(firstSharedTheme(c,selectedAppearances(c),data).values[0][1]?.label).toBe('Alpha');
  });
});
describe('Staging evidence and discovery reports',()=>{
  it('requires all four humans with per-human counts; deduplicates Writer/Screenplay partnerships',()=>{
    const c=simple(),all=selectedAppearances(c),data=metricsEnrichmentFixture();
    const stars=sharedStars(c,all,data);expect(stars[0]).toMatchObject({appearances:6,counts:[3,1,1,1]});
    data.movies.b.credits.filter(v=>v.kind==='cast').forEach(v=>v.person_id='other');expect(sharedStars(c,all,data)).toEqual([]);
    const pairs=partnerships(all,metricsEnrichmentFixture());expect(pairs.map(p=>p.role)).toEqual(['Writer','Composer','Cinematographer']);expect(pairs[0].values[0].films).toHaveLength(3);
    c.movies[0].director='A and B';expect(partnerships(selectedAppearances(c),data)[0].values.some(v=>v.director==='A and B')).toBe(true);
  });
  it('retains genre revenue ties and uses distinct-film financial extremes without assuming profit',()=>{
    const c=simple(),all=selectedAppearances(c),data=metricsEnrichmentFixture();data.movies.a.metadata!.revenue=100;data.movies.b.metadata!.revenue=100;
    expect(genreRevenue(all,data).find(v=>v.genre==='Drama')?.films).toHaveLength(2);
    data.movies.a.metadata!.budget=700;data.movies.b.metadata!.budget=700;
    expect(expensiveFlops(c,all,allFilter,data)[0].values).toHaveLength(2);expect(expensiveFlops(c,all,allFilter,data)[0].values[0].ratio).toBe(10);
    data.movies.a.metadata!.budget=0;data.movies.b.metadata!.budget=-1;expect(expensiveFlops(c,all,allFilter,data)[0].values).toEqual([]);
  });
  it('keeps classification score denominators separate and AU service/access offers deduplicated',()=>{
    const c=simple();c.movies[1].scores=[observation('imdb','rating',8,10)];const all=selectedAppearances(c),data=metricsEnrichmentFixture();
    const known=classificationAcclaim(all,data).find(v=>v.id==='MA15+')!;expect(known).toMatchObject({criticCount:4,audienceCount:6});
    c.movies[0].au_watch_offers=Array(2).fill({service_id:'1',name:'Service',access_type:'subscription',link:null});c.movies[0].au_watch_offers.push({service_id:'1',name:'Service',access_type:'rent',link:null});c.movies[1].au_watch_offers=[{service_id:'1',name:'Service',access_type:'rent',link:null}];
    expect(platforms(all)).toMatchObject({population:4,values:[{count:1,percentage:25,access:[{type:'subscription',count:1},{type:'rent',count:2}]}]});
    c.movies[0].au_watch_offers=[{service_id:'10',name:'Apple TV Store',access_type:'rent',link:null},{service_id:'11',name:'Apple TV',access_type:'rent',link:null}];c.movies[1].au_watch_offers=[];
    expect(platforms(all).values).toEqual([]);
  });
  it('defines hidden-gem midrank percentiles and cult positive-gap threshold, preserving genuine cutoff ties',()=>{
    expect(percentile(2,[1,2,2,3])).toBe(.5);expect(percentile(1,[1])).toBe(.5);
    const c=simple();c.movies=Array.from({length:7},(_,i)=>metricsFilm(`g${i}`,{scores:scores(60,80,100)}));c.sessions=[metricsEvent('gems',c.movies)];
    const report=discoveries(selectedAppearances(c));expect(report.hidden).toHaveLength(7);expect(report.hidden[0].rank).toBe(25);expect(report.cult).toHaveLength(7);expect(report.cult[0].gap).toBe(20);
    c.movies[0].scores=scores(85,80);c.movies[1].scores=scores(60,80,99);c.movies[2].scores=scores(71,80);const next=discoveries(selectedAppearances(c));expect(next.eligible).toBe(6);expect(next.cult).toHaveLength(4);
    c.movies.forEach(m=>m.scores=[]);expect(discoveries(selectedAppearances(c))).toMatchObject({eligible:0,hidden:[],cult:[]});
  });
  it('distinguishes checked collection negatives and every awards state, preserving original wording and null counts',()=>{
    const c=simple(),all=selectedAppearances(c),data:MetricsEnrichment={movies:{}};
    c.movies.forEach(m=>data.movies[m.id]=emptyEnrichmentMovie());
    data.movies.a.collection={status:'checked_present',external_id:'1',checked_at:'2026',collection_id:2,collection_name:'Collection'};
    data.movies.b.collection={status:'checked_none',external_id:'2',checked_at:'2026',collection_id:null,collection_name:null};
    expect(collectionSpotlight(all,data)).toMatchObject({members:1,checked:2,standalone:1,total:4,percentage:50});
    data.movies.a.awards={status:'checked_quantified',external_id:'tt1',checked_at:'2026',awards_text:'0 wins & 2 nominations.',wins:0,nominations:2};
    data.movies.b.awards={status:'checked_unquantified',external_id:'tt2',checked_at:'2026',awards_text:'Award winner',wins:null,nominations:null};
    data.movies.c.awards={status:'checked_unavailable',external_id:'tt3',checked_at:'2026',awards_text:null,wins:null,nominations:null};
    expect(awardsReport(all,data)).toMatchObject({total:4,checked:3,unquantified:1,unavailable:1,values:[{wins:0,nominations:2,awards_text:'0 wins & 2 nominations.'}]});
    data.movies.a.awards.wins=null;expect(awardsReport(all,data).values[0].wins).toBeNull();
  });
});
describe('additional Records',()=>{
  it('deduplicates canonical films, includes exact reception ties in both directions and excludes missing scores',()=>{
    const c=simple(),all=selectedAppearances(c),records=receptionExtremes(all);expect(records.aligned?.items.map(v=>v.row.movie.id)).toEqual(['c']);expect(records.misaligned?.items).toHaveLength(2);expect(records.misaligned?.items.map(v=>v.difference)).toEqual([20,-20]);
    c.movies.forEach(m=>m.scores=[]);expect(receptionExtremes(selectedAppearances(c))).toEqual({aligned:null,misaligned:null});
  });
  it('uses only canonical Classics with all four explicit answers, and retains every human winner',()=>{
    const c=simple();c.movies.forEach(m=>{m.classic=true;m.seen=c.members.map((member,i)=>({member_id:member.id,seen:i%2,updated_at:''}));});c.movies[0].seen.pop();c.movies[1].seen[0].seen=2;c.movies[2].classic=false;
    const report=classicsViewed(c);expect(report.pool).toBe(1);expect(report.most?.items.map(v=>v.member.id)).toEqual(['m2','m4']);expect(report.least?.items.map(v=>v.member.id)).toEqual(['m1','m3']);
    c.movies[3].seen=[];expect(classicsViewed(c)).toMatchObject({pool:0,most:null,least:null});
  });
});

describe('Metrics refinement regressions',()=>{
  it('assigns each unordered genre pairing one saturated rank colour with stable exact ties',()=>{
    const c=simple(),all=selectedAppearances(c),report=genreOverlap(c,all);
    const pairs=report.values.flatMap((row,a)=>row.flatMap((value,b)=>b>a&&value!==null?[{a,b,value}]:[])).sort((x,y)=>y.value-x.value||x.a-y.a||x.b-y.b);
    expect(pairs.map(({a,b})=>report.colours[a][b])).toEqual(['emerald','grass','avacado','sunflower','pumpkin','carrot','grapefruit','ruby','rose','lavender']);
    report.colours.forEach((row,a)=>row.forEach((colour,b)=>{expect(colour).toBe(report.colours[b][a]);if(a===b)expect(colour).toBeNull();}));
    expect(genreOverlap(c,[...all].reverse()).colours).toEqual(report.colours);
  });
  it('eliminates competing themes simultaneously through several rounds, mirrors ranks and exhausts lists',()=>{
    const c=simple();c.sessions=[metricsEvent('a',[c.movies[0]]),metricsEvent('b',[c.movies[1]],'m2'),metricsEvent('c',[c.movies[2]],'m3')];
    const data:MetricsEnrichment={movies:{}};
    const terms={a:['friendship','journey','zebra','zodiac'],b:['friendship','journey','zebra','zombie'],c:['friendship','journey','zodiac','zombie']};
    for(const [id,names] of Object.entries(terms))data.movies[id]={...emptyEnrichmentMovie(),keywords:names.map(name=>({provider:'tmdb',name}))};
    let report=firstSharedTheme(c,selectedAppearances(c),data);
    expect([report.values[0][1]?.label,report.values[0][2]?.label,report.values[1][2]?.label]).toEqual(['Zebra','Zodiac','Zombie']);
    expect(report.values[1][0]).toMatchObject({rankA:report.values[0][1]!.rankB,rankB:report.values[0][1]!.rankA});
    // With only the two universal candidates, every pair exhausts rather than awarding a winner.
    Object.values(data.movies).forEach(movie=>movie.keywords=movie.keywords.slice(0,2));
    report=firstSharedTheme(c,selectedAppearances(c),data);expect(report.values.flat().every(v=>v===null)).toBe(true);
  });
  it('reconsiders a previously unique theme when another pair reaches it',()=>{
    const c=simple();c.movies=Array.from({length:7},(_,i)=>metricsFilm(String(i)));
    const names=['alpha','beta','gamma','delta','epsilon','zeta','omega'];
    const data:MetricsEnrichment={movies:Object.fromEntries(c.movies.map((m,i)=>[m.id,{...emptyEnrichmentMovie(),keywords:[{provider:'tmdb',name:names[i]}]}]))};
    const repeated=(indices:number[])=>indices.flatMap((index,i)=>Array(8-i).fill(c.movies[index]));
    // AC/BC initially collide on Beta. BC then reaches Alpha, AB's unique choice;
    // both Alpha pairs must advance again rather than freezing the earlier winner.
    c.sessions=[metricsEvent('a',repeated([0,1,2,3])),metricsEvent('b',repeated([0,1,4,5]),'m2'),metricsEvent('c',repeated([1,2,0,4]),'m3')];
    const report=firstSharedTheme(c,selectedAppearances(c),data),terms=report.values.flatMap((row,a)=>row.flatMap((v,b)=>b>a&&v?[v.label]:[]));
    expect(terms).toEqual(['Beta','Gamma','Epsilon']);expect(new Set(terms).size).toBe(terms.length);
  });
  it('excludes same-person partnerships by ID and safe name fallback, with five plus support ties',()=>{
    const c=simple(),data=metricsEnrichmentFixture();c.movies[0].director='Charles Chaplin';
    data.movies.a.credits=[{kind:'crew',role:'writer',person_id:'1',name:'Charlie Chaplin'}];
    expect(partnerships(selectedAppearances(c),data)[0].values.some(v=>v.director==='Charles Chaplin')).toBe(false);
    data.movies.a.credits.push({kind:'crew',role:'director',person_id:'1',name:'A different credited alias'});
    expect(partnerships(selectedAppearances(c),data)[0].values.some(v=>v.director==='A different credited alias')).toBe(false);
    c.movies=Array.from({length:8},(_,i)=>metricsFilm(`p${i}`,{director:`Director ${i}`}));c.sessions=[metricsEvent('pairs',c.movies)];
    c.movies.forEach((m,i)=>{data.movies[m.id]={...emptyEnrichmentMovie(),credits:[{kind:'crew',role:'writer',person_id:`w${i}`,name:`Writer ${i}`}]};});
    expect(partnerships(selectedAppearances(c),data)[0].values).toHaveLength(8);
    const repeat=metricsFilm('repeat',{director:'Director 0'});c.movies.push(repeat);data.movies.repeat=data.movies.p0;c.sessions[0].movies.push(repeat);
    expect(partnerships(selectedAppearances(c),data)[0].values[0].films).toHaveLength(2);
  });
  it('ranks streamable distinct films, deduplicates access types and retains fifth-place ties',()=>{
    const c=simple();c.movies=Array.from({length:8},(_,i)=>metricsFilm(`s${i}`,{au_watch_offers:[{service_id:String(i),name:`Service ${i}`,access_type:'subscription',link:null}]}));
    c.movies[0].au_watch_offers!.push({service_id:'0',name:'Service 0',access_type:'free',link:null},{service_id:'0',name:'Service 0',access_type:'rent',link:null});
    c.movies[7].au_watch_offers=[{service_id:'buy',name:'Purchase only',access_type:'buy',link:null}];c.sessions=[metricsEvent('streaming',c.movies)];
    const report=platforms(selectedAppearances(c));expect(report.values).toHaveLength(7);expect(report.values[0]).toMatchObject({count:1,percentage:12.5});expect(report.values.every(v=>v.count===1)).toBe(true);
    expect(report.values[0].access).toEqual([{type:'subscription',count:1},{type:'free',count:1},{type:'rent',count:1}]);
  });
});
