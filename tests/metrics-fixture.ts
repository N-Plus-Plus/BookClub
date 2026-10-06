import type { Catalog, Movie, Score, Session } from '../shared/types';

export const observation = (provider: string,metric: string,value: number,scale: number,votes: number | null = null): Score => ({provider,metric,raw_value:value,raw_scale:scale,normalized_value:null,vote_count:votes,fetched_at:'2026-01-01',retrieved_via:'mdblist'});
export const metricsFilm = (id: string,extra: Partial<Movie> = {}): Movie => ({id,title:`Film ${id}`,year:2001,original_title:null,release_date:null,runtime:100,overview:null,director:'Director A',genres:['Drama'],assets:[],external_ids:[],seen:[],classic:false,ranking:null,scores:[observation('imdb','rating',8,10,100)],...extra});
export const metricsEvent = (id: string,movies: Movie[],host: string | null = 'm1'): Session => ({id,movies,host_member_id:host,kind:host ? 'hosted' : 'classics',event_date:'2026-01-01',date_precision:'exact',cycle_id:null,cycle_slot:null,legacy_cycle_label:null});
export function metricsFixture(): Catalog {
  const movies = [
    metricsFilm('a',{title:'An extraordinarily long film title that keeps going beyond the ordinary bounds of a compact film row',year:1923,runtime:240,genres:['Horror','Drama','Horror'],director:'Director A and Director B, an exact shared credit',scores:[observation('imdb','rating',9,10,2000000),observation('letterboxd','rating',4.5,5),observation('metacritic','critic',81,100),observation('metacritic','user',8.2,10),observation('rogerebert','rating',3.5,4)]}),
    metricsFilm('b',{year:1999,genres:['Animation','Science Fiction'],director:'A director with an exceptionally long name that should wrap naturally without shrinking the text',scores:[observation('imdb','rating',3,10,12),observation('trakt','rating',77,100),observation('tmdb','rating',7,10)]}),
    metricsFilm('c',{year:null,runtime:null,director:null,genres:[],scores:[]}),
    metricsFilm('d',{year:2021,director:'Director A',scores:[observation('imdb','rating',7,10,50000),observation('rottentomatoes','critic',73,100),observation('rottentomatoes','audience',85,100)]}),
    ...Array.from({length:6},(_,i) => metricsFilm(`extra-${i}`,{year:1930+i*10,genres:['Crime','Thriller','Drama','Comedy','Fantasy','Adventure','Action'],scores:[observation('imdb','rating',5+i/10,10,1000+i)]})),
  ];
  return {movies,members:['Sean','Troy','Matt','Jess'].map((display_name,i) => ({id:`m${i+1}`,display_name,sort_order:i+1,active:1,avatar:i})),cycles:[],sessions:[
    metricsEvent('sean',[movies[0],movies[0],movies[2]]),metricsEvent('troy',[movies[1],movies[3]],'m2'),metricsEvent('matt',movies.slice(4),'m3'),metricsEvent('jess',[movies[1]],'m4'),metricsEvent('classics',[movies[3],movies[2]],null),{...metricsEvent('deleted',[movies[0]]),deleted_at:'2026-01-02'},
  ]};
}
