import { describe,expect,it } from 'vitest';
import { themeDisplayLabel,isThemeKeyword } from '../shared/theme-keywords';
import { emptyEnrichmentMovie,facts,themes,themeFingerprint,themeKeywordAudit,tasteDiversity,type MetricsEnrichment } from '../shared/metrics-enrichment';
import { selectedAppearances } from '../shared/metrics';
import { metricsFilm,metricsEvent } from './metrics-fixture';

describe('theme presentation without changing raw identities',() => {
  it.each([
    ['escape-plan','Escape plan'],['hbo-max-original','HBO Max original'],['bmw','BMW'],
    ['hiding-in-the-basement','Hiding in the basement'],['  escape-plan  ','Escape plan'],
    ['Escape Plan','Escape Plan'],[' Hiding in the basement ','Hiding in the basement'],
    ['FBI investigation','FBI investigation'],['fbi-investigation','FBI investigation'],
    ['mercedes-benz-the-car','Mercedes-Benz the car'],['cia-agent','CIA agent'],
    ['ptsd-post-traumatic-stress-disorder','PTSD post traumatic stress disorder'],
  ])('%s becomes %s',(raw,label) => expect(themeDisplayLabel(raw)).toBe(label));
  it('keeps provider evidence and exact deduplication independent of display labels and near-synonyms',() => {
    const movie = {...emptyEnrichmentMovie(),keywords:[
      {provider:'tmdb',name:' escape-plan '},{provider:'mdblist',name:'ESCAPE-PLAN'},
      {provider:'tmdb',name:'Escape Plan'},{provider:'mdblist',name:' escape plan '},
      {provider:'tmdb',name:'escape'},{provider:'mdblist',name:'flight'},
    ]};
    const original = structuredClone(movie);
    expect(themes(movie).map(f => f.id)).toEqual(['escape','escape plan','escape-plan','flight']);
    for (const fact of themes(movie)) themeDisplayLabel(fact.label);
    expect(movie).toEqual(original);
  });
});

describe('Theme Fingerprint eligibility only',() => {
  it.each(['4k-blu-ray','dolby-vision',' Dolby Vision ','has-trailer','hbo-max-original','bmw','certified-fresh','oscar-winner'])('excludes observed non-theme %s',raw => expect(isThemeKeyword(raw)).toBe(false));
  it.each(['PTSD','FBI investigation','alcoholism','grief','revenge','apple','peacock','stream','unknown-platform-original','has-been','trailer-park'])('retains genuine or ambiguous %s',raw => expect(isThemeKeyword(raw)).toBe(true));
  const a = metricsFilm('a'),b = metricsFilm('b');
  const rows = selectedAppearances({movies:[a,b],members:[],cycles:[],sessions:[metricsEvent('repeat',[a,a,b])]});
  const keywords = [{provider:'tmdb',name:'escape-plan'},{provider:'mdblist',name:' ESCAPE-PLAN '},{provider:'mdblist',name:'bmw'},{provider:'tmdb',name:'grief'}];
  const data:MetricsEnrichment = {movies:{a:{...emptyEnrichmentMovie(),keywords},b:{...emptyEnrichmentMovie(),keywords}}};
  it('requires two distinct canonical films, then counts appearances including repeats and provider duplicates once',() => {
    expect(themeFingerprint(rows.slice(0,2),rows,data,{distinctive:true}).values).toEqual([]);
    const report = themeFingerprint([rows[0],rows[2]],rows,data,{distinctive:true});
    expect(report.values.map(v => v.id)).toEqual(['escape-plan','grief']);
    expect(report.values.every(v => v.count === 2)).toBe(true);
    expect(themeFingerprint(rows,rows,data).values).toEqual(expect.arrayContaining([expect.objectContaining({id:'escape-plan',label:'Escape plan',count:3,percentage:100})]));
  });
  it('preserves raw evidence, provider identity and unfiltered theme diversity',() => {
    const original = structuredClone(data);
    themeFingerprint(rows,rows,data);
    expect(facts(rows[0],data,'themes').map(f => f.id)).toContain('bmw');
    expect(tasteDiversity(rows,data,'themes').distinct).toBe(3);
    expect(data).toEqual(original);
  });
  it('reports raw/normalised counts, included/excluded film counts and eligible fingerprints',() => {
    expect(themeKeywordAudit(data,rows)).toMatchObject({rawLabels:4,normalisedIdentities:3,excludedIdentities:1,includedIdentities:2,
      topExcluded:[{label:'bmw',films:2}],fingerprint:[{label:'Escape plan',count:3},{label:'grief',count:3}]});
  });
});
