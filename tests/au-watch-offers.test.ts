import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parseTmdbEnrichment, parseMdbEnrichment } from '../worker/src/providers/enrichment';
import { EnrichmentRepository } from '../worker/src/enrichment-repository';
import { EnrichmentService } from '../worker/src/enrichment-service';
import { Repository } from '../worker/src/repository';
import { CatalogRepository } from '../worker/src/catalog-repository';
import { tmdbEnrichmentFixture, mdbEnrichmentFixture } from './enrichment-fixtures';
import { disposableD1 } from './d1';
const at='2026-10-08T00:00:00Z';
const service={provider_id:8,provider_name:'Service'};
const fixture=()=>({...tmdbEnrichmentFixture(),'watch/providers':{results:{AU:{link:'https://www.themoviedb.org/movie/42/watch?locale=AU',flatrate:[service,service],free:[{provider_id:9,provider_name:'ABC iview'}],ads:[service],rent:[service],buy:[service]},US:{flatrate:[{provider_id:77,provider_name:'US only'}]},GB:{flatrate:[service]},NZ:{flatrate:[service]}}}});
it('keeps AU only, maps five access classes, deduplicates service/access but preserves distinct modes and order',()=>{
 const offers=parseTmdbEnrichment(fixture(),at)!.watch_offers!;
 expect(offers.map(offer=>offer.access_type)).toEqual(['subscription','free','ads','rent','buy']);
 expect(offers.every(offer=>offer.country==='AU' && offer.link?.includes('locale=AU'))).toBe(true);
 expect(offers.map(offer=>offer.service_id)).toEqual(['8','9','8','8','8']);
});
it('missing AU clears supported offers; malformed structures reject the capture; other regions are never parsed',()=>{
 const base=tmdbEnrichmentFixture();
 expect(parseTmdbEnrichment({...base,'watch/providers':{results:{US:null}}},at)?.watch_offers).toEqual([]);
 for(const watch of [null,{}, {results:[]},{results:{AU:null}},{results:{AU:{flatrate:{}}}},{results:{AU:{rent:[{}]}}}]) expect(parseTmdbEnrichment({...base,'watch/providers':watch},at)).toBeUndefined();
 expect(parseMdbEnrichment({...mdbEnrichmentFixture(),streams:null,watch_providers:{}},{provider:'imdb',external_id:'tt0000042'},at)?.watch_offers).toEqual([]);
});
it('persistence filters non-AU, catalogue loads one set query for compact/full, and incomplete refresh preserves cache/freshness without HTTP',async()=>{
 const local=disposableD1();const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('No provider calls'));
 try {
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('film','Film'); INSERT INTO movie_external_ids VALUES('film','tmdb','42')");
 const repo=new EnrichmentRepository(local.db),capture=parseTmdbEnrichment(fixture(),at)!;
 capture.watch_offers!.push({...capture.watch_offers![0],country:'US'}, {...capture.watch_offers![0],country:null});
 await repo.save('film',capture);
 const rows=()=>local.sqlite.prepare('SELECT * FROM movie_provider_watch_offers').all();const before=rows();
 expect(before).toHaveLength(5);expect(before.every(row=>row.country==='AU')).toBe(true);
 const state=local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all();
 expect(parseTmdbEnrichment({...fixture(),'watch/providers':{results:{AU:{buy:null}}}},at)).toBeUndefined();
 fetch.mockResolvedValueOnce(Response.json({...fixture(),'watch/providers':{results:{AU:{rent:null}}}}));
 const failed=await new EnrichmentService(new Repository(local.db),{DB:local.db,TMDB_READ_TOKEN:'synthetic',APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'}).maintain('tmdb',['film']);
 expect(failed.results[0].status).toBe('failed');
 expect(rows()).toEqual(before);expect(local.sqlite.prepare('SELECT * FROM movie_provider_enrichment_state').all()).toEqual(state);
 const prepare=local.db.prepare.bind(local.db),queries:string[]=[];vi.spyOn(local.db,'prepare').mockImplementation(sql=>{queries.push(sql);return prepare(sql);});
 local.sqlite.exec("INSERT INTO movie_provider_watch_offers(movie_id,provider,item_key,collection,service_id,name,country,access_type,ordinal,fetched_at) VALUES('film','mdblist','old-us','streams','88','US only','US','subscription',0,'old'),('film','mdblist','old-unknown','streams','99','Unknown',NULL,'subscription',0,'old')");
 const catalog=new CatalogRepository(local.db);
 for(const value of [await catalog.catalog(),await catalog.compactCatalog()]) expect(value.movies[0].au_watch_offers).toHaveLength(5);
 expect(queries.filter(sql=>sql.includes('FROM movie_provider_watch_offers'))).toHaveLength(2);
 expect(fetch).toHaveBeenCalledOnce();
 } finally {fetch.mockRestore();local.sqlite.close();}
});
it('0018 deletes only NULL/non-AU derived rows through the supported 0009 bridge and is idempotent',()=>{
 const local=disposableD1('0009_tmdb_artwork_checked.sql');
 try {
 local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
 const fs=requireFiles();for(const migration of fs.filter(name=>name>'0009_tmdb_artwork_checked.sql' && name<'0018_au_watch_offers.sql')) local.sqlite.exec(readFileSync(`worker/migrations/${migration}`,'utf8'));
 const tables=['movies','source_scores','seen_states','sessions','session_movies','movie_external_ids'];const before=tables.map(table=>local.sqlite.prepare(`SELECT * FROM ${table}`).all());
 for(const [key,country] of [['au','AU'],['us','US'],['unknown',null],['lower','au']]) local.sqlite.prepare("INSERT INTO movie_provider_watch_offers(movie_id,provider,item_key,collection,service_id,name,country,ordinal,fetched_at) VALUES('moon','mdblist',?,'streams','8','Service',?,0,?)").run(key,country,at);
 const sql=readFileSync('worker/migrations/0018_au_watch_offers.sql','utf8');local.sqlite.exec(sql);local.sqlite.exec(sql);
 expect(local.sqlite.prepare('SELECT country FROM movie_provider_watch_offers').all()).toEqual([{country:'AU'}]);
 expect(tables.map(table=>local.sqlite.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
 expect(local.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
 }finally{local.sqlite.close();}
});
import { readdirSync } from 'node:fs';
function requireFiles(){return readdirSync('worker/migrations').filter(name=>name.endsWith('.sql')).sort();}

it('pre-cache catalogue remains safe without projection or provider calls',async()=>{
 const local=disposableD1('0009_tmdb_artwork_checked.sql');
 try{local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));const catalog=await new CatalogRepository(local.db).catalog();expect(catalog.movies.every(movie=>movie.au_watch_offers===undefined)).toBe(true);}finally{local.sqlite.close();}
});
