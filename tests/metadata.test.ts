import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { MovieService, TMDB_METADATA_REFRESH_DAYS, tmdbMetadataIsStale } from '../worker/src/services';
import { metadataCandidate, metadataGaps, tmdbIdentity } from '../shared/metadata';
import { hashToken } from '../worker/src/auth';
import worker from '../worker/src/index';
import type { Env } from '../worker/src/http';
import type { MetadataEnrichment } from '../shared/types';
let local:ReturnType<typeof disposableD1>,repo:Repository,service:MovieService,env:Env;
const token='a'.repeat(64);
const details=(id=329865,imdb='tt2543164')=>({id,title:'Fictional refreshed film',original_title:'Original film',release_date:'2001-01-02',runtime:99,overview:'Fictional overview',genres:[{name:'Drama'},{name:'Science Fiction'}],poster_path:'/fictional.jpg',backdrop_path:'/fictional-backdrop.jpg',external_ids:{imdb_id:imdb},vote_average:8,vote_count:1});
beforeEach(async()=>{
  local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));repo=new Repository(local.db);
  env={DB:local.db,APP_ENV:'production',LOCAL_WRITE_BYPASS:'false',ALLOWED_ORIGINS:'http://localhost:5173',TMDB_READ_TOKEN:'synthetic-token'};service=new MovieService(repo,env);
  local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'; INSERT INTO member_auth(member_id,authorized_email,google_sub) VALUES('member-1','synthetic@example.invalid','synthetic-sub')");
  local.sqlite.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(await hashToken(token),'member-1','2000-01-01','2200-01-01');
  local.sqlite.exec("DELETE FROM movie_genres WHERE movie_id='arrival'; INSERT INTO classics(movie_id,source) VALUES('arrival','synthetic'); INSERT INTO movie_import_refs(movie_id,import_source,source_ref) VALUES('arrival','synthetic','Tracker:2:B'); INSERT INTO seen_states(movie_id,member_id,seen) VALUES('arrival','member-1',0)");
  local.sqlite.exec("INSERT INTO seen_import_observations VALUES('arrival','synthetic','Tracker:2:B','member-1',1,'2000-01-01'); INSERT INTO import_applied_entities VALUES('synthetic','movies','arrival','immutable-fictional-fingerprint')");
});
afterEach(()=>{local.sqlite.close();vi.unstubAllGlobals();});
const call=(input:unknown={limit:10})=>worker.fetch(new Request('http://api/api/v1/movies/enrich-metadata',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)}),env);
describe('bounded existing-film metadata enrichment',()=>{
  it('uses narrow selection/counts without any full catalogue reconstruction',async()=>{
    const catalog=vi.spyOn(repo,'catalog').mockRejectedValue(new Error('Full catalogue forbidden'));
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details())));
    expect(await service.enrichMetadata(10)).toMatchObject({results:[{movieId:'arrival',status:'success'}],remaining:0,unidentified:6});
    expect(catalog).not.toHaveBeenCalled();
  });
  it('matches existing eligibility, genre priority, artwork presence and ID ordering',async()=>{
    const now=new Date().toISOString(),boundary=new Date(Date.now()-150*86400000).toISOString();
    const fixtures=[
      ['unchecked',null,null,'42','unknown'],['stale',boundary,now,'43','Drama'],
      ['known-absent',now,now,'44',''],['missing-art',now,null,'45','SCI-FI'],
      ['invalid-date','invalid',now,'46','Drama'],['invalid-id',null,null,'00047',''],
      ['too-long',null,null,'12345678901',''],['zero',null,null,'0',''],
      ['complete-art',now,null,'48','Drama'],['A-tie',null,null,'49',''],['a-tie',null,null,'50',''],
    ];
    for(const [id,checked,art,tmdb,genre] of fixtures){
      local.sqlite.prepare('INSERT INTO movies(id,title,tmdb_metadata_checked_at,tmdb_artwork_checked_at) VALUES(?,?,?,?)').run(id,id,checked,art);
      local.sqlite.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb',?)").run(id,tmdb);
      if(genre)local.sqlite.prepare('INSERT INTO movie_genres VALUES(?,?)').run(id,genre);
    }
    for(const type of ['poster','backdrop'])local.sqlite.prepare("INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,preferred,fetched_at) VALUES(?,'complete-art','tmdb',?,?,0,?)").run(type,type,type,now);
    const movies=(await repo.catalog()).movies;
    const expected=movies.filter(metadataCandidate).sort((a,b)=>metadataGaps(b)-metadataGaps(a)||a.id.localeCompare(b.id));
    vi.spyOn(repo,'catalog').mockRejectedValue(new Error('Full catalogue forbidden'));
    expect((await repo.metadataCandidates(10)).map(m=>m.id)).toEqual(expected.slice(0,10).map(m=>m.id));
    expect(await repo.metadataCounts()).toEqual({remaining:expected.length,unidentified:movies.filter(m=>!tmdbIdentity(m)).length});
  });
  it('checks genuinely unpopulated artwork immediately despite recent metadata, then excludes a known no-artwork response',async()=>{
    local.sqlite.exec("DELETE FROM movie_assets WHERE movie_id='arrival'");
    local.sqlite.prepare("UPDATE movies SET tmdb_metadata_checked_at=? WHERE id='arrival'").run(new Date().toISOString());
    const fetch=vi.fn().mockResolvedValue(Response.json({...details(),poster_path:null,backdrop_path:null}));vi.stubGlobal('fetch',fetch);
    expect(await service.enrichMetadata(10)).toMatchObject({results:[{movieId:'arrival',status:'success'}],remaining:0});
    const movie=(await repo.catalog()).movies.find(m=>m.id==='arrival')!;
    expect(movie.assets).toEqual([]);expect(movie.tmdb_artwork_checked_at).toBeTruthy();
    expect(await service.enrichMetadata(10)).toMatchObject({results:[],remaining:0});expect(fetch).toHaveBeenCalledTimes(1);
    local.sqlite.exec("UPDATE movies SET tmdb_metadata_checked_at='2000-01-01' WHERE id='arrival'");
    expect((await service.enrichMetadata(1)).results).toHaveLength(1);
  });
  it('persists new-film artwork immediately and marks absent artwork checked on live imports',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details(42,''))));
    const movie=await service.import('tmdb','42');
    expect(movie.assets.map(a=>a.asset_type).sort()).toEqual(['backdrop','poster']);expect(movie.tmdb_artwork_checked_at).toBeTruthy();
    expect(await service.import('tmdb','42')).toEqual(movie);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('halts on cooldown without later provider calls and resumes only remaining films',async()=>{
    local.sqlite.exec("INSERT INTO movies(id,title) VALUES('z-next','Next'); INSERT INTO movie_external_ids VALUES('z-next','tmdb','42'); INSERT INTO movie_genres VALUES('z-next','Drama')");
    const fetch=vi.fn().mockResolvedValueOnce(Response.json(details())).mockResolvedValueOnce(new Response(null,{status:429,headers:{'Retry-After':'60'}}));vi.stubGlobal('fetch',fetch);
    expect(await service.enrichMetadata(10)).toMatchObject({results:[{status:'success'},{status:'failed',retryAfter:60}],remaining:1});
    expect(await service.enrichMetadata(10)).toMatchObject({results:[{movieId:'z-next',status:'failed'}],remaining:1});expect(fetch).toHaveBeenCalledTimes(2);
    local.sqlite.exec("DELETE FROM provider_cooldowns");fetch.mockResolvedValue(Response.json(details(42,'')));
    expect(await service.enrichMetadata(10)).toMatchObject({results:[{movieId:'z-next',status:'success'}],remaining:0});expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('stops before the next film on provider network, credentials or outage failures',async()=>{
    local.sqlite.exec("INSERT INTO movies(id,title) VALUES('z-next','Next'); INSERT INTO movie_external_ids VALUES('z-next','tmdb','42')");
    for (const response of [null,401,503,429]) {
      const fetch=vi.fn().mockImplementation(async()=>{if(response===null)throw Error('private internals');return new Response(null,{status:response});});vi.stubGlobal('fetch',fetch);
      const result=await service.enrichMetadata(10);
      expect(result.results).toHaveLength(1);expect(result.results[0].status).toBe('failed');expect(result.remaining).toBe(2);expect(fetch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain('private internals');
    }
  });
  it('marks live TMDB imports checked, retains historical null markers, and identifies the conservative staleness boundary',async()=>{
    const fetched_at='2026-01-01T00:00:00.000Z';
    const id=await repo.importMovie({title:'Live TMDB',original_title:null,year:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],scores:[],fetched_at,external_ids:[{provider:'tmdb',external_id:'999999'}]});
    expect((await repo.catalog()).movies.find(m=>m.id===id)?.tmdb_metadata_checked_at).toBe(fetched_at);
    expect((await repo.catalog()).movies.find(m=>m.id===id)?.tmdb_artwork_checked_at).toBe(fetched_at);
    expect((await repo.catalog()).movies.find(m=>m.id==='arrival')?.tmdb_metadata_checked_at).toBeNull();
    const now=Date.parse('2026-10-01T00:00:00Z'), day=24*60*60*1000;
    expect(tmdbMetadataIsStale(new Date(now-(TMDB_METADATA_REFRESH_DAYS-1)*day).toISOString(),now)).toBe(false);
    expect(tmdbMetadataIsStale(new Date(now-TMDB_METADATA_REFRESH_DAYS*day).toISOString(),now)).toBe(true);
  });
  it('persists only explicit rate-limit cooldowns and clears expired cooldowns',async()=>{
    await repo.setProviderCooldown('mdblist',60);expect(await repo.providerCooldown('mdblist')).toBeGreaterThan(0);
    local.sqlite.exec("UPDATE provider_cooldowns SET retry_after_until='2000-01-01T00:00:00.000Z' WHERE provider='mdblist'");
    expect(await repo.providerCooldown('mdblist')).toBeNull();expect(local.sqlite.prepare("SELECT * FROM provider_cooldowns WHERE provider='mdblist'").get()).toBeUndefined();
  });
  it('fills metadata/genres/assets in place, reuses safe IMDb and preserves every historical relationship/provenance',async()=>{
    const preserved=['session_movies','classics','classics_seed_allocations','seen_states','source_scores','movie_import_refs','seen_import_observations','import_applied_entities'];
    const before=preserved.map(t=>local.sqlite.prepare(`SELECT * FROM ${t}`).all());
    const identity=local.sqlite.prepare("SELECT id,import_source,import_key,created_at FROM movies WHERE id='arrival'").get();
    const fetch=vi.fn().mockImplementation(async()=>Response.json(details()));vi.stubGlobal('fetch',fetch);
    const response=await call({limit:1});expect(response.status).toBe(200);const result=(await response.json() as {data:MetadataEnrichment}).data;
    expect(result.results[0]).toMatchObject({movieId:'arrival',status:'success',provider:'tmdb'});expect(result.unidentified).toBe(6);expect(result.remaining).toBe(0);
    expect(local.sqlite.prepare("SELECT id,import_source,import_key,created_at FROM movies WHERE id='arrival'").get()).toEqual(identity);
    const movie=(await repo.catalog()).movies.find(m=>m.id==='arrival')!;
    expect(movie.tmdb_metadata_checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(movie).toMatchObject({id:'arrival',title:'Fictional refreshed film',original_title:'Original film',year:2001,release_date:'2001-01-02',runtime:99,overview:'Fictional overview',genres:['Drama','Science Fiction']});
    expect(movie.assets.filter(a=>a.preferred===1).map(a=>a.reference).sort()).toEqual(['https://image.tmdb.org/t/p/w1280/fictional-backdrop.jpg','https://image.tmdb.org/t/p/w500/fictional.jpg']);
    expect(movie.external_ids.filter(e=>e.provider==='imdb')).toEqual([{movie_id:'arrival',provider:'imdb',external_id:'tt2543164'}]);
    expect(preserved.map(t=>local.sqlite.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
    const snapshot=await new (await import('../worker/src/providers/tmdb')).TmdbProvider('synthetic-token').details('329865');
    await repo.enrichMetadata('arrival','329865',snapshot);expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBe(7);
    expect((await repo.catalog()).movies.find(m=>m.id==='arrival')!.tmdb_metadata_checked_at).toBe(snapshot.fetched_at);
    expect(local.sqlite.prepare("SELECT count(*) n FROM movie_assets WHERE movie_id='arrival' AND preferred=1").get()?.n).toBe(2);
    expect(preserved.map(t=>local.sqlite.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
  });
  it('checks a film despite absent optional metadata, without inventing coverage or repeatedly queuing it',async()=>{
    const preserved=['sessions','session_movies','classics','classics_seed_allocations','seen_states','source_scores','movie_import_refs','seen_import_observations','import_applied_entities'];
    const before=preserved.map(t=>local.sqlite.prepare(`SELECT * FROM ${t}`).all());
    const identity=local.sqlite.prepare("SELECT id,import_source,import_key,created_at FROM movies WHERE id='arrival'").get();
    const {calculateMetrics}=await import('../shared/metrics');
    const catalogBefore=await repo.catalog(),metricsBefore=calculateMetrics(catalogBefore);
    expect(catalogBefore.movies.find(m=>m.id==='arrival')!.tmdb_metadata_checked_at).toBeNull();
    const fetch=vi.fn().mockResolvedValue(Response.json({...details(),original_title:null,release_date:'',runtime:0,overview:'',genres:[],poster_path:null,backdrop_path:null}));vi.stubGlobal('fetch',fetch);
    expect(await service.enrichMetadata(1)).toMatchObject({results:[{movieId:'arrival',status:'success'}],remaining:0});
    const catalog=await repo.catalog(),movie=catalog.movies.find(m=>m.id==='arrival')!;
    expect(movie.tmdb_metadata_checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(movie).toMatchObject({original_title:null,release_date:null,year:null,runtime:null,overview:null,genres:[]});
    expect(movie.assets).toEqual(catalogBefore.movies.find(m=>m.id==='arrival')!.assets);
    expect(local.sqlite.prepare("SELECT id,import_source,import_key,created_at FROM movies WHERE id='arrival'").get()).toEqual(identity);
    expect(preserved.map(t=>local.sqlite.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
    const metrics=calculateMetrics(catalog);
    expect(metrics.uncategorised).toBe(metricsBefore.uncategorised);
    expect(metrics.genres.find(g=>g.genre==='Uncategorised')!.appearances).toBeGreaterThan(0);
    expect(metrics.imdbScored).toBe(metricsBefore.imdbScored);
    expect(await service.enrichMetadata(10)).toMatchObject({results:[],remaining:0});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('queues unchecked films even when all optional fields are already populated',async()=>{
    local.sqlite.exec("UPDATE movie_assets SET preferred=0 WHERE movie_id='arrival'");
    local.sqlite.exec("UPDATE movies SET original_title='Fictional original',release_date='2000-01-01',runtime=90,overview='Fictional overview' WHERE id='arrival'; INSERT INTO movie_genres VALUES('arrival','Drama'); INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,preferred,fetched_at) VALUES('synthetic-p','arrival','tmdb','poster','synthetic-p',1,'2000-01-01'),('synthetic-b','arrival','tmdb','backdrop','synthetic-b',1,'2000-01-01')");
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details())));
    expect((await service.enrichMetadata(1)).results).toMatchObject([{movieId:'arrival',status:'success'}]);
    expect((await service.enrichMetadata(1)).results).toEqual([]);
  });
  it('leaves a failed lookup unchecked and retries it on a later explicit operation',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(Response.json(details()));vi.stubGlobal('fetch',fetch);
    expect(await service.enrichMetadata(1)).toMatchObject({results:[{status:'failed'}],remaining:1});
    expect((await repo.catalog()).movies.find(m=>m.id==='arrival')!.tmdb_metadata_checked_at).toBeNull();
    expect(await service.enrichMetadata(1)).toMatchObject({results:[{status:'success'}],remaining:0});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('adds a missing IMDb ID without changing internal identity',async()=>{
    local.sqlite.exec("DELETE FROM movie_external_ids WHERE movie_id='arrival' AND provider='imdb'");vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details())));
    expect((await service.enrichMetadata(1)).results[0].status).toBe('success');expect(await repo.findExternal('imdb','tt2543164')).toBe('arrival');
  });
  it('reports conflicts without stealing IDs, merging or changing metadata',async()=>{
    local.sqlite.exec("INSERT INTO movie_external_ids VALUES('moon','imdb','tt0000001')");vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(details(329865,'tt0000001'))));
    const before=await repo.catalog(),result=await service.enrichMetadata(1);
    expect(result.results[0].status).toBe('conflict');expect(await repo.catalog()).toEqual(before);expect(await repo.findExternal('imdb','tt0000001')).toBe('moon');
    expect(result.remaining).toBe(1);expect(before.movies.find(m=>m.id==='arrival')!.tmdb_metadata_checked_at).toBeNull();
    expect((await service.enrichMetadata(1)).results[0].status).toBe('conflict');
  });
  it('rejects a changed provider identity and a different IMDb ID already attached to this movie',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details(42))));expect((await service.enrichMetadata(1)).results[0].status).toBe('conflict');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details(329865,'tt0000002'))));expect((await service.enrichMetadata(1)).results[0].status).toBe('conflict');
  });
  it('rolls back metadata when an external ID collision races preflight',async()=>{
    local.sqlite.exec("DELETE FROM movie_external_ids WHERE movie_id='arrival' AND provider='imdb'");
    const batch=local.db.batch.bind(local.db);let raced=false;
    local.db.batch=(async(statements:D1PreparedStatement[])=>{if(!raced&&statements.length<10){raced=true;local.sqlite.exec("INSERT INTO movie_external_ids VALUES('moon','imdb','tt2543164')");}return batch(statements);}) as D1Database['batch'];
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(details())));
    expect((await service.enrichMetadata(1)).results[0].status).toBe('conflict');expect((await repo.catalog()).movies.find(m=>m.id==='arrival')?.title).toBe('Arrival');
    expect((await repo.catalog()).movies.find(m=>m.id==='arrival')!.tmdb_metadata_checked_at).toBeNull();
  });
  it('limits provider calls, prioritises missing genres and preserves successes after individual failures',async()=>{
    for(let i=1;i<=12;i++) local.sqlite.exec(`INSERT INTO movies(id,title) VALUES('missing-${String(i).padStart(2,'0')}','Fictional ${i}'); INSERT INTO movie_external_ids VALUES('missing-${String(i).padStart(2,'0')}','tmdb','${i}')`);
    const fetch=vi.fn().mockImplementation(async(url:string)=>{const id=Number(url.match(/movie\/(\d+)/)?.[1]);if(id===1) return new Response(null,{status:404});return Response.json(details(id,''));});vi.stubGlobal('fetch',fetch);
    const result=await service.enrichMetadata(10);expect(fetch).toHaveBeenCalledTimes(10);expect(result.results.filter(r=>r.status==='success')).toHaveLength(9);expect(result.results.filter(r=>r.status==='failed')).toHaveLength(1);expect(result.remaining).toBe(4);expect(result.unidentified).toBe(6);expect(JSON.stringify(result)).not.toContain('synthetic token');
    expect(result.results[0].movieId).toBe('missing-01');
  });
  it('reports unidentified records without provider calls and enforces bounds and configured provider',async()=>{
    local.sqlite.exec("DELETE FROM movie_external_ids WHERE provider='tmdb'");const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    expect(await service.enrichMetadata(10)).toMatchObject({results:[],remaining:0,unidentified:7});expect(fetch).not.toHaveBeenCalled();
    for(const limit of [0,11,1.5]) {expect((await call({limit})).status).toBe(422);await expect(service.enrichMetadata(limit)).rejects.toMatchObject({status:422});}
    env.TMDB_READ_TOKEN=undefined;expect((await call()).status).toBe(503);
  });
  it('admin-only endpoint denies ordinary members, anonymous and local bypass; catalog loads make no network calls',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    local.sqlite.exec("UPDATE members SET role='member' WHERE id='member-1'");expect((await call()).status).toBe(403);
    const catalog=await worker.fetch(new Request('http://api/api/v1/catalog',{headers:{Authorization:`Bearer ${token}`}}),env);expect(catalog.status).toBe(200);
    expect((await worker.fetch(new Request('http://api/api/v1/movies/arrival',{headers:{Authorization:`Bearer ${token}`}}),env)).status).toBe(200);
    const {calculateMetrics}=await import('../shared/metrics');calculateMetrics((await catalog.json() as {data:Awaited<ReturnType<Repository['catalog']>>}).data);expect(fetch).not.toHaveBeenCalled();
    expect((await worker.fetch(new Request('http://api/api/v1/movies/enrich-metadata',{method:'POST',body:'{"limit":1}'}),env)).status).toBe(401);
    env.APP_ENV='local';env.LOCAL_WRITE_BYPASS='true';expect((await call()).status).toBe(401);
  });
});
