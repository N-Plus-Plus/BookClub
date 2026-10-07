import { describe,expect,it } from 'vitest';
import { contributorMetrics,decadeDistribution,directorFingerprint,extremesCabinet,genreColour,genreFingerprint,median,metricsDashboard,metricsScoreDimensions,popularityMetrics,ratingsProfile,selectedAppearances } from '../shared/metrics';
import { liveScoreDimensions,rankMovie,requiredScores } from '../shared/ranking';
import { metricsEvent,metricsFilm,metricsFixture,observation } from './metrics-fixture';
import type { Catalog, Movie } from '../shared/types';

const dataset = (movies: Movie[],lineup = movies): Catalog => ({movies,members:[],cycles:[],sessions:[metricsEvent('one',lineup)]});
const rowsOf = (movies: Movie[],lineup = movies) => selectedAppearances(dataset(movies,lineup));
describe('Metrics dashboard',() => {
  it('shares active canonical appearance selection across ALL, hosts and CLSC',() => {
    const catalog = metricsFixture();
    expect(selectedAppearances(catalog)).toHaveLength(14);
    expect(selectedAppearances(catalog,{kind:'member',memberId:'m1'}).map(r => r.movie.id)).toEqual(['a','a','c']);
    expect(selectedAppearances(catalog,{kind:'classics'}).map(r => r.movie.id)).toEqual(['d','c']);
    expect(selectedAppearances(catalog).some(r => r.session.id === 'deleted')).toBe(false);
    const stale = {...catalog,sessions:[metricsEvent('stale',[{...catalog.movies[0],genres:[],scores:[]}])]};
    expect(selectedAppearances(stale)[0].movie).toBe(catalog.movies[0]);
  });
  it('calculates multi-genre shares against ALL appearances, counts repeats and ranks distinctive genres',() => {
    const a = metricsFilm('a',{genres:['Horror','Drama','HORROR']}),b = metricsFilm('b');
    const all = rowsOf([a,b],[a,b,b,b]),selected = all.slice(0,1);
    expect(genreFingerprint(selected,all)).toEqual([
      {genre:'Horror',count:1,percentage:100,ratio:4,colour:genreColour('Horror')},
      {genre:'Drama',count:1,percentage:100,ratio:1,colour:genreColour('Drama')},
    ]);
    expect(genreFingerprint(all,all).find(g => g.genre === 'Drama')?.count).toBe(4);
  });
  it('caps filtered fingerprints at five with alphabetical ties and stable colours',() => {
    const catalog = metricsFixture(),rows = selectedAppearances(catalog,{kind:'member',memberId:'m3'}),all = selectedAppearances(catalog);
    const fingerprint = genreFingerprint(rows,all);
    expect(fingerprint).toHaveLength(5);
    expect(fingerprint.map(g => g.genre)).toEqual(['Action','Adventure','Comedy','Crime','Fantasy']);
    expect(genreFingerprint([...rows].reverse(),[...all].reverse())).toEqual(fingerprint);
    for (const g of fingerprint) expect(g.colour).toBe(genreFingerprint(rows,rows).find(other => other.genre === g.genre)?.colour ?? genreColour(g.genre));
  });
  it('ALL gives one signature per actual contributor and CLSC, including quiet missing data',() => {
    const catalog = metricsFixture(),contributions = contributorMetrics(catalog);
    expect(contributions.map(c => c.label)).toEqual(['SEAN','TROY','MATT','JESS','CLSC']);
    expect(contributions.map(c => c.count)).toEqual([3,2,6,1,2]);
    expect(contributions[0].signature?.genre).toBe('Horror');
    expect(contributorMetrics({...catalog,sessions:[]}).every(c => c.signature === null)).toBe(true);
    expect(genreFingerprint(rowsOf([metricsFilm('a',{genres:['invalid']})]),[])).toEqual([]);
  });
  it('groups decades chronologically, preserves Unknown and uses all repeat appearances as denominator',() => {
    const a = metricsFilm('a',{year:1929}),b = metricsFilm('b',{year:1930}),c = metricsFilm('c',{year:null}),d = metricsFilm('d',{year:2021});
    const rows = rowsOf([a,b,c,d],[a,a,b,c,d]);
    const decades = decadeDistribution(rows);
    expect(decades.map(({label,count,percentage}) => ({label,count,percentage}))).toEqual([
      {label:'1920s',count:2,percentage:40},{label:'1930s',count:1,percentage:20},{label:'2020s',count:1,percentage:20},{label:'Unknown',count:1,percentage:20},
    ]);
    expect(decadeDistribution([...rows].reverse())).toEqual(decades);
    expect(decadeDistribution([rows[0]])[0].colour).toBe(decades[0].colour);
  });
  it.each([[[],null],[[NaN,Infinity],null],[[3,1,2],2],[[4,1,3,2],2.5],[[1,NaN,3],2]] as [number[],number|null][])('median safely handles %j', (values,expected) => expect(median(values)).toBe(expected));
  it('ratings retain fixed axes, genuine normalisation, repeat-weighted mean, median and coverage',() => {
    const a = metricsFilm('a',{scores:[observation('imdb','rating',9,10),observation('letterboxd','rating',4,5),observation('metacritic','user',8,10),observation('trakt','rating',73,100),observation('rogerebert','rating',3,4)]});
    const b = metricsFilm('b',{scores:[observation('imdb','rating',3,10),observation('letterboxd','rating',9.2,10)]}),c = metricsFilm('c',{scores:[],ranking:rankMovie(a.scores,[],[],0)});
    const profile = ratingsProfile(rowsOf([a,b,c],[a,a,b,c]));
    expect(profile.map(r => r.label)).toEqual(['IMDb','LB','MC','MC-U','RT-A','RT-C','TMDB','Trakt','Ebert']);
    expect(profile[0]).toMatchObject({mean:70,median:90,coverage:3});
    expect(profile[1].mean).toBeCloseTo(84);
    expect(profile[2]).toMatchObject({mean:null,median:null,coverage:0});
    expect(profile[3]).toMatchObject({mean:80,coverage:2});expect(profile[7].mean).toBe(73);expect(profile[8].mean).toBe(75);
    expect(ratingsProfile([]).map(r => [r.id,r.colour])).toEqual(profile.map(r => [r.id,r.colour]));
  });
  it('invalid scores are excluded and preferred genuine service controls votes as well as ratings',() => {
    const movie = metricsFilm('a',{scores:[observation('imdb','rating',8,10,10),{...observation('imdb','rating',10,10,999999),retrieved_via:'legacy-spreadsheet',fetched_at:'2099-01-01'},observation('letterboxd','rating',Infinity,5),observation('trakt','rating',101,100)]});
    const rows = rowsOf([movie]);
    expect(ratingsProfile(rows)[0].mean).toBe(80);expect(ratingsProfile(rows)[1].coverage).toBe(0);expect(ratingsProfile(rows)[7].coverage).toBe(0);
    expect(popularityMetrics(rows).popular[0].votes).toBe(10);
  });
  it('informational observations never alter Watch Order or live dimensions',() => {
    const base = [observation('imdb','rating',8,10)],optional = [observation('metacritic','user',10,10),observation('trakt','rating',100,100),observation('rogerebert','rating',4,4)];
    expect(rankMovie([...base,...optional],[],[],42)).toEqual(rankMovie(base,[],[],42));
    expect(liveScoreDimensions([...base,...optional])).toEqual(['imdb:rating']);
    expect(requiredScores).toHaveLength(6);
  });
  it.each([null,undefined,0,-1,NaN,Infinity])('excludes invalid IMDb votes %s without borrowing other providers',votes => {
    const movie = metricsFilm('a',{scores:[{...observation('imdb','rating',8,10),vote_count:votes as number|null},observation('trakt','rating',80,100,999),observation('letterboxd','rating',4,5,10000)]});
    expect(popularityMetrics(rowsOf([movie]))).toMatchObject({coverage:0,median:null,popular:[],obscure:[]});
  });
  it('IMDb votes require a usable IMDb observation',() => {
    expect(popularityMetrics(rowsOf([metricsFilm('a',{scores:[observation('imdb','rating',11,10,100)]})])).coverage).toBe(0);
  });
  it('popularity statistics weight repeats but lists deduplicate, cap at five and tie deterministically',() => {
    const films = Array.from({length:7},(_,i) => metricsFilm(String(i),{scores:[observation('imdb','rating',8,10,i === 0 ? 10000 : i)]}));
    const rows = rowsOf(films,[films[0],films[0],...films.slice(1)]),report = popularityMetrics(rows);
    expect(report).toMatchObject({coverage:8,median:4.5});
    expect(report.popular.map(r => r.movie.id)).toEqual(['0','6','5','4','3']);
    expect(report.obscure.map(r => r.movie.id)).toEqual(['1','2','3','4','5']);
    expect(popularityMetrics([...rows].reverse())).toEqual(report);
    const ties = rowsOf([metricsFilm('z'),metricsFilm('a')]);
    expect(popularityMetrics(ties).popular.map(r => r.movie.id)).toEqual(['a','z']);
    expect(popularityMetrics(ties).obscure.map(r => r.movie.id)).toEqual(['a','z']);
  });
  it('directors group exact stored credits, never split strings, weight repeats and report coverage',() => {
    const films = [metricsFilm('a',{director:'A, B and C'}),metricsFilm('b',{director:'A'}),metricsFilm('c',{director:null}),metricsFilm('d',{director:'   '})];
    const report = directorFingerprint(rowsOf(films,[...films,films[0]]));
    expect(report).toMatchObject({covered:3,top:[{name:'A, B and C',count:2,percentage:40},{name:'A',count:1,percentage:20}]});
    const tied = Array.from({length:7},(_,i) => metricsFilm(String(i),{director:`Director ${i}`}));
    expect(directorFingerprint(rowsOf(tied.reverse())).top.map(d => d.name)).toEqual(['Director 0','Director 1','Director 2','Director 3','Director 4','Director 5','Director 6']);
  });
  it('extremes deduplicate canonical films and permit the same film to win several categories',() => {
    const a = metricsFilm('a',{year:1920,runtime:300,scores:[observation('imdb','rating',10,10)]}),b = metricsFilm('b',{year:2020,runtime:80,scores:[observation('imdb','rating',1,10)]});
    const rows = rowsOf([a,b],[a,a,b]),report = extremesCabinet(rows);
    expect(report.highest?.items.map(r => r.movie.id)).toEqual(['a']);expect(report.lowest?.items.map(r => r.movie.id)).toEqual(['b']);expect(report.oldest?.items.map(r => r.movie.id)).toEqual(['a']);expect(report.longest?.items.map(r => r.movie.id)).toEqual(['a']);
    expect(extremesCabinet([...rows].reverse())).toEqual(report);
    const ties = rowsOf([metricsFilm('z'),metricsFilm('a')]);
    expect(Object.values(extremesCabinet(ties)).map(r => r?.items.map(item => item.movie.id))).toEqual([['a','z'],['a','z'],undefined,undefined,['a','z'],['a','z'],['a','z'],['a','z']]);
  });
  it('missing extremes and empty dashboards stay safe',() => {
    const rows = rowsOf([metricsFilm('a',{scores:[],year:null,runtime:null,director:null,genres:[]})]);
    expect(extremesCabinet(rows)).toEqual({highest:null,lowest:null,topCritic:null,bottomCritic:null,topAudience:null,bottomAudience:null,oldest:null,longest:null});
    expect(extremesCabinet([])).toEqual(extremesCabinet(rows));
    expect(metricsDashboard([],[])).toMatchObject({fingerprint:[],decades:[],directors:{covered:0,top:[]},popularity:{coverage:0,median:null}});
    expect(metricsScoreDimensions).toHaveLength(9);
  });
});
