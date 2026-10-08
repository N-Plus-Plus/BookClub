import { expect, it } from 'vitest';
import { estimateMaintenance } from '../frontend/maintenance-estimates';
import type { Movie } from '../shared/types';
const movie=(id:number,provider='tmdb'):Movie=>({id:String(id),title:'Film',original_title:null,year:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],seen:[],classic:false,ranking:null,external_ids:[{provider,external_id:provider==='imdb' ? `tt${String(id).padStart(7,'0')}` : String(id)}],scores:[]} as Movie);
it('TMDB metadata/enrichment use one provider call per film and pairs of browser batches',()=>{
 for(const operation of ['tmdb','tmdb-metadata'] as const) expect(estimateMaintenance(operation,[movie(1),movie(2),movie(3)])).toEqual({eligible:3,batches:2,calls:[{provider:'TMDB',min:3,max:3}]});
});
it('MDBList calculates actual identity groups separately within frozen batches, preferring IMDb',()=>{
 const films=Array.from({length:11},(_,i)=>movie(i+1,i%2 ? 'imdb' : 'tmdb'));
 expect(estimateMaintenance('mdblist',films)).toEqual({eligible:11,batches:2,calls:[{provider:'MDBList',min:3,max:3}]});
 films[0].external_ids.push({provider:'imdb',external_id:'tt0000001'});
 expect(estimateMaintenance('mdblist',films.slice(0,2)).calls[0]).toMatchObject({min:1,max:1});
});
it('OMDb reports ordinary calls and bounded credential failover; empty queues report zero',()=>{
 expect(estimateMaintenance('metadata',[movie(1,'imdb'),movie(2,'imdb')]).calls).toEqual([{provider:'OMDb',min:2,max:4}]);
 for(const operation of ['missing','refresh','metadata','tmdb-metadata','tmdb','mdblist'] as const) expect(estimateMaintenance(operation,[])).toMatchObject({eligible:0,batches:0,calls:expect.arrayContaining([expect.objectContaining({min:0,max:0})])});
});
it('score estimates include scheduled groups, optional per-film recovery and only identity-applicable missing fallbacks',()=>{
 const films=[movie(1,'imdb'),movie(2)];
 expect(estimateMaintenance('missing',films).calls).toEqual([{provider:'MDBList',min:2,max:4},{provider:'OMDb',min:0,max:2},{provider:'TMDB',min:0,max:1}]);
 films[1].scores=[{provider:'tmdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:1,fetched_at:'2026-10-08',retrieved_via:'tmdb'}];
 expect(estimateMaintenance('missing',films).calls[2].max).toBe(0);
 expect(estimateMaintenance('refresh',films).calls[2].max).toBe(1);
});
