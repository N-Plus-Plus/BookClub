import { describe, expect, it } from 'vitest';
import { calculateMetrics } from '../shared/metrics';
import { movieGenres, normalizeGenre, normalizedGenres } from '../shared/genres';
import type { Catalog, Movie, Session } from '../shared/types';
const film = (id: string,imdb: number | null,genres: string[] = []): Movie => ({id,title:id,year:2000,original_title:null,release_date:null,runtime:null,overview:null,genres,assets:[],external_ids:[],seen:[],classic:false,ranking:null,
  scores:imdb===null?[]:[{provider:'imdb',metric:'rating',raw_value:imdb,raw_scale:10,normalized_value:null,vote_count:null,fetched_at:'2000-01-01',retrieved_via:'mdblist'}]});
const a=film('a',9,['Drama','Science Fiction','sci-fi']),b=film('b',6,['Drama']),c=film('c',null);
const event = (id: string,movies: Movie[],host: string | null,slot: number,kind: Session['kind']='hosted'): Session => ({id,movies,host_member_id:host,cycle_slot:slot,kind,event_date:'2000-01-01',legacy_cycle_label:null,cycle_id:'cycle',date_precision:'exact'});
const catalog: Catalog = {members:[],movies:[a,b,c],cycles:[],sessions:[event('s1',[a,b],'m2',1),event('s2',[a,c],null,5,'classics'),{...event('deleted',[b],'m1',1),deleted_at:'2000-01-02'}]};
describe('appearance Metrics',()=>{
  it('ALL includes hosted and Classics; repeated films count, unique IDs deduplicate, deleted and Builder stay absent',()=>{
    const result=calculateMetrics({...catalog,builders:[{movie_ids:['b']}]} as Catalog);
    expect(result).toMatchObject({events:2,appearances:4,uniqueFilms:3,imdbAverage:8,imdbScored:3,genreCovered:3,uncategorised:1});
    expect(result.top.map(a=>a.movie.id)).toEqual(['a','a','b']);
  });
  it('member filters use actual host, including swaps; CLSC is Classics only',()=>{
    expect(calculateMetrics(catalog,{kind:'member',memberId:'m1'}).appearances).toBe(0);
    expect(calculateMetrics(catalog,{kind:'member',memberId:'m2'})).toMatchObject({events:1,appearances:2,imdbAverage:7.5});
    expect(calculateMetrics(catalog,{kind:'classics'})).toMatchObject({events:1,appearances:2,imdbScored:1,imdbAverage:9});
  });
  it('missing scores stay null; no scored appearances is an honest empty state',()=>{
    const result=calculateMetrics({...catalog,sessions:[event('empty',[c],'m1',1)]});
    expect(result.imdbAverage).toBeNull();expect(result.top).toEqual([]);expect(result.bottom).toEqual([]);expect(result.imdbScored).toBe(0);
  });
  it('uses existing effective retrieval precedence rather than newer arbitrary rows',()=>{
    const changed={...a,scores:[...a.scores,{...a.scores[0],raw_value:1,retrieved_via:'legacy-spreadsheet',fetched_at:'2099-01-01'}]};
    expect(calculateMetrics({...catalog,movies:[changed,b,c]}).imdbAverage).toBe(8);
  });
  it('top/bottom cap at five with deterministic date/title/session/movie/position ties independent of input order',()=>{
    const movies=[film('z',9),film('a',9),film('b',3)];
    const sessions=[event('z',[movies[0]],'m1',1),event('b',[movies[1],movies[1]],'m1',2),event('a',[movies[1]],'m1',3),{...event('old',[movies[0]],'m1',4),event_date:'1999-01-01'},event('low',[movies[2],movies[2]],'m1',1)];
    const result=calculateMetrics({...catalog,movies,sessions});
    expect(result.top.map(r=>`${r.session.id}:${r.position}`)).toEqual(['old:1','a:1','b:1','b:2','z:1']);
    expect(result.bottom.map(r=>r.session.id)).toEqual(['low','low','old','a','b']);
    expect(calculateMetrics({...catalog,movies,sessions:[...sessions].reverse()})).toEqual(result);
  });
  it('multi-genre counts once per applicable genre, shares use all appearances and Uncategorised remains visible',()=>{
    const result=calculateMetrics(catalog);
    expect(result.genres).toEqual([{genre:'Drama',appearances:3,percentage:75,imdbAverage:8,imdbScored:3},{genre:'Sci-Fi',appearances:2,percentage:50,imdbAverage:9,imdbScored:2},{genre:'Uncategorised',appearances:1,percentage:25,imdbAverage:null,imdbScored:0}]);
    expect(calculateMetrics(catalog,{kind:'classics'}).genres.find(g=>g.genre==='Sci-Fi')?.percentage).toBe(50);
  });
  it('finite canonical vocabulary normalises casing/punctuation, maps Sci-Fi explicitly and rejects unknown strings',()=>{
    expect(movieGenres).toHaveLength(19);expect(normalizeGenre(' SCIENCE-fiction ')).toBe('Sci-Fi');expect(normalizeGenre('t.v. MOVIE')).toBe('TV Movie');
    expect(normalizedGenres(['Drama','DRAMA','drama!','Made Up'])).toEqual(['Drama']);expect(normalizeGenre('Made Up')).toBeNull();
    expect(calculateMetrics({...catalog,movies:[{...c,genres:['Made Up']}],sessions:[event('unknown',[c],'m1',1)]}).uncategorised).toBe(1);
  });
});
