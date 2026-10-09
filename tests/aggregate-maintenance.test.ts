import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runAggregateMaintenance, loadAggregateCheckpoint, saveAggregateCheckpoint, type AggregateCheckpoint, type AggregateProgress } from '../frontend/aggregate-maintenance';
import type { Catalog } from '../shared/types';
import type { MaintenanceCoverage, MaintenanceBatchResult, MaintenanceUnit } from '../shared/maintenance-plan';
import type { CollectionRosterStatus } from '../shared/collection-roster';

const startedAt='2026-01-01T00:00:00.000Z';
const catalog:Catalog={members:[],sessions:[],cycles:[],movies:[{id:'film',title:'Film',original_title:null,year:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],scores:[],seen:[],classic:false,ranking:null,external_ids:[{provider:'tmdb',external_id:'42'}]}]};
const coverage:MaintenanceCoverage={fields:[],checks:[],negativeScores:[],enrichment:[],unavailable:{tmdb:null,omdb:null,mdblist:null}};
const make=(intent:'populate'|'refresh'='populate',work=true):AggregateCheckpoint=>({version:2,intent,phase:'films',filmRequests:0,rosters:null,films:{version:1,intent,operation:'all',startedAt,completed:0,pending:work?[{movieId:'film',provider:'tmdb',identity:{provider:'tmdb',external_id:'42'},operations:['tmdb-collections']}]:[]}});
let status:CollectionRosterStatus,stored:AggregateCheckpoint | null,progress:AggregateProgress[];
beforeEach(()=>{vi.useFakeTimers();status={collections:[],unavailable:null};stored=null;progress=[];});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function options(checkpoint=make()){
  return {checkpoint,filmEvidence:vi.fn(async()=>({catalog,coverage})),collectionEvidence:vi.fn(async()=>structuredClone(status)),
    filmBatch:vi.fn(async(units:MaintenanceUnit[]):Promise<MaintenanceBatchResult>=>({results:units.map(u=>({movieId:u.movieId,provider:u.provider,status:'updated',message:'Saved'})),requests:1,canonicalChanged:false,cacheChanged:true})),
    collectionBatch:vi.fn(async(id:number)=>{status.collections=status.collections.map(c=>c.id===id?{...c,checked_at:new Date().toISOString()}:c);return {results:[{id,status:'checked' as const,message:'Saved'}],requests:1,cacheChanged:true};}),
    stopped:vi.fn(()=>false),checkpointChanged:(value:AggregateCheckpoint | null)=>{stored=value;},progress:(value:AggregateProgress)=>{progress.push(value);},committed:vi.fn(),collectionsChanged:vi.fn()};
}
const finish=async(o:ReturnType<typeof options>)=>{const promise=runAggregateMaintenance(o);await vi.runAllTimersAsync();return promise;};
it.each(['populate','refresh'] as const)('%s plans collection work after committed film membership changes',async intent=>{
  const o=options(make(intent));o.committed.mockImplementation(()=>{status.collections=[{id:7,name:'Newly discovered franchise',films:2,checked_at:intent==='refresh'?startedAt:null}];});
  await finish(o);expect(stored).toBeNull();expect(o.filmBatch).toHaveBeenCalledOnce();expect(o.collectionBatch).toHaveBeenCalledWith(7,expect.any(String));
  expect(o.collectionEvidence.mock.invocationCallOrder[0]).toBeGreaterThan(o.committed.mock.invocationCallOrder[0]);
  expect(progress.at(-1)?.checkpoint).toMatchObject({phase:'collections',filmRequests:1,rosters:{completed:1,requests:1,pending:[]}});
});
it('zero film work proceeds directly to collections; zero collections completes cleanly',async()=>{
  let o=options(make('populate',false));status.collections=[{id:7,name:'Series',films:2,checked_at:null}];await finish(o);expect(o.filmBatch).not.toHaveBeenCalled();expect(o.collectionBatch).toHaveBeenCalledOnce();expect(stored).toBeNull();
  o=options(make());status.collections=[];await finish(o);expect(o.filmBatch).toHaveBeenCalledOnce();expect(o.collectionBatch).not.toHaveBeenCalled();expect(stored).toBeNull();
});
it('unresolved nonblocking film failures never advance to collection planning',async()=>{
  const o=options();o.filmBatch.mockResolvedValue({results:[{movieId:'film',provider:'tmdb',status:'failed',message:'Retry',blocking:false}],requests:1,canonicalChanged:false,cacheChanged:false});
  await finish(o);expect(stored?.phase).toBe('films');expect(stored?.films.pending).toHaveLength(1);expect(o.collectionEvidence).not.toHaveBeenCalled();expect(progress.at(-1)?.interrupted).toBe(true);
  const resumed=options(stored!);await finish(resumed);expect(resumed.filmBatch).toHaveBeenCalledOnce();expect(resumed.collectionEvidence).toHaveBeenCalled();expect(stored).toBeNull();
});
it('Stop at the film boundary persists an unplanned collection phase and resumes without replay',async()=>{
  const o=options();let stopped=false;o.stopped.mockImplementation(()=>stopped);o.committed.mockImplementation(()=>{stopped=true;});
  await finish(o);expect(stored).toMatchObject({phase:'films',films:{pending:[],completed:1},rosters:null});expect(o.collectionEvidence).not.toHaveBeenCalled();
  const resumed=options(stored!);status.collections=[{id:7,name:'Series',films:2,checked_at:null}];await finish(resumed);expect(resumed.filmBatch).not.toHaveBeenCalled();expect(resumed.collectionBatch).toHaveBeenCalledOnce();expect(stored).toBeNull();
});
it('Stop in collections retains its frozen queue and ignores newly eligible collections on resume',async()=>{
  status.collections=[7,8].map(id=>({id,name:'Series',films:2,checked_at:null}));const o=options(make('refresh',false));let stopped=false;o.stopped.mockImplementation(()=>stopped);o.collectionsChanged.mockImplementation(()=>{stopped=true;});await finish(o);
  expect(stored).toMatchObject({phase:'collections',rosters:{pending:[8],completed:1,requests:1}});
  status.collections.push({id:9,name:'Later series',films:2,checked_at:null});const resumed=options(stored!);await finish(resumed);expect(resumed.filmBatch).not.toHaveBeenCalled();expect(resumed.collectionBatch.mock.calls.map(c=>c[0])).toEqual([8]);expect(stored).toBeNull();
});
it('a lost collection response reconciles durable success without duplicate requests',async()=>{
  status.collections=[{id:7,name:'Series',films:2,checked_at:null}];const o=options(make('refresh',false));o.collectionBatch.mockImplementation(async()=>{status.collections[0].checked_at=new Date().toISOString();throw new Error('Lost response');});await finish(o);
  expect(stored?.rosters?.pending).toEqual([7]);expect(progress.at(-1)?.interrupted).toBe(true);const resumed=options(stored!);await finish(resumed);expect(resumed.collectionBatch).not.toHaveBeenCalled();expect(stored).toBeNull();
});
it('lost film responses reconcile identity-bound success before advancing',async()=>{
  const o=options();o.filmBatch.mockRejectedValue(new Error('Lost film response'));await finish(o);expect(stored?.phase).toBe('films');
  const resumed=options(stored!);resumed.filmEvidence.mockResolvedValue({catalog,coverage:{...coverage,fields:[{movie_id:'film',provider:'tmdb',operation:'tmdb-collections',identity_provider:'tmdb',external_id:'42',fields:{collection_id:{state:'checked_unavailable',checked_at:startedAt},collection_name:{state:'checked_unavailable',checked_at:startedAt}}}]}});
  await finish(resumed);expect(resumed.filmBatch).not.toHaveBeenCalled();expect(stored).toBeNull();
});
it('cooldown preserves planned collection work and malformed evidence cannot complete it',async()=>{
  status={collections:[{id:7,name:'Series',films:2,checked_at:null}],unavailable:'TMDB cooling down'};const o=options(make('populate',false));await finish(o);expect(stored?.phase).toBe('collections');expect(stored?.rosters?.pending).toEqual([7]);expect(o.collectionBatch).not.toHaveBeenCalled();expect(progress.at(-1)?.message).toContain('cooling down');
  status.unavailable=null;const resumed=options(stored!);resumed.collectionBatch.mockResolvedValue({results:[],requests:1,cacheChanged:false});await finish(resumed);expect(stored?.rosters?.pending).toEqual([7]);expect(progress.at(-1)?.interrupted).toBe(true);
});
it('strict checkpoints retain an empty film queue at the phase boundary and reject corrupt or secret-bearing state',()=>{
  const data=new Map<string,string>();vi.stubGlobal('localStorage',{setItem:(k:string,v:string)=>data.set(k,v),getItem:(k:string)=>data.get(k) ?? null,removeItem:(k:string)=>data.delete(k)});
  const value=make('populate',false);saveAggregateCheckpoint(value,'populate');expect(loadAggregateCheckpoint('populate')).toEqual(value);
  data.set('bookclub.maintenance.populate.all.v2',JSON.stringify({...value,token:'forbidden'}));expect(loadAggregateCheckpoint('populate')).toBeNull();
});
