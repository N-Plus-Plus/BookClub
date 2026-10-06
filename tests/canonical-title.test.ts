import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { copySnapshot } from '../scripts/dev/snapshot';
import { disposableD1 } from './d1';
import { usableTitle } from '../shared/titles';
import { Repository } from '../worker/src/repository';
import { TitleRepository, canonicalTitleStatement, providerTitleStatement } from '../worker/src/title-repository';
import { OmdbProvider, parseOmdbMetadata } from '../worker/src/providers/omdb';
import { ScoreService } from '../worker/src/score-service';
import { TmdbProvider } from '../worker/src/providers/tmdb';
import { EnrichmentRepository } from '../worker/src/enrichment-repository';
import { tmdbEnrichmentFixture, mdbEnrichmentFixture } from './enrichment-fixtures';
import type { Env } from '../worker/src/http';
import worker from '../worker/src/index';
const instances: ReturnType<typeof disposableD1>[]=[];
function setup(last?:string) {
  const local=disposableD1(last);instances.push(local);
  local.sqlite.exec("INSERT INTO movies(id,title,import_source,import_key) VALUES('f','Wrong Legacy Name','legacy-spreadsheet','source');INSERT INTO movie_external_ids VALUES('f','imdb','tt0000042');INSERT INTO movie_external_ids VALUES('f','tmdb','42');");
  return {...local,repo:new Repository(local.db),titles:new TitleRepository(local.db)};
}
const row=(local:ReturnType<typeof setup>)=>local.sqlite.prepare("SELECT title,title_source FROM movies WHERE id='f'").get();
async function save(local:ReturnType<typeof setup>,provider:string,title:unknown) {
  const statement=providerTitleStatement(local.db,'f',provider,title,{provider:provider==='tmdb'?'tmdb':'imdb',external_id:provider==='tmdb'?'42':'tt0000042'},'2026-01-01');
  if(statement)await local.db.batch([statement,canonicalTitleStatement(local.db,'f')]);
}
afterEach(()=>{instances.splice(0).forEach(i=>i.sqlite.close());vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each([
  [['mdblist','tmdb','omdb'],'omdb'],[['tmdb','mdblist'],'tmdb'],[['mdblist'],'mdblist'],[[],'legacy-spreadsheet'],
  [['mdblist','omdb','tmdb'],'omdb'],[['tmdb','mdblist','omdb'],'omdb']
] as [string[],string][])('resolves %j deterministically to %s',async(order,source)=>{
  const local=setup();for(const provider of order)await save(local,provider,provider+' title');
  expect(row(local)).toEqual({title:source==='legacy-spreadsheet'?'Wrong Legacy Name':source+' title',title_source:source});
  const before=local.sqlite.prepare("SELECT updated_at FROM movies WHERE id='f'").get();
  expect((await local.titles.reconcileCanonicalTitle('f'))[0].results).toHaveLength(0);
  expect(local.sqlite.prepare("SELECT updated_at FROM movies WHERE id='f'").get()).toEqual(before);
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM movie_provider_metadata').get()?.n).toBe(order.length);
});
it('preserves higher authority on late refresh and unavailable titles, but records usable lower evidence',async()=>{
  const local=setup();await save(local,'omdb',' OMDb title ');await save(local,'mdblist','Different title');await save(local,'tmdb','TMDB title');
  for(const bad of [null,undefined,'',' ','N/A',{},42])await save(local,'omdb',bad);
  expect(row(local)).toEqual({title:'OMDb title',title_source:'omdb'});
  expect(local.sqlite.prepare("SELECT title FROM movie_provider_metadata WHERE provider='mdblist'").get()?.title).toBe('Different title');
});
it('improves source even when the visible title matches',async()=>{
  const local=setup();await save(local,'mdblist','Same');await save(local,'tmdb','Same');await save(local,'omdb','Same');
  expect(row(local)).toEqual({title:'Same',title_source:'omdb'});
});
it('validates minimally without changing punctuation, casing or articles',()=>{
  expect(usableTitle("  Singin' in the Rain  ")).toBe("Singin' in the Rain");
  for(const Title of [undefined,'N/A','',' ',42])expect(parseOmdbMetadata({Response:'True',Title}).title).toBeNull();
  expect(parseOmdbMetadata({Response:'True',Title:' OMDb Title '}).title).toBe('OMDb Title');
});
it('requires matching returned IMDb identity for title and preserves evidence on missing title',async()=>{
  const local=setup();const fetch=vi.fn(async()=>Response.json({Response:'True',imdbID:'tt0000042',Title:' OMDb title '}));vi.stubGlobal('fetch',fetch);
  const provider=new OmdbProvider('fictional');await local.repo.enrichOmdbMetadata('f','tt0000042',(await provider.details('tt0000042')).metadata);
  fetch.mockImplementation(async()=>Response.json({Response:'True',imdbID:'tt0000042',Title:'N/A'}));
  await local.repo.enrichOmdbMetadata('f','tt0000042',(await provider.details('tt0000042')).metadata);
  expect(row(local)?.title_source).toBe('omdb');
  fetch.mockImplementation(async()=>Response.json({Response:'True',imdbID:'tt0000099',Title:'Wrong'}));
  await expect(provider.details('tt0000042')).rejects.toMatchObject({kind:'not_found'});expect(row(local)?.title).toBe('OMDb title');
  fetch.mockImplementation(async()=>Response.json({Response:'True',Title:'Unverified'}));expect((await provider.details('tt0000042')).metadata.title).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(4);
});
it('captures an opportunistic OMDb score response once, including compatibility refresh',async()=>{
  const local=setup();vi.stubGlobal('fetch',vi.fn(async()=>Response.json({Response:'True',imdbID:'tt0000042',Title:'Correct Provider Name',imdbRating:'8'})));
  await new ScoreService(local.repo,{DB:local.db,APP_ENV:'local',OMDB_API_KEY:'fictional'} as Env).refresh('f');
  expect(fetch).toHaveBeenCalledTimes(1);expect(row(local)).toEqual({title:'Correct Provider Name',title_source:'omdb'});
  expect(await local.repo.searchMovies('Correct Provider')).toHaveLength(1);expect(await local.repo.searchMovies('Wrong Legacy')).toHaveLength(0);
});
it('retains TMDB display title distinct from original title in import, maintenance and score fallback without extra calls',async()=>{
  const local=setup();vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...tmdbEnrichmentFixture(),original_title:'Original identity',vote_average:8,vote_count:1,genres:[]})));
  const details=await new TmdbProvider('fictional').details('42');await local.repo.enrichMetadata('f','42',details);
  expect(row(local)).toEqual({title:'Provider title',title_source:'tmdb'});expect(local.sqlite.prepare("SELECT original_title FROM movies WHERE id='f'").get()?.original_title).toBe('Original identity');
  expect(local.sqlite.prepare("SELECT title FROM movie_provider_metadata WHERE provider='tmdb'").get()?.title).toBe('Provider title');expect(fetch).toHaveBeenCalledTimes(1);
  await save(local,'omdb','Highest');await local.repo.enrichMetadata('f','42',details);expect(row(local)?.title).toBe('Highest');
  await new ScoreService(local.repo,{DB:local.db,APP_ENV:'local',TMDB_READ_TOKEN:'fictional'} as Env).refresh('f');expect(fetch).toHaveBeenCalledTimes(2);expect(row(local)?.title).toBe('Highest');
  const imported=await local.repo.importMovie({...details,external_ids:[{provider:'tmdb',external_id:'99'}],enrichment:undefined});
  expect(local.sqlite.prepare('SELECT title_source FROM movies WHERE id=?').get(imported)?.title_source).toBe('tmdb');
});
it('preserves prior MDBList title on malformed/absent evidence and creates no score snapshot',async()=>{
  const local=setup(),repo=new EnrichmentRepository(local.db);
  await repo.save('f',{provider:'mdblist',identity:{provider:'imdb',external_id:'tt0000042'},fetchedAt:'2026-01-01',metadata:{title:'MDB title'}});
  await repo.save('f',{provider:'mdblist',identity:{provider:'imdb',external_id:'tt0000042'},fetchedAt:'2026-01-02',metadata:{title:null}});
  expect(row(local)).toEqual({title:'MDB title',title_source:'mdblist'});expect(local.sqlite.prepare('SELECT count(*) AS n FROM source_scores').get()?.n).toBe(0);
});
it('additive populated migration preserves every prior table row and title, then reconciles cached evidence without fetch',async()=>{
  const local=setup('0016_provider_enrichment.sql');
  local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  local.sqlite.exec("INSERT INTO movie_import_refs(import_source,source_ref,movie_id,source_ordinal) VALUES('legacy-spreadsheet','Should Watch:99','f',99);INSERT INTO classics(movie_id,source) VALUES('f','legacy-spreadsheet')");
  local.sqlite.exec("INSERT INTO movie_provider_metadata(movie_id,provider,title,fetched_at) VALUES('f','mdblist','Cached title','2026-01-01')");
  const names=local.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>String(r.name));
  const before=Object.fromEntries(names.map(n=>[n,local.sqlite.prepare(`SELECT * FROM ${n}`).all()]));
  local.sqlite.exec(readFileSync('worker/migrations/0017_canonical_title.sql','utf8'));
  for(const n of names){const after=local.sqlite.prepare(`SELECT * FROM ${n}`).all();if(n==='movies')after.forEach(r=>delete r.title_source);expect(after).toEqual(before[n]);}
  vi.stubGlobal('fetch',vi.fn());expect(row(local)).toEqual({title:'Wrong Legacy Name',title_source:'legacy-spreadsheet'});
  expect(await local.titles.reconcileBatch(null)).toMatchObject({changed:1,next:null});expect(row(local)).toEqual({title:'Cached title',title_source:'mdblist'});expect(fetch).not.toHaveBeenCalled();
});
it('cached endpoints are admin-only, bounded and make zero fetch calls',async()=>{
  const local=setup();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'");
  const env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'} as Env;vi.stubGlobal('fetch',vi.fn());
  const call=(member:string,path:string,method='GET')=>worker.fetch(new Request('http://localhost/api/v1/movies/'+path,{method,headers:{Origin:'http://localhost:4173','X-BookClub-Dev-Member':member,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})}),env);
  expect((await call('member-2','title-authority')).status).toBe(403);expect((await call('member-2','reconcile-titles','POST')).status).toBe(403);
  expect((await call('member-1','title-authority')).status).toBe(200);expect((await call('member-1','reconcile-titles','POST')).status).toBe(200);expect(fetch).not.toHaveBeenCalled();
  for(let i=0;i<101;i++)await local.repo.manualMovie({title:'Manual '+i});
  let after:string|null=null,total=0;do{const result=await local.titles.reconcileBatch(after);expect(result.processed).toBeLessThanOrEqual(50);total+=result.processed;after=result.next;}while(after);
  expect(total).toBe(local.sqlite.prepare('SELECT count(*) AS n FROM movies').get()?.n);
});

it('MDBList score capture retains title from the existing Media Info response with exactly one request',async()=>{
  const local=setup();
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...mdbEnrichmentFixture(),ratings:[{source:'imdb',value:8}]})));
  await new ScoreService(local.repo,{DB:local.db,APP_ENV:'local',MDBLIST_API_KEY:'fictional'} as Env).refresh('f');
  expect(fetch).toHaveBeenCalledTimes(1);expect(row(local)).toEqual({title:'MDBList title',title_source:'mdblist'});
  expect(local.sqlite.prepare("SELECT count(*) AS n FROM source_scores WHERE movie_id='f'").get()?.n).toBe(1);
});

it.each(['single','batch'])('retains verified MDBList %s title when analytical arrays are incomplete without extra requests',async endpoint=>{
  const local=setup();await local.repo.setClassic('f',true);
  const media={title:' Title only ',ids:{imdb:'tt0000042'},type:'movie',ratings:[{source:'imdb',value:8}]};
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(endpoint==='single'?media:[media])));
  const service=new ScoreService(local.repo,{DB:local.db,APP_ENV:'local',MDBLIST_API_KEY:'fictional'} as Env);
  if(endpoint==='single')await service.refresh('f');else await service.maintain('missing',['f']);
  expect(fetch).toHaveBeenCalledTimes(1);expect(row(local)).toEqual({title:'Title only',title_source:'mdblist'});
  expect(local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all()).toEqual([]);
});
it('title status on an empty catalogue returns zero counts, and manual creation preserves usable fallback',async()=>{
  const local=disposableD1();instances.push(local);
  expect(await new TitleRepository(local.db).status()).toEqual({total:0,missingOmdb:0,missingTmdb:0,sources:{omdb:0,tmdb:0,mdblist:0,manual:0,'legacy-spreadsheet':0}});
  const id=await new Repository(local.db).manualMovie({title:'Manual title'});
  await new TitleRepository(local.db).reconcileCanonicalTitle(id);
  expect(local.sqlite.prepare('SELECT title,title_source FROM movies WHERE id=?').get(id)).toEqual({title:'Manual title',title_source:'manual'});
});
it('older schema title operator endpoints fail before any provider calls',async()=>{
  const local=setup('0016_provider_enrichment.sql');vi.stubGlobal('fetch',vi.fn());
  await expect(local.titles.status()).rejects.toMatchObject({status:503,code:'SCHEMA_REQUIRED'});
  await expect(local.titles.reconcileBatch(null)).rejects.toMatchObject({status:503,code:'SCHEMA_REQUIRED'});expect(fetch).not.toHaveBeenCalled();
});

it('copies pre-authority snapshots without inventing provider authority or changing titles',()=>{
  const source=setup('0016_provider_enrichment.sql'),target=disposableD1();instances.push(target);
  copySnapshot(source.sqlite,target.sqlite);
  expect(target.sqlite.prepare("SELECT title,title_source FROM movies WHERE id='f'").get()).toEqual({title:'Wrong Legacy Name',title_source:'legacy-spreadsheet'});
  expect(source.sqlite.prepare("SELECT title FROM movies WHERE id='f'").get()?.title).toBe('Wrong Legacy Name');
});
it('provider title evidence and canonical change roll back together on persistence failure',async()=>{
  const local=setup();local.sqlite.exec("CREATE TRIGGER reject_title BEFORE UPDATE ON movies WHEN NEW.title_source='omdb' BEGIN SELECT RAISE(ABORT,'Fixture failure'); END;");
  await expect(local.repo.enrichOmdbMetadata('f','tt0000042',{title:'OMDb title',year:null,runtime:null,director:null,genres:[]})).rejects.toThrow();
  expect(row(local)).toEqual({title:'Wrong Legacy Name',title_source:'legacy-spreadsheet'});expect(local.sqlite.prepare('SELECT * FROM movie_provider_metadata').all()).toEqual([]);
});

it('a successful OMDb title omission still reconciles best existing cached evidence without inventing OMDb authority',async()=>{
 const local=setup('0016_provider_enrichment.sql');
 local.sqlite.exec("INSERT INTO movie_provider_metadata(movie_id,provider,title,fetched_at) VALUES('f','mdblist','Best cached title','2026-01-01')");
 local.sqlite.exec(readFileSync('worker/migrations/0017_canonical_title.sql','utf8'));
 expect(await local.repo.enrichOmdbMetadata('f','tt0000042',{title:null,year:null,runtime:null,director:null,genres:[]})).toBe(true);
 expect(row(local)).toEqual({title:'Best cached title',title_source:'mdblist'});
 expect(local.sqlite.prepare("SELECT * FROM movie_provider_metadata WHERE provider='omdb'").all()).toEqual([]);
});
