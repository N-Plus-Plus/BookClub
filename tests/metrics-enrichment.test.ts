import { describe,expect,it } from 'vitest';
import { comparisonScopes,emptyEnrichmentMovie,facts,filmEconomics,fingerprint,languageCategories,normaliseAu,australianClassification,positiveMoney,recurringTalent,stackedProfile,talent,tasteDiversity,themes,tiedExtreme,filmExtremes,talentRoles,type MetricsEnrichment,type MetricsEnrichmentMovie } from '../shared/metrics-enrichment';
import { matchesMetricsFilter,selectedAppearances,type Appearance,type MetricsFilter } from '../shared/metrics';
import { metricsEvent,metricsFilm,metricsFixture,observation } from './metrics-fixture';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture';
const movie = (extra:Partial<MetricsEnrichmentMovie> = {}):MetricsEnrichmentMovie => ({...emptyEnrichmentMovie(),...extra});
const film = metricsFilm('a'), other = metricsFilm('b'), missing = metricsFilm('c',{director:null});
const rows = selectedAppearances({movies:[film,other,missing],members:[],cycles:[],sessions:[metricsEvent('s',[film,film,other,missing])]});
const data:MetricsEnrichment = {movies:{a:movie({metadata:{original_language:'ja',budget:10,revenue:30},countries:[{code:'JP',name:'Japan'},{code:'US',name:null},{code:'JP',name:'Japan'}],languages:[{code:'ja',name:'日本語',english_name:'Japanese'}],companies:[{external_id:'1',name:'Studio'},{external_id:'1',name:'Alias'},{external_id:'2',name:'Studio'}],keywords:[{provider:'tmdb',name:'Time Travel'},{provider:'mdblist',name:' time travel '},{provider:'tmdb',name:'serial killer'},{provider:'mdblist',name:'murder'}],credits:[{kind:'cast',role:'cast',person_id:'1',name:'Person'},{kind:'cast',role:'cast',person_id:'1',name:'Alias'},{kind:'cast',role:'cast',person_id:'2',name:'Person'},{kind:'crew',role:'writer',person_id:'3',name:'Writer'},{kind:'crew',role:'screenplay',person_id:'3',name:'Writer'},{kind:'crew',role:'composer',person_id:'4',name:'Composer'}]}),b:movie({metadata:{original_language:'en',budget:100,revenue:300},keywords:[{provider:'tmdb',name:'one-off'}]})}};
describe('enriched Metrics themes',() => {
  it.each([['tmdb','Theme'],['mdblist','Theme']])('uses %s keywords', (provider,name) => expect(themes(movie({keywords:[{provider,name}]}))).toEqual([{id:'theme',label:'Theme'}]));
  it('deduplicates only exact case/trim matches with deterministic TMDB casing',() => {
    expect(themes(data.movies.a).map(f => f.label)).toEqual(['murder','serial killer','Time Travel']);
    expect(themes({...data.movies.a,keywords:[...data.movies.a.keywords].reverse()})).toEqual(themes(data.movies.a));
    expect(themes(movie({keywords:[{provider:'mdblist',name:'Murder'},{provider:'mdblist',name:' murder '}]}))).toEqual([{id:'murder',label:'Murder'}]);
    expect(themes(movie({keywords:[{provider:'tmdb',name:'time  travel'},{provider:'tmdb',name:'time travel'}]}))).toHaveLength(2);
  });
  it('counts once per theme per appearance, retaining repeats and ALL denominator',() => {
    const read = (r:Appearance) => facts(r,data,'themes');
    const report = fingerprint(rows.slice(0,2),rows,read,{distinctive:true,minimum:2});
    expect(report).toMatchObject({covered:2,distinct:3});
    expect(report.values.every(v => v.count === 2 && v.percentage === 100 && v.ratio === 2)).toBe(true);
    expect(fingerprint(rows.slice(2),rows,read,{distinctive:true,minimum:2}).values).toEqual([]);
  });
  it('ALL scopes derive each contributor signature against whole club, not ALL vs ALL',() => {
    const catalog = metricsFixture(),all = selectedAppearances(catalog),enriched = metricsEnrichmentFixture();
    const signatures = comparisonScopes(catalog,all,{kind:'all'}).map(s => fingerprint(s.rows,all,r => facts(r,enriched,'themes'),{distinctive:true,minimum:2,limit:3}));
    expect(signatures).toHaveLength(5);expect(signatures[0].values[0].ratio).toBeGreaterThan(1);expect(signatures.every(s => s.values.length <= 3)).toBe(true);
  });
});
describe('talent and multi-valued profiles',() => {
  it('cast identity uses IDs, dedupes credits and keeps homonyms distinct',() => {
    expect(talent(rows[0],data.movies.a,'Cast')).toHaveLength(2);
    const report = fingerprint(rows,rows,r => talent(r,data.movies[r.movie.id] ?? movie(),'Cast'),{qualifyingShare:true});
    expect(report.covered).toBe(2);expect(report.values.every(v => v.count === 2 && v.percentage === 100)).toBe(true);
  });
  it('Writer unions screenplay and writer per person; roles stay separate',() => {
    expect(talent(rows[0],data.movies.a,'Writer')).toEqual([{id:'person:3',label:'Writer'}]);
    expect(talent(rows[0],data.movies.a,'Composer')).toEqual([{id:'person:4',label:'Composer'}]);
    expect(talent(rows[0],data.movies.a,'Producer')).toEqual([]);
    expect(data.movies.a.credits.filter(c => c.person_id === '3')).toHaveLength(2);
  });
  it('talent ratio compares role-qualified selected and ALL appearances',() => {
    const enriched:MetricsEnrichment = {movies:{...data.movies,b:movie({credits:[{kind:'cast',role:'cast',person_id:'3',name:'Another'}]})}};
    const report = fingerprint(rows.slice(0,2),rows,r => talent(r,enriched.movies[r.movie.id] ?? movie(),'Cast'),{qualifyingShare:true});
    expect(report.values[0]).toMatchObject({count:2,percentage:100});expect(report.values[0].ratio).toBeCloseTo(1.5);
  });
  it('director fallback retains combined canonical names without parsing',() => {
    const row = {...rows[0],movie:{...film,director:'A, B and C'}};
    expect(talent(row,movie(),'Director')).toEqual([{id:'A, B and C',label:'A, B and C'}]);
    expect(talent(rows[3],movie(),'Director')).toEqual([]);
  });
  it('counts each country once with repeat screenings and supplies code fallback/coverage',() => {
    const report = fingerprint(rows,rows,r => facts(r,data,'countries'));
    expect(report).toMatchObject({covered:2,distinct:2});expect(report.values.map(v => [v.label,v.count,v.percentage])).toEqual([['Japan',2,50],['US',2,50]]);
  });
  it('company IDs dedupe aliases and preserve distinct homonymous companies',() => {
    const report = fingerprint(rows.slice(0,2),rows,r => facts(r,data,'companies'));
    expect(report.values).toHaveLength(2);expect(report.values.every(v => v.count === 2 && v.ratio === 2)).toBe(true);
  });
  it('friendly original language uses matching language evidence and otherwise uppercase ISO',() => {
    expect(facts(rows[0],data,'languages')).toEqual([{id:'ja',label:'Japanese'}]);
    expect(facts(rows[2],data,'languages')).toEqual([{id:'en',label:'EN'}]);
    expect(facts(rows[3],data,'languages')).toEqual([]);
  });
  it('non-English excludes Unknown and uses en, not friendly label or spoken languages',() => {
    const report = stackedProfile(rows,data,'language');
    expect([...report.counts]).toEqual([['ja',2],['en',1],['Unknown',1]]);expect(report.covered).toBe(3);expect(report.headline).toBeCloseTo(200/3);
    expect(languageCategories(rows,data)).toEqual([{id:'ja',label:'Japanese'},{id:'en',label:'EN'},{id:'Other',label:'Other'},{id:'Unknown',label:'Unknown'}]);
  });
});
describe('AU classification resolver',() => {
  it.each([['g','G'],[' pg ','PG'],['M','M'],['MA 15 +','MA15+'],['MA15','MA15+'],['R 18+','R18+'],['R18','R18+'],['X18+','Other'],['unrated','Other']])('normalises %s to %s', (input,output) => expect(normaliseAu(input)).toBe(output));
  it('missing and blank evidence are Unknown',() => {expect(australianClassification(movie())).toBe('Unknown');expect(australianClassification(movie({contentRatings:[{certification:' ',release_type:3}]}))).toBe('Unknown');});
  it('theatrical wins over home release severity; equal theatrical conflicts take highest severity',() => {
    const ratings = [{certification:'M',release_type:3},{certification:'PG',release_type:2},{certification:'R18+',release_type:5}];
    expect(australianClassification(movie({contentRatings:ratings}))).toBe('M');
    expect(australianClassification(movie({contentRatings:[...ratings].reverse()}))).toBe('M');
    expect(australianClassification(movie({contentRatings:[{certification:'Other value',release_type:3},{certification:'M',release_type:4}]}))).toBe('Other');
  });
  it('non-theatrical fallback is deterministic and unknown labels do not invent categories',() => {
    expect(australianClassification(movie({contentRatings:[{certification:'PG',release_type:null},{certification:'MA15+',release_type:5}]}))).toBe('MA15+');
    expect(australianClassification(movie({contentRatings:[{certification:'X18+',release_type:3}]}))).toBe('Other');
  });
  it('duplicate equivalents give one bucket per appearance; totals and known-only restricted denominator are truthful',() => {
    const enriched = {movies:{a:movie({contentRatings:[{certification:'MA15+',release_type:3},{certification:'MA 15+',release_type:2}]}),b:movie({contentRatings:[{certification:'PG',release_type:3}]})}};
    const report = stackedProfile(rows,enriched,'classification');
    expect([...report.counts]).toEqual([['MA15+',2],['PG',1],['Unknown',1]]);expect([...report.counts.values()].reduce((a,b) => a+b)).toBe(rows.length);expect(report.headline).toBeCloseTo(200/3);
  });
});
describe('film economics',() => {
  it.each([0,-1,NaN,Infinity,null,undefined])('excludes invalid reported amount %s',value => expect(positiveMoney(value)).toBeNull());
  it('scatter requires both positive finite values, deduplicates films and retains canonical identity',() => {
    const report = filmEconomics(rows,data);
    expect(report.unique).toBe(3);expect(report.points).toHaveLength(2);expect(report.points[0]).toMatchObject({movie:film,budget:10,revenue:30,hosts:['m1']});
    expect(report.points.every(p => Number.isFinite(Math.log10(p.budget)) && Number.isFinite(Math.log10(p.revenue)))).toBe(true);
    for (const key of ['budget','revenue'] as const) {
      expect(filmEconomics(rows,{movies:{a:movie({metadata:{original_language:null,budget:10,revenue:30,[key]:0}})}}).points).toEqual([]);
    }
  });
  it('medians weight appearances with odd/even data and independent budget/revenue coverage',() => {
    const report = filmEconomics(rows,data);
    expect(report.budget).toEqual({median:10,covered:3});expect(report.revenue).toEqual({median:30,covered:3});
    expect(filmEconomics([rows[0],rows[2]],data).budget.median).toBe(55);
    expect(filmEconomics(rows,{movies:{a:movie({metadata:{original_language:null,budget:10,revenue:0}})}})).toMatchObject({budget:{median:10,covered:2},revenue:{median:null,covered:0},points:[]});
  });
  it('ALL point hosts include each actual identity; filtered point hosts reflect that scope only',() => {
    const appearances = [...rows,{...rows[0],session:metricsEvent('clsc',[film],null)}];
    expect(filmEconomics(appearances,data).points[0].hosts).toEqual(['CLSC','m1']);expect(filmEconomics(appearances.filter(r => r.session.kind === 'classics'),data).points[0].hosts).toEqual(['CLSC']);
  });
});
describe('ties and recurring creators',() => {
  it.each(['highest','lowest','oldest','longest'] as const)('returns all tied films for %s in stable order, not repeated appearances',key => {
    const report = filmExtremes(rows.slice(0,3))[key];expect(report?.items.map(r => r.movie.id)).toEqual(['a','b']);expect(filmExtremes([...rows.slice(0,3)].reverse())[key]).toEqual(report);
  });
  it('unique extremes and finite-value missing states work',() => {
    const appearances = [{...rows[0],imdb:9},rows[2]];expect(filmExtremes(appearances).highest?.items.map(r => r.movie.id)).toEqual(['a']);
    expect(tiedExtreme([null,NaN,Infinity],v => v)).toBeNull();expect(tiedExtreme([2,2,1],v => v,'min')).toEqual({value:1,items:[1]});
  });
  it.each(talentRoles.filter(r => r !== 'Cast'))('requires recurring %s count >=2',role => {
    const enriched = metricsEnrichmentFixture();expect(recurringTalent([rows[0]],enriched,role).extreme).toBeNull();expect(recurringTalent(rows.slice(0,2),enriched,role).extreme?.value).toBe(2);
  });
  it('two tied directors and three tied Writers remain visible; writer/screenplay is deduped',() => {
    const directors = [rows[0],rows[0],{...rows[2],movie:{...other,director:'Other'}},{...rows[2],movie:{...other,director:'Other'}}];
    expect(recurringTalent(directors,data,'Director').extreme?.items).toHaveLength(2);
    const credits = [1,2,3].flatMap(id => ['writer','screenplay'].map(role => ({kind:'crew',role,person_id:String(id),name:`Writer ${id}`})));
    const report = recurringTalent(rows.slice(0,2),{movies:{a:movie({credits})}},'Writer');expect(report.extreme?.items).toHaveLength(3);expect(report.extreme?.value).toBe(2);
  });
});
describe('diversity and filters',() => {
  it.each([['countries',2,2,10],['languages',2,3,20/3],['themes',4,3,40/3],['directors',1,3,10/3],['cast',2,2,10]] as const)('%s normalises per ten qualifying appearances, retaining raw counts', (dimension,distinct,covered,perTen) => {
    const report = tasteDiversity(rows,data,dimension);expect(report).toMatchObject({distinct,covered,total:4});expect(report.perTen).toBeCloseTo(perTen);
  });
  it('recurring cast excludes singletons and raw variety normalises unequal sample sizes',() => {
    expect(tasteDiversity([rows[0]],data,'cast')).toMatchObject({distinct:0,perTen:0,covered:1});
    expect(tasteDiversity(rows.slice(0,2),data,'countries').perTen).toBe(10);expect(tasteDiversity([rows[0]],data,'countries').perTen).toBe(20);
  });
  it.each(['countries','languages','themes','directors','cast'] as const)('zero %s coverage has no false numeric score',dimension => expect(tasteDiversity([rows[3]],{movies:{}},dimension)).toEqual({distinct:0,covered:0,total:1,perTen:null}));
  it.each([{kind:'all'},...['m1','m2','m3','m4'].map(memberId => ({kind:'member',memberId})),{kind:'classics'}] as MetricsFilter[])('all new computations respect $kind $memberId and immutable ALL baseline',filter => {
    const catalog = metricsFixture(),all = selectedAppearances(catalog),enriched = metricsEnrichmentFixture(),selected = all.filter(r => matchesMetricsFilter(r.session,filter)),scopes = comparisonScopes(catalog,all,filter);
    expect(selected.length).toBe(filter.kind === 'all' ? 14 : filter.kind === 'classics' ? 2 : ({m1:3,m2:2,m3:6,m4:1})[filter.memberId]);
    if (filter.kind !== 'all') {expect(scopes[0].rows).toEqual(selected);expect(scopes[1]).toEqual({label:'CLUB',rows:all});}
    for (const dimension of ['countries','languages','themes','directors','cast','companies'] as const) {
      const report = fingerprint(selected,all,r => facts(r,enriched,dimension));
      expect(report.covered).toBeLessThanOrEqual(selected.length);
      for (const value of report.values) expect(value.ratio).toBeCloseTo((value.count/selected.length)/(all.filter(r => facts(r,enriched,dimension).some(f => f.id === value.id)).length/all.length));
    }
    for (const role of talentRoles) expect(recurringTalent(selected,enriched,role).covered).toBeLessThanOrEqual(selected.length);
    expect(stackedProfile(selected,enriched,'language').total).toBe(selected.length);expect(stackedProfile(selected,enriched,'classification').total).toBe(selected.length);
    expect(filmEconomics(selected,enriched).unique).toBe(new Set(selected.map(r => r.movie.id)).size);
  });
});
