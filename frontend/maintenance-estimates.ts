import type { Movie } from '../shared/types';
import { enrichmentIdentity } from '../shared/enrichment';
import { MAINTENANCE_BATCH_SIZE, METADATA_MAINTENANCE_BATCH_SIZE } from '../shared/score-maintenance';
import { missingLiveScoreDimensions } from '../shared/ranking';
export type Operation = 'missing' | 'refresh' | 'metadata' | 'tmdb-metadata' | 'tmdb' | 'mdblist';
export interface CallEstimate {eligible:number;batches:number;calls:{provider:string;min:number;max:number}[]}
/** Queue order and identity groups match the serial browser batches. Assumes configured providers and no cooldown. */
export function estimateMaintenance(operation: Operation, movies: Movie[]): CallEstimate {
  const size=operation==='tmdb' || operation==='tmdb-metadata' ? METADATA_MAINTENANCE_BATCH_SIZE : MAINTENANCE_BATCH_SIZE;
  let grouped=0;
  for (let offset=0;offset<movies.length;offset+=size) grouped+=new Set(movies.slice(offset,offset+size).map(movie=>enrichmentIdentity(movie.external_ids,'mdblist')?.provider).filter(Boolean)).size;
  const n=movies.length;
  if (operation==='tmdb' || operation==='tmdb-metadata') return {eligible:n,batches:Math.ceil(n/size),calls:[{provider:'TMDB',min:n,max:n}]};
  if (operation==='metadata') return {eligible:n,batches:Math.ceil(n/size),calls:[{provider:'OMDb',min:n,max:2*n}]};
  if (operation==='mdblist') return {eligible:n,batches:Math.ceil(n/size),calls:[{provider:'MDBList',min:grouped,max:grouped}]};
  const required=(movie:Movie)=>operation==='refresh' ? ['imdb:rating','rottentomatoes:critic','metacritic:critic','tmdb:rating'] : missingLiveScoreDimensions(movie.scores ?? []);
  const omdb=movies.filter(movie=>movie.external_ids.some(id=>id.provider==='imdb' && /^tt\d{7,10}$/.test(id.external_id)) && required(movie).some(key=>['imdb:rating','rottentomatoes:critic','metacritic:critic'].includes(key))).length;
  const tmdb=movies.filter(movie=>enrichmentIdentity(movie.external_ids,'tmdb') && required(movie).includes('tmdb:rating')).length;
  return {eligible:n,batches:Math.ceil(n/size),calls:[{provider:'MDBList',min:grouped,max:grouped+n},{provider:'OMDb',min:0,max:omdb*2},{provider:'TMDB',min:0,max:tmdb}]};
}
