import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { disposableD1 } from './d1';
import worker from '../worker/src/index';
import { Repository } from '../worker/src/repository';
import { EnrichmentService } from '../worker/src/enrichment-service';
import { TmdbProvider } from '../worker/src/providers/tmdb';
import { MdbListProvider, parseMdbList } from '../worker/src/providers/mdblist';
import { parseTmdbEnrichment, parseMdbEnrichment } from '../worker/src/providers/enrichment';
import { copySnapshot } from '../scripts/dev/snapshot';
import type { Env } from '../worker/src/http';
import type { EnrichmentBatch } from '../shared/enrichment';
import { tmdbEnrichmentFixture, mdbEnrichmentFixture } from './enrichment-fixtures';
const at='2026-10-07T00:00:00.000Z';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('TMDB analytical capture',()=>{
  it('parses scalars, country/language names and company IDs without decorations',()=>{
    const parsed=parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!;
    expect(parsed.metadata).toEqual({title:'Provider title',original_language:'fr',budget:1000000,revenue:2000000,popularity:12.25,tagline:'A tagline'});
    expect(parsed.countries).toEqual([{code:'US',name:'United States of America'},{code:'AU',name:'Australia'}]);
    expect(parsed.languages?.[1]).toEqual({code:'fr',name:'Français',english_name:'French'});
    expect(parsed.companies).toEqual([{external_id:'7',name:'Studio',origin_country:'AU'}]);
  });
  it.each([['Director','director'],['Writer','writer'],['Screenplay','screenplay'],['Producer','producer'],['Director of Photography','cinematographer'],['Original Music Composer','composer'],['Editor','editor']])('preserves exact %s and its analytical role %s',(job,role)=>{
    expect(parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!.credits).toContainEqual(expect.objectContaining({kind:'crew',job,role,person_id:expect.any(String),department:expect.any(String),credit_id:expect.any(String),original_name:expect.any(String)}));
  });
  it('excludes unrelated producer/camera jobs and preserves the first fifteen upstream billed cast',()=>{
    const credits=parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!.credits!;
    expect(credits.filter(c=>c.kind==='crew').map(c=>c.job)).not.toContain('Executive Producer');
    expect(credits.filter(c=>c.kind==='crew').map(c=>c.job)).not.toContain('Camera Operator');
    const cast=credits.filter(c=>c.kind==='cast');expect(cast).toHaveLength(15);
    expect(cast.map(c=>c.billing_order)).toEqual(Array.from({length:15},(_,i)=>i));
    expect(cast[0]).toMatchObject({person_id:'119',name:'Actor 19',character:'Character 19',credit_id:'cast-19'});
  });
  it('recognises the documented Cinematography equivalent without broad department or music-role inference',()=>{
    const m=tmdbEnrichmentFixture();m.credits.crew.push({id:999,name:'Another cinematographer',original_name:'Original',job:'Cinematography',department:'Crew',credit_id:'equivalent'});
    expect(parseTmdbEnrichment(m,at)!.credits).toContainEqual(expect.objectContaining({role:'cinematographer',job:'Cinematography',department:'Crew'}));
  });
  it('retains provider keywords and every distinct nonempty US/AU certification evidence',()=>{
    const parsed=parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!;
    expect(parsed.provider).toBe('tmdb');expect(parsed.keywords).toEqual([{external_id:'8',name:'courtroom'},{external_id:'9',name:'justice'}]);
    expect(parsed.content_ratings).toEqual([
      {country:'US',certification:'PG',release_type:3,release_date:'2000-01-01T00:00:00.000Z'},
      {country:'US',certification:'R',release_type:4,release_date:'2001-01-01T00:00:00.000Z'},
      {country:'AU',certification:'M',release_type:3,release_date:'2000-02-01T00:00:00.000Z'},
    ]);
  });
  it('malformed optional scalars are omitted while useful data remains; incomplete arrays cannot capture',()=>{
    const m={...tmdbEnrichmentFixture(),budget:{},tagline:[],popularity:'bad'};
    expect(parseTmdbEnrichment(m,at)?.metadata).toEqual({title:'Provider title',original_language:'fr',revenue:2000000});
    expect(parseTmdbEnrichment({...m,production_companies:{}},at)).toBeUndefined();
    expect(parseTmdbEnrichment({...m,credits:{crew:[]}},at)).toBeUndefined();
  });
  it('uses one details request with all supported append targets, no people/company calls',async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json(tmdbEnrichmentFixture()));vi.stubGlobal('fetch',fetch);
    const detail=await new TmdbProvider('fictional').details('42');expect(detail.enrichment?.credits).toHaveLength(22);
    expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toBe('https://api.themoviedb.org/3/movie/42?append_to_response=external_ids,credits,keywords,release_dates,watch/providers');
  });
});
describe('verified MDBList Media Info shape',()=>{
  it('retains provider-specific title/runtime, valid scalar identities and both availability namespaces',()=>{
    const parsed=parseMdbEnrichment(mdbEnrichmentFixture(),{provider:'imdb',external_id:'tt0000042'},at)!;
    expect(parsed.metadata).toEqual({title:'MDBList title',runtime:97});
    expect(parsed.identities).toEqual([{provider:'imdb',external_id:'tt0000042'},{provider:'tmdb',external_id:'42'},{provider:'trakt',external_id:'309'},{provider:'tvdb',external_id:'572'},{provider:'mdblist',external_id:'c0ro'}]);
    expect(parsed.watch_offers).toEqual([]);
    expect(parsed.provider).toBe('mdblist');expect(parsed.keywords).toEqual([{external_id:'3022',name:'judge'},{external_id:'5043',name:'jurors'}]);
    expect(parseMdbList(mdbEnrichmentFixture(),at,'batch').find(s=>s.provider==='letterboxd')).toMatchObject({raw_scale:10,normalized_value:92});
  });
  it('ignores object/null/boolean/empty IDs and rejects wrong correlation or malformed relationships',()=>{
    const m=mdbEnrichmentFixture();m.ids={...m.ids,tmdb:{} as never,trakt:false as never,tvdb:'' as never};
    expect(parseMdbEnrichment(m,{provider:'imdb',external_id:'tt0000042'},at)!.identities).toHaveLength(2);
    expect(parseMdbEnrichment(m,{provider:'imdb',external_id:'tt0000043'},at)).toBeUndefined();
    expect(parseMdbEnrichment({...m,keywords:{}},{provider:'imdb',external_id:'tt0000042'},at)).toBeUndefined();
  });
  it('requests keyword in the same grouped POST, with unchanged rating parsing',async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json([mdbEnrichmentFixture()])),capture=vi.fn();vi.stubGlobal('fetch',fetch);
    const result=await new MdbListProvider('fictional',undefined,capture).batch('imdb',['tt0000042']);
    expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ids:['tt0000042'],append_to_response:['keyword']});
    expect(result.get('tt0000042')).toEqual(parseMdbList(mdbEnrichmentFixture(),expect.any(String),'batch'));
    expect(capture).toHaveBeenCalledWith({provider:'imdb',external_id:'tt0000042'},expect.objectContaining({provider:'mdblist'}),'MDBList title',expect.arrayContaining(['metacritic:user','trakt:rating','rogerebert:rating']));
  });
});
describe('provider cache API and durable current state',()=>{
  let local: ReturnType<typeof disposableD1>, repo: Repository, env: Env;
  const call=async(provider: string,ids: string[],member='member-1')=>worker.fetch(new Request('http://api/api/v1/movies/enrich-provider-selected',{method:'POST',headers:{'X-BookClub-Dev-Member':member},body:JSON.stringify({provider,movie_ids:ids})}),env);
  const data=async(response:Response):Promise<EnrichmentBatch>=>{expect(response.status,await response.clone().text()).toBe(200);return (await response.json() as {data:EnrichmentBatch}).data;};
  const rows=(table:string)=>local.sqlite.prepare(`SELECT * FROM movie_provider_${table} WHERE movie_id='film' ORDER BY rowid`).all();
  beforeEach(()=>{
    local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
    local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1';INSERT INTO movies(id,title,runtime) VALUES('film','Canonical title',111);INSERT INTO movie_external_ids VALUES('film','tmdb','42');INSERT INTO movie_external_ids VALUES('film','imdb','tt0000042')");
    repo=new Repository(local.db);env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173',TMDB_READ_TOKEN:'fictional',MDBLIST_API_KEY:'fictional'};
  });
  afterEach(()=>local.sqlite.close());
  it('rejects non-admin, oversized batches and unknown films before provider calls; reports missing identity',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    expect((await call('tmdb',['film'],'member-2')).status).toBe(403);
    expect((await call('tmdb',['film','film','film'])).status).toBe(422);
    expect((await call('mdblist',Array(11).fill('film'))).status).toBe(422);
    expect((await call('mdblist',['unknown'])).status).toBe(422);
    const orphan=await repo.manualMovie({title:'Orphan'});
    expect((await data(await call('tmdb',[orphan]))).results[0].status).toBe('skipped');expect(fetch).not.toHaveBeenCalled();
  });
  it('walks an identified non-History/non-Classics movie reconciling its title without changing other canonical fields or scores',async()=>{
    const before=await repo.catalog(),scores=local.sqlite.prepare('SELECT * FROM source_scores').all();
    const fetch=vi.fn(async()=>Response.json(tmdbEnrichmentFixture()));vi.stubGlobal('fetch',fetch);
    const result=await data(await call('tmdb',['film']));expect(result.results[0].status).toBe('updated');expect(result).not.toHaveProperty('movies');
    expect(rows('credits')).toHaveLength(22);expect(rows('content_ratings')).toHaveLength(3);expect(rows('metadata')[0]).toMatchObject({budget:1000000,provider:'tmdb'});
    const after=await repo.catalog();
    expect(after.movies.find(m=>m.id==='film')).toEqual({...before.movies.find(m=>m.id==='film'),title:'Provider title',au_classification:'M'});
    expect({...after,movies:after.movies.filter(m=>m.id!=='film')}).toEqual({...before,movies:before.movies.filter(m=>m.id!=='film')});
    expect(result.canonicalChanged).toBe(true);expect(local.sqlite.prepare('SELECT * FROM source_scores').all()).toEqual(scores);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('dedicated TMDB capture tolerates unrelated malformed optional presentation fields without clearing cached scalars',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),genres:{},original_title:{},budget:{},popularity:[]})));
    const result=await data(await call('tmdb',['film']));expect(result.results[0].status).toBe('updated');expect(rows('credits')).toHaveLength(22);expect(rows('metadata')[0]).toMatchObject({revenue:2000000,budget:null});
  });
  it('idempotent rerun checks freshness, changed and successful empty sets replace only the provider set',async()=>{
    let m=tmdbEnrichmentFixture();const fetch=vi.fn(async()=>Response.json(m));vi.stubGlobal('fetch',fetch);
    await data(await call('tmdb',['film']));const before=rows('credits'), checked=rows('enrichment_state')[0].checked_at;
    await new Promise(resolve=>setTimeout(resolve,5));
    expect((await data(await call('tmdb',['film']))).results[0].status).toBe('no_change');expect(rows('credits')).toEqual(before);expect(rows('enrichment_state')[0].checked_at).not.toBe(checked);
    m={...m,keywords:{keywords:[{id:10,name:'new keyword'}]}};await data(await call('tmdb',['film']));expect(rows('keywords')).toHaveLength(1);expect(rows('keywords')[0].name).toBe('new keyword');
    await repo.cacheEnrichment('film',parseMdbEnrichment(mdbEnrichmentFixture(),{provider:'imdb',external_id:'tt0000042'},at)!);
    m={...m,keywords:{keywords:[]},production_countries:[]};await data(await call('tmdb',['film']));
    expect(rows('countries')).toHaveLength(0);expect(rows('keywords')).toHaveLength(2);expect(rows('keywords').every(r=>r.provider==='mdblist')).toBe(true);
  });
  it.each(['network','malformed','incomplete','rate'])('%s preserves cached data and successful checked time',async kind=>{
    await repo.cacheEnrichment('film',parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!);const previous=rows('keywords'),state=rows('enrichment_state');
    const fetch=vi.fn(async()=>{if(kind==='network')throw Error('private credential URL');if(kind==='rate')return new Response('private body',{status:429,headers:{'Retry-After':'120'}});return Response.json(kind==='malformed'?{error:'private'}:{...tmdbEnrichmentFixture(),keywords:{}});});vi.stubGlobal('fetch',fetch);
    const result=await data(await call('tmdb',['film']));expect(result.results[0].status).toBe('failed');expect(rows('keywords')).toEqual(previous);expect(rows('enrichment_state')).toEqual(state);
    expect(JSON.stringify(result)).not.toContain('private');
    if(kind==='rate'){expect(result.results[0].retryAfter).toBe(120);await call('tmdb',['film']);expect(fetch).toHaveBeenCalledTimes(1);expect(await repo.providerCooldown('tmdb')).toBeGreaterThan(100);}
  });
  it('retains conflicting identity evidence without stealing ownership; other enrichment remains useful',async()=>{
    local.sqlite.exec("INSERT INTO movies(id,title) VALUES('other','Other');INSERT INTO movie_external_ids VALUES('other','trakt','309')");
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json([mdbEnrichmentFixture()])));
    const result=await data(await call('mdblist',['film']));expect(result.results[0]).toMatchObject({status:'updated',conflicts:1});expect(result.canonicalChanged).toBe(true);
    expect(await repo.findExternal('trakt','309')).toBe('other');expect(await repo.findExternal('tvdb','572')).toBe('film');expect(rows('identity_claims')).toContainEqual(expect.objectContaining({identity_provider:'trakt',external_id:'309'}));
    expect(rows('metadata')[0]).toMatchObject({title:'MDBList title',runtime:97});expect(local.sqlite.prepare("SELECT title,runtime FROM movies WHERE id='film'").get()).toEqual({title:'MDBList title',runtime:111});
    expect(local.sqlite.prepare("SELECT * FROM source_scores WHERE movie_id='film'").all()).toHaveLength(0);
  });
  it.each(['missing','refresh'])('%s scores opportunistically save enrichment with exactly one MDBList HTTP call',async mode=>{
    await repo.setClassic('film',true);const fetch=vi.fn(async()=>Response.json([mdbEnrichmentFixture()]));vi.stubGlobal('fetch',fetch);
    const response=await worker.fetch(new Request('http://api/api/v1/movies/maintain',{method:'POST',headers:{'X-BookClub-Dev-Member':'member-1'},body:JSON.stringify({mode,movie_ids:['film']})}),env);
    expect(response.status).toBe(200);expect(fetch).toHaveBeenCalledTimes(1);expect(rows('watch_offers')).toHaveLength(0);expect(rows('keywords')).toHaveLength(2);expect(local.sqlite.prepare("SELECT * FROM source_scores WHERE movie_id='film'").all()).toHaveLength(6);
  });
  it('ordinary TMDB metadata details also populate the cache in the same request',async()=>{
    const fetch=vi.fn(async()=>Response.json(tmdbEnrichmentFixture()));vi.stubGlobal('fetch',fetch);
    const response=await worker.fetch(new Request('http://api/api/v1/movies/enrich-metadata-selected',{method:'POST',headers:{'X-BookClub-Dev-Member':'member-1'},body:JSON.stringify({movie_ids:['film']})}),env);
    expect(response.status).toBe(200);expect(rows('countries')).toHaveLength(2);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('uses provider groups sequentially; quota reserve stops before the second group and captures safe headers',async()=>{
    local.sqlite.exec("INSERT INTO movies(id,title) VALUES('fallback','Fallback');INSERT INTO movie_external_ids VALUES('fallback','tmdb','99')");
    const fetch=vi.fn(async()=>Response.json([mdbEnrichmentFixture()],{headers:{'X-RateLimit-Limit':'1000','X-RateLimit-Remaining':'25','X-RateLimit-Reset':String(Math.floor(Date.now()/1000)+300)}}));vi.stubGlobal('fetch',fetch);
    const result=await data(await call('mdblist',['film','fallback']));expect(fetch).toHaveBeenCalledTimes(1);expect(result.quota).toMatchObject({'X-RateLimit-Remaining':'25','X-RateLimit-Limit':'1000'});expect(result.stopped).toBe(true);expect(result.results[0].status).toBe('updated');expect(await repo.providerCooldown('mdblist')).toBeGreaterThan(250);
  });
  it('MDBList 429 returns quota/Retry-After, persists cooldown and makes no recovery or immediate retry call',async()=>{
    const fetch=vi.fn(async()=>new Response('private upstream data',{status:429,headers:{'Retry-After':'180','X-RateLimit-Limit':'1000','X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(Math.floor(Date.now()/1000)+180)}}));vi.stubGlobal('fetch',fetch);
    const result=await data(await call('mdblist',['film']));expect(result.results[0]).toMatchObject({status:'failed',blocking:true,retryAfter:180});expect(result.quota).toMatchObject({'X-RateLimit-Remaining':'0','Retry-After':'180'});
    await call('mdblist',['film']);expect(fetch).toHaveBeenCalledTimes(1);expect(rows('enrichment_state')).toEqual([]);expect(JSON.stringify(result)).not.toContain('private');
  });
  it('dedicated MDBList groups IMDb and TMDB into exactly two sequential batch calls and makes no follow-ups',async()=>{
    local.sqlite.exec("INSERT INTO movies(id,title) VALUES('fallback','Fallback');INSERT INTO movie_external_ids VALUES('fallback','tmdb','99')");let active=0;
    const fetch=vi.fn(async(url:string,init:RequestInit)=>{expect(active++).toBe(0);await Promise.resolve();const fallback=url.includes('/tmdb/');expect(JSON.parse(init.body as string).ids).toEqual(fallback?[99]:['tt0000042']);active--;return Response.json([fallback?mdbEnrichmentFixture('tt0000099',99):mdbEnrichmentFixture()]);});vi.stubGlobal('fetch',fetch);
    const result=await data(await call('mdblist',['fallback','film']));expect(result.results).toHaveLength(2);expect(result.results.every(r=>r.status==='updated')).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('successful empty MDBList availability/keywords clears old sets without touching TMDB',async()=>{
    await repo.cacheEnrichment('film',parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!);
    await repo.cacheEnrichment('film',parseMdbEnrichment(mdbEnrichmentFixture(),{provider:'imdb',external_id:'tt0000042'},at)!);
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{...mdbEnrichmentFixture(),streams:[],watch_providers:[],keywords:[]}])));
    expect((await data(await call('mdblist',['film']))).results[0].status).toBe('updated');expect(rows('watch_offers')).toEqual([]);expect(rows('keywords')).toHaveLength(2);expect(rows('keywords').every(r=>r.provider==='tmdb')).toBe(true);
  });
  it('valid cached optional scalar survives a later malformed scalar and D1 statements stay within 100 parameters',async()=>{
    const bind=vi.fn(),real=local.db.prepare.bind(local.db);
    vi.spyOn(local.db,'prepare').mockImplementation(sql=>{const statement=real(sql),original=statement.bind.bind(statement);statement.bind=(...values:unknown[])=>{bind(values.length);expect(values.length).toBeLessThanOrEqual(100);return original(...values);};return statement;});
    await repo.cacheEnrichment('film',parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!);
    await repo.cacheEnrichment('film',parseTmdbEnrichment({...tmdbEnrichmentFixture(),budget:{}},'2026-10-08T00:00:00Z')!);
    expect(rows('metadata')[0].budget).toBe(1000000);expect(bind).toHaveBeenCalled();
  });
  it('older schema rejects dedicated enrichment before spending quota while ordinary cache capture remains optional',async()=>{
    const prior=disposableD1('0015_drop_redundant_score_index.sql');
    try {
      prior.sqlite.exec("INSERT INTO movies(id,title) VALUES('film','Film');INSERT INTO movie_external_ids VALUES('film','tmdb','42')");
      const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const repo=new Repository(prior.db);
      await expect(new EnrichmentService(repo,{...env,DB:prior.db}).maintain('tmdb',['film'])).rejects.toMatchObject({code:'SCHEMA_UPGRADE_REQUIRED'});
      expect(await repo.cacheEnrichment('film',parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!)).toMatchObject({unsupported:true});expect(fetch).not.toHaveBeenCalled();
    } finally {prior.sqlite.close();}
  });
  it('TMDB provider-wide failure suppresses later sequential calls in the same batch',async()=>{
    local.sqlite.exec("INSERT INTO movies(id,title) VALUES('second','Second');INSERT INTO movie_external_ids VALUES('second','tmdb','99')");
    const fetch=vi.fn(async()=>new Response('',{status:500}));vi.stubGlobal('fetch',fetch);
    const result=await data(await call('tmdb',['film','second']));expect(fetch).toHaveBeenCalledTimes(1);expect(result.stopped).toBe(true);expect(result.results).toHaveLength(1);
  });
  it('race or failed D1 batch rolls back all provider rows and freshness',async()=>{
    await repo.cacheEnrichment('film',parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!);const previous=rows('metadata'),state=rows('enrichment_state');
    local.sqlite.exec("UPDATE movie_external_ids SET external_id='43' WHERE movie_id='film' AND provider='tmdb'");
    await expect(repo.cacheEnrichment('film',parseTmdbEnrichment(tmdbEnrichmentFixture(),'2026-10-08T00:00:00Z')!)).rejects.toThrow('identity changed');
    expect(rows('metadata')).toEqual(previous);expect(rows('enrichment_state')).toEqual(state);
  });
  it('incomplete MDBList does not clear availability or keywords, even with usable ratings',async()=>{
    await repo.cacheEnrichment('film',parseMdbEnrichment(mdbEnrichmentFixture(),{provider:'imdb',external_id:'tt0000042'},at)!);
    const previous=rows('watch_offers'),state=rows('enrichment_state');vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{...mdbEnrichmentFixture(),keywords:null}])));
    expect((await data(await call('mdblist',['film']))).results[0].status).toBe('failed');expect(rows('watch_offers')).toEqual(previous);expect(rows('enrichment_state')).toEqual(state);
  });
});
describe('additive migration 0016',()=>{
  it('preserves populated 0015 films, ratings, History, Seen, Classics and ownership, with cascading/FK/unique cache constraints',async()=>{
    const local=disposableD1('0015_drop_redundant_score_index.sql'),target=disposableD1();
    try {
      local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
      const tables=['movies','source_scores','sessions','session_movies','seen_states','classics','movie_external_ids'];
      const before=tables.map(t=>local.sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all());
      // Authorised older snapshots retain empty destination-only enrichment caches.
      copySnapshot(local.sqlite,target.sqlite);expect(target.sqlite.prepare('SELECT * FROM movie_provider_keywords').all()).toHaveLength(0);
      local.sqlite.exec(readFileSync('worker/migrations/0016_provider_enrichment.sql','utf8'));
      expect(tables.map(t=>local.sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all())).toEqual(before);
      expect(local.sqlite.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(()=>local.sqlite.exec("INSERT INTO movie_provider_keywords VALUES('missing','tmdb','key','1','Keyword','now')")).toThrow('FOREIGN KEY');
      expect(()=>local.sqlite.exec("INSERT INTO movie_external_ids SELECT 'alien',provider,external_id FROM movie_external_ids WHERE movie_id='arrival'")).toThrow('UNIQUE');
      local.sqlite.exec("INSERT INTO movies(id,title) VALUES('disposable','Disposable');INSERT INTO movie_external_ids VALUES('disposable','tmdb','42')");
      await new Repository(local.db).cacheEnrichment('disposable',parseTmdbEnrichment(tmdbEnrichmentFixture(),at)!);
      expect(()=>local.sqlite.exec("INSERT INTO movie_provider_keywords SELECT * FROM movie_provider_keywords WHERE movie_id='disposable'")).toThrow('UNIQUE');
      local.sqlite.exec("DELETE FROM movies WHERE id='disposable'");
      for (const name of local.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'movie_provider_%'").all()) expect(local.sqlite.prepare(`SELECT * FROM ${name.name} WHERE movie_id='disposable'`).all()).toHaveLength(0);
    } finally {local.sqlite.close();target.sqlite.close();}
  });
});
