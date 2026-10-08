import { describe,expect,it } from 'vitest';
import { themeDisplayLabel,isThemeKeyword,themeKeyIdentity } from '../shared/theme-keywords';
import { emptyEnrichmentMovie,facts,themes,themeFingerprint,themeKeywordAudit,tasteDiversity,type MetricsEnrichment } from '../shared/metrics-enrichment';
import { selectedAppearances } from '../shared/metrics';
import { metricsFilm,metricsEvent } from './metrics-fixture';

describe('derived theme identity and presentation preserve raw evidence',() => {
  it.each([
    ['rural area','Rural area'],['silent film','Silent film'],['rural Area','Rural Area'],['infanticide','Infanticide'],['jumping','Jumping'],['loser','Loser'],['path','Path'],['shaking','Shaking'],['escape-plan','Escape plan'],['hbo-max-original','HBO Max original'],['bmw','BMW'],
    ['hiding-in-the-basement','Hiding in the basement'],['  escape-plan  ','Escape plan'],
    ['Escape Plan','Escape Plan'],[' Hiding in the basement ','Hiding in the basement'],
    ['FBI investigation','FBI investigation'],['fbi-investigation','FBI investigation'],
    ['mercedes-benz-the-car','Mercedes-Benz the car'],['cia-agent','CIA agent'],
    ['ptsd-post-traumatic-stress-disorder','PTSD post traumatic stress disorder'],
  ])('%s becomes %s',(raw,label) => expect(themeDisplayLabel(raw)).toBe(label));
  it('keeps provider evidence and exact deduplication independent of display labels and near-synonyms',() => {
    const movie = {...emptyEnrichmentMovie(),keywords:[
      {provider:'tmdb',name:' escape-plan '},{provider:'mdblist',name:'ESCAPE-PLAN'},
      {provider:'mdblist',name:'Escape Plan'},{provider:'mdblist',name:'escape   plan'},{provider:'mdblist',name:' escape plan '},
      {provider:'tmdb',name:'escape'},{provider:'mdblist',name:'flight'},
    ]};
    const original = structuredClone(movie);
    expect(themes(movie).map(f => f.id)).toEqual(['escape','escape plan','flight']);
    expect(themes(movie).find(f => f.id === 'escape plan')?.label).toBe('escape-plan');
    expect(themeDisplayLabel(themes(movie).find(f => f.id === 'escape plan')!.label)).toBe('Escape plan');
    expect(themes({...movie,keywords:[...movie.keywords].reverse()})).toEqual(themes(movie));
    expect(movie).toEqual(original);
  });
});

describe('shared clean theme eligibility and frequency signatures',() => {
  it.each(['4k-blu-ray','dolby-vision',' Dolby Vision ','has-trailer','hbo-max-original','bmw','certified-fresh','oscar-winner'])('excludes observed non-theme %s',raw => expect(isThemeKeyword(raw)).toBe(false));
  it.each(['PTSD','FBI investigation','alcoholism','grief','revenge','apple','peacock','stream','unknown-platform-original','has-been','trailer-park'])('retains genuine or ambiguous %s',raw => expect(isThemeKeyword(raw)).toBe(true));
  const a = metricsFilm('a'),b = metricsFilm('b');
  const rows = selectedAppearances({movies:[a,b],members:[],cycles:[],sessions:[metricsEvent('repeat',[a,a,b])]});
  const keywords = [{provider:'tmdb',name:'escape-plan'},{provider:'mdblist',name:' ESCAPE-PLAN '},{provider:'mdblist',name:'bmw'},{provider:'tmdb',name:'grief'}];
  const data:MetricsEnrichment = {movies:{a:{...emptyEnrichmentMovie(),keywords},b:{...emptyEnrichmentMovie(),keywords}}};
  it('counts single appearances, repeats and provider duplicates once',() => {
    expect(themeFingerprint(rows,rows.slice(0,2),data).values).toHaveLength(2);
    expect(themeFingerprint(rows.slice(0,1),rows,data).values).toEqual(expect.arrayContaining([expect.objectContaining({id:'escape plan',count:1})]));
    const report = themeFingerprint([rows[0],rows[2]],rows,data);
    expect(report.values.map(v => v.id)).toEqual(['escape plan','grief']);
    expect(report.values.every(v => v.count === 2)).toBe(true);
    expect(themeFingerprint(rows,rows,data).values).toEqual(expect.arrayContaining([expect.objectContaining({id:'escape plan',label:'Escape plan',count:3,percentage:100})]));
  });
  it('uses the whole-club baseline across members and Classics',() => {
    const c = metricsFilm('c');
    const all = selectedAppearances({movies:[a,b,c],members:[],cycles:[],sessions:[metricsEvent('one',[a],'m1'),metricsEvent('two',[b],'m2'),metricsEvent('classic',[c],null)]});
    const enriched:MetricsEnrichment = {movies:{...data.movies,c:{...emptyEnrichmentMovie(),keywords}}};
    expect(themeFingerprint([all[0]],all.slice(0,2),enriched).values).toHaveLength(2);
    const report = themeFingerprint([all[0]],all,enriched);
    expect(report.values).toEqual(expect.arrayContaining([expect.objectContaining({id:'escape plan',count:1,percentage:100,ratio:1})]));
  });
  it('preserves raw evidence and counts cleaned diversity without the signature support gate',() => {
    const original = structuredClone(data);
    themeFingerprint(rows,rows,data);
    expect(facts(rows[0],data,'themes').map(f => f.id)).toContain('bmw');
    expect(tasteDiversity(rows,data,'themes').distinct).toBe(2);
    expect(tasteDiversity(rows.slice(0,1),data,'themes')).toMatchObject({distinct:2,covered:1,perTen:20});
    expect(themeFingerprint(rows.slice(0,1),rows,data).values).toHaveLength(2);
    expect(data).toEqual(original);
  });
  it('reports raw/normalised counts, included/excluded film counts and eligible fingerprints',() => {
    expect(themeKeywordAudit(data,rows)).toMatchObject({rawLabels:4,normalisedIdentities:3,excludedIdentities:1,includedIdentities:2,
      topExcluded:[{label:'bmw',films:2}],fingerprint:[{label:'Escape plan',count:3},{label:'Grief',count:3}]});
  });
});

describe('conservative theme identity',() => {
  it.each(['escape-plan','Escape Plan','escape   plan','ESCAPE-PLAN',' escape--  plan '])('normalises %s',raw => expect(themeKeyIdentity(raw)).toBe('escape plan'));
  it('preserves punctuation and near-synonyms',() => {
    expect(new Set(['murder','serial killer','escape','escape plan','escape.plan'].map(themeKeyIdentity)).size).toBe(5);
    expect(themeKeyIdentity('hbo-max-original')).toBe(themeKeyIdentity('HBO Max Original'));
  });
  it.each(['BMW','hbo-max-original','HBO   Max Original','dolby-vision','4k-blu-ray','oscar-winner'])('does not let %s inflate diversity or coverage',name => {
    const a=metricsFilm('a'),b=metricsFilm('b');
    const rows=selectedAppearances({movies:[a,b],members:[],cycles:[],sessions:[metricsEvent('clean',[a,b])]});
    const data:MetricsEnrichment={movies:{a:{...emptyEnrichmentMovie(),keywords:[{provider:'tmdb',name:'escape-plan'},{provider:'mdblist',name:'Escape Plan'},{provider:'mdblist',name:'escape   plan'},{provider:'tmdb',name:'grief'},{provider:'mdblist',name}]},b:{...emptyEnrichmentMovie(),keywords:[{provider:'mdblist',name:'ESCAPE-PLAN'},{provider:'mdblist',name}]}}};
    const original=structuredClone(data);
    expect(tasteDiversity(rows,data,'themes')).toEqual({distinct:2,covered:2,total:2,perTen:10});
    expect(themeFingerprint(rows,rows,data).values).toHaveLength(2);
    const cruftOnly:MetricsEnrichment={movies:{a:{...emptyEnrichmentMovie(),keywords:[{provider:'mdblist',name}]}}};
    expect(tasteDiversity(rows.slice(0,1),cruftOnly,'themes')).toEqual({distinct:0,covered:0,total:1,perTen:null});
    expect(data).toEqual(original);
  });
  it('uses deterministic provider then lexical preference without TMDB evidence',() => {
    const movie={...emptyEnrichmentMovie(),keywords:[{provider:'other',name:'Escape Plan'},{provider:'mdblist',name:'escape-plan'},{provider:'mdblist',name:'escape plan'}]};
    expect(themes(movie)).toEqual([{id:'escape plan',label:'escape plan'}]);
    expect(themes({...movie,keywords:[...movie.keywords].reverse()})).toEqual(themes(movie));
  });
});


it('ranks frequencies before ratios, keeps below-club and one-off terms, and cuts alphabetical ties at twelve',()=>{
  const films=Array.from({length:6},(_,i)=>metricsFilm(`frequency-${i}`));
  const all=selectedAppearances({movies:films,members:[],cycles:[],sessions:[metricsEvent('selected',films.slice(0,3),'m1'),metricsEvent('others',films.slice(3),'m2')]});
  const common=Array.from({length:13},(_,i)=>`common ${String(i).padStart(2,'0')}`);
  const data:MetricsEnrichment={movies:Object.fromEntries(films.map((film,i)=>[film.id,{...emptyEnrichmentMovie(),keywords:[
    ...((i !== 2)?common:[]).map(name=>({provider:'tmdb',name})),
    ...((i !== 2)?common:[]).map(name=>({provider:'mdblist',name:name.toUpperCase()})),
    ...(i===0?[{provider:'tmdb',name:'unique theme'}]:[]),
  ]}]))};
  const report=themeFingerprint(all.slice(0,3),all,data);
  expect(report.values.map(v=>v.label)).toEqual(common.slice(0,12).map(name=>name.replace('common','Common')));
  expect(report.values.every(v=>v.count===2 && v.ratio!<1)).toBe(true);
  expect(themeFingerprint([all[0]],all,data).values).toHaveLength(12);
  expect(themeFingerprint([all[0]],all,{movies:{[films[0].id]:{...emptyEnrichmentMovie(),keywords:[{provider:'tmdb',name:'one off'}]}}}).values).toEqual([expect.objectContaining({count:1,label:'One off'})]);
  expect(themeFingerprint([...all.slice(0,3)].reverse(),[...all].reverse(),data)).toEqual(report);
  expect(themeFingerprint(all,all,{movies:{}}).values).toEqual([]);
});
