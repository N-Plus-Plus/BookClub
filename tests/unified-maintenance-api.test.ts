import { expect, it, vi } from 'vitest';
import { call, data, env, local } from './helpers/product-api';
import type { MaintenanceCoverage } from '../shared/maintenance-plan';

it('requires admin access to coverage and rejects strict/bounded provider requests before calls',async()=>{
  expect((await call('/movies/maintenance-coverage')).status).toBe(403);
  const result=await data<MaintenanceCoverage & {next:string | null}>(await call('/movies/maintenance-coverage','GET',undefined,2));
  expect(result).toMatchObject({checks:[],negativeScores:[],enrichment:[],next:null});
  const unit={movieId:'moon',provider:'tmdb',identity:{provider:'tmdb',external_id:'1'},operations:['tmdb-metadata']};
  for(const input of [{intent:'refresh',startedAt:new Date().toISOString(),units:[unit],extra:true},{intent:'refresh',startedAt:new Date().toISOString(),units:[unit,unit,unit]},{intent:'refresh',startedAt:new Date().toISOString(),units:[{...unit,operations:['omdb-metadata']}]}]) expect((await call('/movies/maintenance-provider','POST',input,2)).status).toBe(422);
});
it('coverage never calls providers or expires persisted cooldown rows and gates missing schema',async()=>{
  const upstream=vi.spyOn(globalThis,'fetch');
  env.TMDB_READ_TOKEN='fictional';local.sqlite.exec("INSERT INTO provider_cooldowns VALUES('tmdb','2000-01-01','2000-01-01')");
  expect((await call('/movies/maintenance-coverage','GET',undefined,2)).status).toBe(200);expect(upstream).not.toHaveBeenCalled();
  expect(local.sqlite.prepare('SELECT count(*) AS n FROM provider_cooldowns').get()?.n).toBe(1);
  local.sqlite.exec('DROP TABLE movie_maintenance_coverage');expect((await call('/movies/maintenance-coverage','GET',undefined,2)).status).toBe(503);upstream.mockRestore();
});
