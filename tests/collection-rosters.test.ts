import { expect,it,vi,afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCollectionRoster } from '../shared/collection-roster';
import { collectionCompletion } from '../shared/metrics-staging/films';
import { selectedAppearances } from '../shared/metrics';
import { metricsFilm,metricsFixture,metricsEvent } from './metrics-fixture';
import { emptyEnrichmentMovie, type MetricsEnrichment } from '../shared/metrics-enrichment';
import { CollectionRosterRepository } from '../worker/src/collection-roster-repository';
import { CollectionRosterService } from '../worker/src/collection-roster-service';
import { Repository } from '../worker/src/repository';
import { MetricsRepository } from '../worker/src/metrics-repository';
import { parseCollection } from '../shared/provider-evidence';
import { disposableD1 } from './d1';
import { local,env,call,data,session } from './helpers/product-api';
import worker from '../worker/src/index';
import { reconcileRosterCheckpoint,rosterPlan,runRosterMaintenance, type RosterCheckpoint } from '../frontend/collection-roster-maintenance';
const at='2020-01-01T00:00:00.000Z';
const payload=(ids=[42,43])=>({id:7,name:'Fictional series',parts:ids.map(id=>({id,title:`Part ${id}`,release_date:id===44?'':`2000-01-01`}))});
afterEach(()=>vi.restoreAllMocks());
async function eligible(){
  expect((await session({movie_ids:['moon','arrival','moon']})).ok).toBe(true);
  local.sqlite.exec("DELETE FROM movie_external_ids WHERE movie_id IN ('moon','arrival') AND provider='tmdb'; INSERT INTO movie_external_ids VALUES('moon','tmdb','42'),('arrival','tmdb','43')");
  const repo=new Repository(local.db);
  await repo.cacheCollection('moon',parseCollection({id:7,name:'Fictional series'},'42',at));
  await repo.cacheCollection('arrival',parseCollection({id:7,name:'Fictional series'},'43',at));
  env.TMDB_READ_TOKEN='fictional';return new CollectionRosterService(env);
}
it('validates identities, complete nonempty parts, duplicates and undated announced films without requiring art',()=>{
  const valid=parseCollectionRoster({...payload([42,44,44]),parts:[...payload([42,44,44]).parts,{id:45}]},7,at)!;
  expect(valid.parts.map(p=>p.id)).toEqual([42,44,45]);expect(valid.parts[1].release_date).toBeNull();expect(valid.parts[2].title).toBeNull();
  for(const value of [null,{...payload(),id:8},{...payload(),name:''},{...payload(),parts:[]},{...payload(),parts:undefined},{...payload(),parts:[{id:0}]},{...payload(),parts:[{id:42},{id:'43'}]},{...payload(),parts:[{id:42,media_type:'tv'}]}])expect(parseCollectionRoster(value,7,at)).toBeNull();
});
it('counts canonical History across contributors and repeats, requires two films, and checks every part including upcoming films',()=>{
  const a=metricsFilm('a',{external_ids:[{provider:'tmdb',external_id:'42'}]}),b=metricsFilm('b',{external_ids:[{provider:'tmdb',external_id:'43'}]}),c=metricsFilm('c',{external_ids:[{provider:'tmdb',external_id:'44'}]});
  const catalog={...metricsFixture(),movies:[a,b,c],sessions:[metricsEvent('a',[a,a]),metricsEvent('b',[b],'m2'),{...metricsEvent('deleted',[c]),deleted_at:'2026-01-01'}]};
  const evidence:MetricsEnrichment={movies:Object.fromEntries([a,b,c].map((m,i)=>[m.id,{...emptyEnrichmentMovie(),collection:{status:'checked_present' as const,external_id:String(42+i),checked_at:at,collection_id:7,collection_name:'Fictional series'}}])),collections:{7:{status:'checked',roster:parseCollectionRoster(payload(),7,at),attempted_at:at}}};
  let report=collectionCompletion(selectedAppearances(catalog),evidence);expect(report.completed[0].films).toHaveLength(2);expect(report.completed[0].total).toBe(2);
  evidence.collections![7].roster=parseCollectionRoster(payload([42,43,44]),7,at);report=collectionCompletion(selectedAppearances(catalog),evidence);expect(report.completed).toHaveLength(0);expect(report.unrequited[0].missing.map(p=>p.id)).toEqual([44]);
  catalog.sessions.push(metricsEvent('upcoming',[c],null));expect(collectionCompletion(selectedAppearances(catalog),evidence).completed[0].total).toBe(3);
  evidence.collections![7].roster=parseCollectionRoster(payload([42,43]),7,at);expect(collectionCompletion(selectedAppearances(catalog),evidence).completed).toHaveLength(0); // known membership omitted: inconclusive
  catalog.sessions=[metricsEvent('repeat',[a,a,a])];expect(collectionCompletion(selectedAppearances(catalog),evidence)).toEqual({completed:[],unrequited:[],pending:0});
});
it('never classifies unchecked, corrupt, failed or incomplete roster evidence',()=>{
  const catalog=metricsFixture();catalog.movies.slice(0,2).forEach((m,i)=>m.external_ids=[{provider:'tmdb',external_id:String(42+i)}]);
  const evidence:MetricsEnrichment={movies:Object.fromEntries(catalog.movies.slice(0,2).map(m=>[m.id,{...emptyEnrichmentMovie(),collection:{status:'checked_present' as const,external_id:m.external_ids[0].external_id,checked_at:at,collection_id:7,collection_name:'Series'}}]))};
  for(const state of ['not_checked','inconclusive','failed','checked'] as const){evidence.collections={7:{status:state,roster:state==='checked'?{id:7,name:'Series',parts:[],checked_at:at}:null,attempted_at:at}};expect(collectionCompletion(selectedAppearances(catalog),evidence)).toMatchObject({completed:[],unrequited:[],pending:1});}
});
it('populates once per eligible collection and skips valid checks, with accurate Refresh estimates and atomic replacement',async()=>{
  const service=await eligible(),fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(payload()));
  expect(rosterPlan(await service.status(),'populate')).toMatchObject({collections:1,requests:1,batches:1});
  expect(await service.execute('populate',[7,7],at)).toMatchObject({requests:1,results:[{id:7,status:'checked'}]});expect(fetch).toHaveBeenCalledTimes(1);
  expect(await service.execute('populate',[7],at)).toMatchObject({requests:0,results:[{status:'skipped'}]});
  const start='2099-01-01T00:00:00.000Z';fetch.mockResolvedValue(Response.json(payload([42,43,44])));
  expect(await service.execute('refresh',[7],start)).toMatchObject({requests:1});
  let projection=await new MetricsRepository(local.db).enrichment();expect(projection.collections?.[7].roster?.parts).toHaveLength(3);
  expect(collectionCompletion(selectedAppearances(await new Repository(local.db).catalog()),projection).unrequited).toHaveLength(1);
  fetch.mockResolvedValue(Response.json(payload()));await service.execute('refresh',[7],start);
  projection=await new MetricsRepository(local.db).enrichment();expect(projection.collections?.[7].roster?.parts).toHaveLength(2);expect(collectionCompletion(selectedAppearances(await new Repository(local.db).catalog()),projection).completed).toHaveLength(1);
  expect(fetch.mock.calls.every(([url])=>String(url).endsWith('/collection/7'))).toBe(true);
});
it('preserves checked evidence on malformed/incomplete/failure responses and honours cooldown, quota and explicit retries',async()=>{
  const service=await eligible(),store=new CollectionRosterRepository(local.db);await store.save(parseCollectionRoster(payload(),7,at)!);
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({...payload(),parts:[]}));
  expect(await service.execute('refresh',[7],'2099-01-01T00:00:00.000Z')).toMatchObject({requests:1,results:[{status:'failed'}]});expect((await store.read())[7].roster?.checked_at).toBe(at);
  fetch.mockResolvedValue(Response.json(payload([42])));expect((await service.execute('refresh',[7],'2099-01-01T00:00:00.000Z')).results[0].status).toBe('failed');
  fetch.mockResolvedValue(new Response('',{status:429,headers:{'Retry-After':'3600'}}));expect(await service.execute('refresh',[7],'2099-01-01T00:00:00.000Z')).toMatchObject({requests:1,stopped:expect.any(String)});
  fetch.mockClear();expect(await service.execute('refresh',[7],'2099-01-01T00:00:00.000Z')).toMatchObject({requests:0});expect(fetch).not.toHaveBeenCalled();
  local.sqlite.exec('DELETE FROM provider_cooldowns');fetch.mockResolvedValue(Response.json(payload(),{headers:{'X-RateLimit-Remaining':'0'}}));expect(await service.execute('refresh',[7],'2099-01-01T00:00:00.000Z')).toMatchObject({requests:1,cacheChanged:true,stopped:expect.any(String)});
});
it('authenticates Metrics and collection maintenance, bounds strict batches, and keeps projection/status entirely read-only',async()=>{
  await eligible();const fetch=vi.spyOn(globalThis,'fetch');
  const before=local.sqlite.prepare('SELECT total_changes() AS n').get();
  expect((await data<MetricsEnrichment>(await call('/metrics/enrichment'))).collections?.[7].status).toBe('not_checked');
  expect((await call('/collections/maintenance')).status).toBe(403);expect((await call('/collections/maintenance','GET',undefined,2)).status).toBe(200);
  expect(local.sqlite.prepare('SELECT total_changes() AS n').get()).toEqual(before);expect(fetch).not.toHaveBeenCalled();
  expect((await worker.fetch(new Request('http://api/api/v1/metrics/enrichment'),env)).status).toBe(401);
  for(const ids of [[7,7],[7,8,9],[0],['7']])expect((await call('/collections/maintenance','POST',{intent:'refresh',ids,startedAt:at},2)).status).toBe(422);
  expect((await call('/collections/maintenance','POST',{intent:'refresh',ids:[7],startedAt:at})).status).toBe(403);expect(fetch).not.toHaveBeenCalled();
});
it('adds the schema without changing existing data, and tolerates older schema on Metrics but gates maintenance',async()=>{
  const old=disposableD1('0021');try{old.sqlite.exec(readFileSync('worker/seed.sql','utf8'));const before=await new Repository(old.db).catalog();expect((await new MetricsRepository(old.db).enrichment()).collections).toBeUndefined();await expect(new CollectionRosterService({...env,DB:old.db}).status()).rejects.toMatchObject({code:'SCHEMA_UPGRADE_REQUIRED'});
    old.sqlite.exec(readFileSync('worker/migrations/0022_collection_rosters.sql','utf8'));expect(await new Repository(old.db).catalog()).toEqual(before);
    expect(()=>old.sqlite.exec("INSERT INTO tmdb_collection_rosters VALUES(7,'Series','2026',NULL,'2026','checked')")).toThrow();
  }finally{old.sqlite.close();}
});
it('freezes the collection queue, retains failures, stops safely and reconciles lost-response checks without replay',async()=>{
  const checkpoint:RosterCheckpoint={version:1,intent:'refresh',startedAt:at,pending:[7,8,9],completed:0,requests:0};let saved=checkpoint,stop=false;
  const batch=vi.fn(async(id:number)=>{if(id===8)stop=true;return {results:[{id,status:id===8?'failed' as const:'checked' as const,message:''}],requests:1,cacheChanged:id===7};});
  await expect(runRosterMaintenance({checkpoint,batch,stopped:()=>stop,changed:()=>{},progress:()=>{},checkpointChanged:value=>{saved=value;},pause:async()=>{}})).rejects.toThrow('failed');
  expect(batch.mock.calls.map(([id])=>id)).toEqual([7,8]);expect(saved).toMatchObject({pending:[8,9],completed:1,requests:2});
  const status={collections:[{id:8,name:'Eight',films:2,checked_at:null},{id:9,name:'Nine',films:2,checked_at:'2026-01-01T00:00:00.000Z'},{id:10,name:'Ten',films:2,checked_at:null}],unavailable:null};
  expect(reconcileRosterCheckpoint(saved,status)).toMatchObject({pending:[8],completed:2});
  const lost=vi.fn(async()=>{throw new Error('Lost response');});
  await expect(runRosterMaintenance({checkpoint,batch:lost,stopped:()=>false,changed:()=>{},progress:()=>{},checkpointChanged:value=>{saved=value;}})).rejects.toThrow('Lost response');expect(saved.pending).toEqual([7,8,9]);
});

it('partitions collections by date-only eligibility, preserving unknown dates and future History evidence',()=>{
 const a=metricsFilm('a',{external_ids:[{provider:'tmdb',external_id:'42'}]}),b=metricsFilm('b',{external_ids:[{provider:'tmdb',external_id:'43'}]}),c=metricsFilm('c',{external_ids:[{provider:'tmdb',external_id:'44'}]});
 const catalog={...metricsFixture(),movies:[a,b,c],sessions:[metricsEvent('first',[a,a,b]),metricsEvent('repeat',[b])]};
 const evidence:MetricsEnrichment={movies:Object.fromEntries([a,b,c].map((m,i)=>[m.id,{...emptyEnrichmentMovie(),collection:{status:'checked_present' as const,external_id:String(42+i),checked_at:at,collection_id:7,collection_name:'Series'}}])),collections:{7:{status:'checked',attempted_at:at,roster:parseCollectionRoster({...payload(),parts:[...payload().parts,{id:44,title:'Sequel',release_date:'2026-10-11'}]},7,at)}}};
 const derive=(date:string)=>collectionCompletion(selectedAppearances(catalog),evidence,date);
 expect(derive('2026-10-10')).toMatchObject({completed:[{total:2,missing:[]}],unrequited:[],pending:0});expect(derive('2026-10-10').completed[0].films).toHaveLength(2);
 for(const date of ['2026-10-11','2026-10-12'])expect(derive(date)).toMatchObject({completed:[],unrequited:[{total:3,missing:[{id:44}]}]});
 catalog.sessions.push(metricsEvent('future evidence',[c]));expect(derive('2026-10-10').completed[0].total).toBe(3);catalog.sessions.pop();
 evidence.collections![7].roster!.parts.push({id:45,title:'Past',release_date:'2000-01-01'},{id:46,title:'Undated',release_date:null},{id:47,title:'Invalid',release_date:'2026-02-30'});
 expect(derive('2026-10-10').unrequited[0]).toMatchObject({total:5,missing:expect.arrayContaining([{id:45,title:'Past',release_date:'2000-01-01'},{id:46,title:'Undated',release_date:null},{id:47,title:'Invalid',release_date:null}])});
 evidence.collections![7].roster=null;expect(derive('2026-10-10')).toEqual({completed:[],unrequited:[],pending:1});
});
