import { it,expect,vi,afterEach } from 'vitest';
import { maintainScores } from '../frontend/score-maintenance';
import { maintainMetadata } from '../frontend/metadata-maintenance';
import { maintainEnrichment } from '../frontend/enrichment-maintenance';
import { maintainOmdbMetadata } from '../frontend/omdb-maintenance';
import { metricsFilm } from './metrics-fixture';
import type { MovieDetail } from '../shared/types';
afterEach(()=>vi.useRealTimers());
const ids=Array.from({length:12},(_,i)=>'f'+i);
const movie=(id:string)=>({...metricsFilm(id),appearances:[]}) as MovieDetail;
it.each(['scores','omdb'])('%s retains accepted progress on a subsequent network error and a new successful run clears interruption',async mode=>{
 vi.useFakeTimers();let calls=0;
 const batch=async(selected:string[])=>{if(++calls>1)throw Error('Synthetic network failure');return {results:selected.map(id=>({movie:movie(id),providers:[{provider:'omdb',status:'success' as const,count:1,message:'Saved'}]}))};};
 const options={ids,batch,stopped:()=>false,progress:async()=>{}};
 const running=mode==='omdb'?maintainOmdbMetadata({...options,checkpoint:{version:1,remainingIds:ids,completed:0},checkpointChanged:()=>{}}):maintainScores(options);
 await vi.runAllTimersAsync();const result=await running;expect(result.interrupted).toBe(true);expect(result.processed).toBe(10);expect(result.total).toBe(12);
 const success=await maintainScores({...options,ids:['f0'],batch:async()=>({results:[{movie:movie('f0'),providers:[{provider:'omdb',status:'success',count:1,message:'Saved'}]}]})});expect(success.interrupted).not.toBe(true);
});
it('nonblocking score observations and voluntary stops do not mark interruption',async()=>{
 let stopped=false;const result=await maintainScores({ids,batch:async selected=>({results:selected.map(id=>({movie:movie(id),providers:[{provider:'mdb',status:'failed',blocking:false,count:0,message:'Optional unavailable'}]}))}),stopped:()=>stopped,progress:async()=>{stopped=true;}});
 expect(result.failed).toBe(10);expect(result.processed).toBe(10);expect(result.interrupted).not.toBe(true);
});
it('incomplete OMDb responses are explicit interruptions with prior accepted work preserved',async()=>{
 const result=await maintainOmdbMetadata({checkpoint:{version:1,completed:10,remainingIds:['f10','f11']},batch:async()=>({results:[]}),stopped:()=>false,progress:async()=>{},checkpointChanged:()=>{}});
 expect(result.interrupted).toBe(true);expect(result.processed).toBe(10);expect(result.total).toBe(12);
});
it.each(['network','incomplete','failed'])('TMDB metadata %s is interrupted without replacing its partial fraction',async mode=>{
 vi.useFakeTimers();let calls=0;const running=maintainMetadata({ids:['f0','f1','f2','f3'],unidentified:0,stopped:()=>false,progress:async()=>{},batch:async selected=>{
  if(++calls>1&&mode==='network')throw Error('Network');return {results:calls>1&&mode==='incomplete'?[]:selected.map(movieId=>({movieId,title:movieId,provider:'tmdb',status:calls>1?'failed' as const:'success' as const,message:'Synthetic'}))};
 }});await vi.runAllTimersAsync();const result=await running;expect(result.interrupted).toBe(true);expect(result.processed).toBe(mode==='failed'?4:2);expect(result.total).toBe(4);
});
it.each(['network','invalid','blocking','nonblocking','stop'])('enrichment %s has an explicit correct progress state',async mode=>{
 const result=await maintainEnrichment({provider:'tmdb',checkpoint:{version:1,completed:10,remainingIds:['f10','f11','f12']},stopped:()=>mode==='stop',checkpointChanged:()=>{},progress:()=>{},batch:async selected=>{
  if(mode==='network')throw Error('Network');return {canonicalChanged:false,results:mode==='invalid'?[]:selected.map(movieId=>({movieId,status:'failed',blocking:mode!=='nonblocking',message:'Synthetic'}))};
 }});expect(result.interrupted===true).toBe(!['nonblocking','stop'].includes(mode));expect(result.processed).toBeGreaterThanOrEqual(10);expect(result.total).toBe(13);
});
