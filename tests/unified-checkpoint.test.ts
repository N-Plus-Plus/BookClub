import { afterEach, expect, it, vi } from 'vitest';
import { loadUnifiedCheckpoint, reconcileUnifiedCheckpoint, runUnifiedMaintenance, type UnifiedCheckpoint } from '../frontend/unified-maintenance';
import { planMaintenance, type MaintenanceBatchResult, type MaintenanceCoverage } from '../shared/maintenance-plan';
import type { Catalog } from '../shared/types';

const catalog:Catalog={members:[],sessions:[],cycles:[],movies:Array.from({length:12},(_,i)=>({id:`film-${i}`,title:'Film',original_title:null,release_date:null,year:null,runtime:null,overview:null,director:null,genres:[],assets:[],scores:[],seen:[],classic:true,ranking:null,external_ids:[{provider:'tmdb',external_id:String(i+1)}]}))};
const coverage:MaintenanceCoverage={checks:[],enrichment:[],negativeScores:[],unavailable:{mdblist:null,tmdb:null,omdb:null}};
const checkpoint=():UnifiedCheckpoint=>({version:1,intent:'refresh',operation:'all',startedAt:'2026-01-01T00:00:00.000Z',pending:planMaintenance(catalog,coverage,'refresh').units,completed:0});
afterEach(()=>vi.useRealTimers());
it('rejects corrupt/credential-bearing checkpoints and forwards only the bounded credential-free shape',()=>{
  const removeItem=vi.fn(),getItem=vi.fn(()=>JSON.stringify({...checkpoint(),apiKey:'forbidden'}));
  expect(loadUnifiedCheckpoint('test',{getItem,removeItem})).toBeNull();expect(removeItem).toHaveBeenCalledOnce();
  getItem.mockReturnValue(JSON.stringify({...checkpoint(),pending:[checkpoint().pending[0],checkpoint().pending[0]]}));expect(loadUnifiedCheckpoint('test',{getItem,removeItem})).toBeNull();
});
it('keeps new films out of a frozen checkpoint and removes deleted/unsupported identities',()=>{
  const saved=checkpoint(),changed={...catalog,movies:[...catalog.movies.slice(1),{...catalog.movies[0],id:'new'}]};
  const resumed=reconcileUnifiedCheckpoint(saved,changed,coverage);
  expect(resumed.pending.some(u=>['film-0','new'].includes(u.movieId))).toBe(false);expect(resumed.pending.length).toBe(saved.pending.length-2);
});
it('reconciles lost responses against successful durable checks without replaying refreshed stores',()=>{
  const saved=checkpoint(),movie=catalog.movies[0],id=movie.id;
  const resumed=reconcileUnifiedCheckpoint(saved,{...catalog,movies:catalog.movies.map(m=>m.id===id?{...m,tmdb_metadata_checked_at:'2026-02-01',tmdb_artwork_checked_at:'2026-02-01'}:m)}, {...coverage,evidence:[{movie_id:id,provider:'tmdb',domain:'collections',identity_provider:'tmdb',external_id:'1',checked_at:'2026-02-01',absent:['collections']}],enrichment:[{movie_id:id,provider:'tmdb',identity_provider:'tmdb',external_id:'1',checked_at:'2026-02-01'}],checks:[{movie_id:id,provider:'tmdb',domain:'scores',identity_provider:'tmdb',external_id:'1',checked_at:'2026-02-01',absent:[]}]});
  expect(resumed.pending.some(u=>u.movieId===id && u.provider==='tmdb')).toBe(false);
  expect(resumed.pending.some(u=>u.movieId===id && u.provider==='mdblist')).toBe(true);
});
it('Stop after an in-flight batch checkpoints accepted units and keeps normal progress',async()=>{
  let stopped=false,saved:UnifiedCheckpoint | null=null;
  const batch=vi.fn(async(units:UnifiedCheckpoint['pending']):Promise<MaintenanceBatchResult>=>{stopped=true;return {results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'updated',message:'Saved'})),canonicalChanged:false,cacheChanged:false,requests:1};});
  const run=await runUnifiedMaintenance({checkpoint:checkpoint(),batch,stopped:()=>stopped,progress:()=>{},committed:()=>{},checkpointChanged:value=>{saved=value;}});
  expect(batch).toHaveBeenCalledOnce();expect(run.interrupted).toBe(false);expect(run.requests).toBe(1);expect(run.processed).toBe(10);expect((saved as UnifiedCheckpoint | null)?.pending).toHaveLength(14);
});
it.each(['timeout','malformed'])('retains pending work on %s and never fabricates successful checks',async kind=>{
  const checkpointChanged=vi.fn();
  const batch=vi.fn(async():Promise<MaintenanceBatchResult>=>{if(kind==='timeout')throw new Error('Request timeout');return {results:[],canonicalChanged:false,cacheChanged:false};});
  const run=await runUnifiedMaintenance({checkpoint:checkpoint(),batch,stopped:()=>false,progress:()=>{},committed:()=>{},checkpointChanged});
  expect(run.interrupted).toBe(true);expect(run.processed).toBe(0);expect(checkpointChanged).not.toHaveBeenCalled();expect(batch).toHaveBeenCalledOnce();
});
it('partial batch success preserves only failed/unprocessed units for explicit resume',async()=>{
  let saved:UnifiedCheckpoint | null=null;
  const run=await runUnifiedMaintenance({checkpoint:checkpoint(),batch:async units=>({results:[{movieId:units[0].movieId,provider:units[0].provider,status:'updated',message:'Saved'},{movieId:units[1].movieId,provider:units[1].provider,status:'failed',message:'Rate limit',retryAfter:60}],stopped:true,canonicalChanged:false,cacheChanged:true}),stopped:()=>false,progress:()=>{},committed:()=>{},checkpointChanged:value=>{saved=value;}});
  expect(run).toMatchObject({processed:1,failed:1,remaining:23,interrupted:true});expect((saved as UnifiedCheckpoint | null)?.pending.some(u=>u.movieId===checkpoint().pending[0].movieId && u.provider==='mdblist')).toBe(false);
});
