import { expect, it, vi } from 'vitest';
import worker from '../worker/src/index';
import { call, data, env, local, session } from './helpers/product-api';
import { Repository } from '../worker/src/repository';
import { parseAwards, parseCollection } from '../shared/provider-evidence';
import type { MetricsEnrichment } from '../shared/metrics-enrichment';

it('exposes authenticated read-only History evidence without catalogue expansion or provider calls',async()=>{
  expect((await session()).ok).toBe(true);
  local.sqlite.exec("INSERT INTO movie_external_ids VALUES('moon','tmdb','42'),('moon','imdb','tt0000042')");
  const repo=new Repository(local.db),at='2026-01-01T00:00:00.000Z';
  await repo.cacheCollection('moon',parseCollection({id:7,name:'Series'},'42',at));
  await repo.cacheAwards('moon',parseAwards('Won 1 Oscar. 0 wins & 5 nominations.','tt0000042',at));
  const fetch=vi.spyOn(globalThis,'fetch');
  const before=local.sqlite.prepare('SELECT total_changes() AS n').get();
  const projection=await data<MetricsEnrichment>(await call('/metrics/enrichment'));
  expect(projection.movies.moon.collection).toEqual({status:'checked_present',external_id:'42',checked_at:at,collection_id:7,collection_name:'Series'});
  expect(projection.movies.moon.awards).toEqual({status:'checked_quantified',external_id:'tt0000042',checked_at:at,awards_text:'Won 1 Oscar. 0 wins & 5 nominations.',wins:0,nominations:5});
  expect(projection.movies.arrival).toBeUndefined();expect(fetch).not.toHaveBeenCalled();
  expect(local.sqlite.prepare('SELECT total_changes() AS n').get()).toEqual(before);
  const catalog=(await repo.catalog()).movies.find(m=>m.id==='moon')!;expect(catalog).not.toHaveProperty('collection');expect(catalog).not.toHaveProperty('awards');
  expect((await worker.fetch(new Request('http://api/api/v1/metrics/enrichment'),env)).status).toBe(401);
  expect((await call('/metrics/enrichment','POST',{},2)).status).toBe(404);fetch.mockRestore();
});
it('projects negative, unquantified and inconclusive states and excludes obsolete identities',async()=>{
  expect((await session()).ok).toBe(true);
  local.sqlite.exec("INSERT INTO movie_external_ids VALUES('moon','tmdb','42'),('moon','imdb','tt0000042')");
  const repo=new Repository(local.db),at='2026-01-01T00:00:00.000Z';
  await repo.cacheCollection('moon',parseCollection(null,'42',at));await repo.cacheAwards('moon',parseAwards('N/A','tt0000042',at));
  let projection=await data<MetricsEnrichment>(await call('/metrics/enrichment'));
  expect(projection.movies.moon.collection?.status).toBe('checked_none');expect(projection.movies.moon.awards?.status).toBe('checked_unavailable');
  await repo.cacheAwards('moon',parseAwards('Won a prize','tt0000042',at));
  projection=await data<MetricsEnrichment>(await call('/metrics/enrichment'));expect(projection.movies.moon.awards?.status).toBe('checked_unquantified');
  local.sqlite.exec("DELETE FROM movie_provider_awards;INSERT INTO movie_maintenance_evidence_failures VALUES('moon','omdb','omdb-awards','2026-01-02');UPDATE movie_external_ids SET external_id='43' WHERE movie_id='moon' AND provider='tmdb'");
  projection=await data<MetricsEnrichment>(await call('/metrics/enrichment'));
  expect(projection.movies.moon.awards?.status).toBe('inconclusive');expect(projection.movies.moon.collection?.status).toBe('not_checked');
});
it('validates four coalesced TMDB operation types and denies member maintenance writes',async()=>{
  const unit={movieId:'moon',provider:'tmdb',identity:{provider:'tmdb',external_id:'42'},operations:['scores','tmdb-metadata','tmdb-enrichment','tmdb-collections']};
  const input={intent:'refresh',startedAt:new Date().toISOString(),units:[unit]};
  expect((await call('/movies/maintenance-provider','POST',input)).status).toBe(403);
  // An unavailable provider gives a structured provider failure, rather than request validation rejecting four operations.
  expect((await call('/movies/maintenance-provider','POST',input,2)).status).toBe(200);
  expect((await call('/movies/maintenance-provider','POST',{...input,units:[{...unit,operations:['omdb-awards']}]},2)).status).toBe(422);
});
