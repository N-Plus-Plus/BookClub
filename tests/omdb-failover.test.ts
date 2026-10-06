import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { ScoreService } from '../worker/src/score-service';
import type { Env } from '../worker/src/http';
import worker from '../worker/src/index';
import { maintainOmdbMetadata, type OmdbCheckpoint } from '../frontend/omdb-maintenance';

let local: ReturnType<typeof disposableD1>, repo: Repository, env: Env, ids: string[];
const primary = 'fictional-primary-secret', secondary = 'fictional-secondary-secret';
const ok = (headers?: HeadersInit) => Response.json({Response:'True',Year:'2001',imdbRating:'8.2',Metascore:'77',Ratings:[]},{headers});
const quota = () => Response.json({Response:'False',Error:'Request limit reached!'},{status:401});
const credentials = () => Response.json({Response:'False',Error:'Invalid API key!'},{status:403});
const key = (url: string) => new URL(url).searchParams.get('apikey');
const cooldowns = () => local.sqlite.prepare('SELECT provider FROM provider_cooldowns ORDER BY provider').all().map(row=>row.provider);
const service = () => new ScoreService(repo,env);
beforeEach(async()=>{
  local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));repo=new Repository(local.db);local.sqlite.exec('DELETE FROM classics');
  env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173',OMDB_API_KEY:primary,OMDB_API_KEY_SECONDARY:secondary};
  ids=[];
  for (const imdb of ['tt0000101','tt0000102']) {
    const id=await repo.manualMovie({title:imdb});await repo.setClassic(id,true);
    local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'imdb',imdb);ids.push(id);
  }
});
afterEach(()=>{local.sqlite.close();vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
async function maintain(mode: 'metadata'|'missing'|'refresh', selected=ids) {
  const pending=service().maintain(mode,selected);
  await vi.runAllTimersAsync();return pending;
}
it('uses primary once on success without calling secondary',async()=>{
  const fetch=vi.fn(async(_url:string)=>ok());vi.stubGlobal('fetch',fetch);
  const result=await service().maintain('metadata',[ids[0]]);
  expect(fetch).toHaveBeenCalledTimes(1);expect(key(fetch.mock.calls[0][0])).toBe(primary);
  expect(result.results[0].providers[0]).toMatchObject({provider:'omdb',status:'success'});expect(cooldowns()).toEqual([]);
});
it.each(['quota','credentials'] as const)('fails over after primary %s and skips that key on subsequent films',async kind=>{
  vi.useFakeTimers();const fetch=vi.fn(async(url:string)=>key(url)===primary ? (kind==='quota'?quota():credentials()) : ok());vi.stubGlobal('fetch',fetch);
  const result=await maintain('metadata');
  expect(fetch.mock.calls.map(([url])=>key(url))).toEqual([primary,secondary,secondary]);
  expect(result.results.every(r=>r.providers[0].status==='success')).toBe(true);
  expect(cooldowns()).toEqual(kind==='quota'?['omdb']:[]);
});
it('uses secondary directly despite an existing primary cooldown',async()=>{
  await repo.setProviderCooldown('omdb',86400);const fetch=vi.fn(async(_url:string)=>ok());vi.stubGlobal('fetch',fetch);
  const result=await service().maintain('metadata',[ids[0]]);
  expect(fetch.mock.calls.map(([url])=>key(url))).toEqual([secondary]);expect(result.results[0].providers[0].status).toBe('success');
});
it.each(['quota','credentials'] as const)('blocks and suppresses later films when both keys fail with %s',async kind=>{
  vi.useFakeTimers();const fetch=vi.fn(async(_url:string)=>kind==='quota'?quota():credentials());vi.stubGlobal('fetch',fetch);
  const result=await maintain('metadata');
  expect(fetch.mock.calls.map(([url])=>key(url))).toEqual([primary,secondary]);
  expect(result.results[0].providers[0]).toMatchObject({provider:'omdb',status:'failed',blocking:true});
  expect(result.results[1].providers[0]).toMatchObject({provider:'omdb',status:'skipped',blocking:true});
  expect(cooldowns()).toEqual(kind==='quota'?['omdb','omdb-secondary']:[]);
});
it('makes no network calls when both keys cool down and reports the earliest retry',async()=>{
  await repo.setProviderCooldown('omdb',600);await repo.setProviderCooldown('omdb-secondary',120);
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const result=await service().maintain('metadata',ids);
  expect(fetch).not.toHaveBeenCalled();expect(result.results[0].providers[0]).toMatchObject({provider:'omdb',blocking:true,status:'failed'});
  expect(result.results[0].providers[0].retryAfter).toBeGreaterThan(115);expect(result.results[0].providers[0].retryAfter).toBeLessThanOrEqual(120);
  expect(JSON.stringify(result)).not.toContain('omdb-secondary');
});
it.each(['network','outage','not-found','body-not-found','malformed','mismatch'] as const)('does not rotate credentials for %s',async kind=>{
  vi.useFakeTimers();const fetch=vi.fn(async(_url:string)=>{
    if(kind==='network') throw new Error(primary+secondary);
    if(kind==='outage') return new Response(primary+secondary,{status:503});
    if(kind==='not-found') return new Response(null,{status:404});
    if(kind==='body-not-found') return Response.json({Response:'False',Error:'Movie not found!'});
    if(kind==='mismatch') return Response.json({Response:'True',imdbID:'tt9999999'});
    return new Response(primary+secondary);
  });vi.stubGlobal('fetch',fetch);
  const result=await maintain('metadata');
  expect(fetch.mock.calls.every(([url])=>key(url)===primary)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(['not-found','mismatch'].includes(kind)?2:1);
  expect(result.results[0].providers[0].blocking).toBe(!['not-found','mismatch'].includes(kind));
  expect(JSON.stringify(result)).not.toContain(primary);expect(JSON.stringify(result)).not.toContain(secondary);
});
it('retains primary success with zero remaining quota then uses secondary for the next film',async()=>{
  vi.useFakeTimers();const fetch=vi.fn(async(url:string)=>ok(key(url)===primary?{'X-RateLimit-Remaining':'0'}:undefined));vi.stubGlobal('fetch',fetch);
  const result=await maintain('refresh');
  expect(fetch.mock.calls.map(([url])=>key(url))).toEqual([primary,secondary]);expect(cooldowns()).toEqual(['omdb']);
  expect(result.results.every(r=>r.providers.find(p=>p.provider==='omdb')?.status==='success')).toBe(true);
  expect(local.sqlite.prepare('SELECT retrieved_via FROM source_scores WHERE movie_id=?').all(ids[0])).toEqual([{retrieved_via:'omdb'},{retrieved_via:'omdb'}]);
});
it('stores only secondary cooldown on successful secondary zero-quota headers',async()=>{
  env.OMDB_API_KEY=undefined;vi.stubGlobal('fetch',vi.fn(async()=>ok({'X-RateLimit-Remaining':'0'})));
  const result=await service().maintain('metadata',[ids[0]]);
  expect(result.results[0].providers[0].status).toBe('success');expect(cooldowns()).toEqual(['omdb-secondary']);
});
it.each(['missing','refresh','compatibility-refresh','compatibility-enrich'] as const)('shares failover and OMDb provenance in %s',async mode=>{
  const fetch=vi.fn(async(url:string)=>key(url)===primary?quota():ok());vi.stubGlobal('fetch',fetch);
  const result=mode==='compatibility-refresh'?await service().refresh(ids[0]):mode==='compatibility-enrich'?await service().enrich(1):await service().maintain(mode,[ids[0]]);
  expect(fetch.mock.calls.map(([url])=>key(url))).toEqual([primary,secondary]);
  const providers='providers' in result?result.providers:result.results[0].providers;
  expect(providers.find(p=>p.provider==='omdb')).toMatchObject({provider:'omdb',status:'success'});
  const scores=local.sqlite.prepare('SELECT * FROM source_scores WHERE movie_id=?').all(ids[0]);
  expect(scores).toHaveLength(2);expect(scores.every(s=>s.retrieved_via==='omdb')).toBe(true);
  expect(scores.map(s=>s.provider).sort()).toEqual(['imdb','metacritic']);
  expect(JSON.stringify(scores)).not.toContain(primary);expect(JSON.stringify(scores)).not.toContain(secondary);expect(JSON.stringify(scores)).not.toContain('omdb-secondary');
});
it.each(['primary','secondary','neither'] as const)('supports %s-only configuration with the existing safe health shape',async configured=>{
  if(configured!=='primary')env.OMDB_API_KEY=undefined;if(configured!=='secondary')env.OMDB_API_KEY_SECONDARY=undefined;
  const fetch=vi.fn(async(_url:string)=>ok());vi.stubGlobal('fetch',fetch);
  const result=await service().maintain('metadata',[ids[0]]);
  expect(fetch.mock.calls.map(([url])=>key(url))).toEqual(configured==='neither'?[]:[configured==='primary'?primary:secondary]);
  expect(result.results[0].providers[0]).toMatchObject(configured==='neither'?{status:'skipped',message:'Not configured.'}:{status:'success'});
  const health=await worker.fetch(new Request('http://api/api/v1/health'),env);const body=await health.json() as {data:Record<string,unknown>};
  expect(body.data.omdbConfigured).toBe(configured!=='neither');expect(Object.keys(body.data)).not.toContain('omdbSecondaryConfigured');
  expect(JSON.stringify(body)).not.toContain(primary);expect(JSON.stringify(body)).not.toContain(secondary);
});
it('keeps single-primary quota behaviour',async()=>{
  env.OMDB_API_KEY_SECONDARY=undefined;const fetch=vi.fn(async()=>quota());vi.stubGlobal('fetch',fetch);
  const result=await service().maintain('metadata',ids);
  expect(fetch).toHaveBeenCalledTimes(1);expect(cooldowns()).toEqual(['omdb']);
  expect(result.results[0].providers[0]).toMatchObject({blocking:true,retryAfter:86400,status:'failed'});
});
it.each([true,false])('metadata resume advances only when secondary succeeds: %s',async succeeds=>{
  await repo.setProviderCooldown('omdb',86400);vi.stubGlobal('fetch',vi.fn(async()=>succeeds?ok():quota()));
  const checkpoint: OmdbCheckpoint={version:1,completed:10,remainingIds:[ids[0]]};let saved: OmdbCheckpoint|null=checkpoint;
  const result=await maintainOmdbMetadata({checkpoint,batch:selected=>service().maintain('metadata',selected),stopped:()=>false,progress:async()=>{},checkpointChanged:value=>{saved=value;}});
  expect(saved).toEqual(succeeds?null:checkpoint);expect(result.remaining).toBe(succeeds?0:1);expect(result.processed).toBe(succeeds?11:10);
});
it('never logs credential-bearing network errors or raw rejected bodies',async()=>{
  const logs=[vi.spyOn(console,'log'),vi.spyOn(console,'warn'),vi.spyOn(console,'error')];
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'False',Error:'Invalid API key! '+primary+secondary})));
  const result=await service().maintain('metadata',ids);
  expect(JSON.stringify(result)).not.toContain(primary);expect(JSON.stringify(result)).not.toContain(secondary);
  for(const log of logs)expect(log).not.toHaveBeenCalled();
});
