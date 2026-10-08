import { readFileSync } from 'node:fs';
import { describe,expect,it,vi } from 'vitest';
import { disposableD1 } from './d1';
import { MetricsRepository } from '../worker/src/metrics-repository';
import worker from '../worker/src/index';
import type { Env } from '../worker/src/http';

describe('read-only lazy Metrics projection',() => {
  it('uses ten scoped set queries plus one schema check for active History, omitting candidate-only/deleted films and unrelated facts without HTTP/writes',async() => {
    const local = disposableD1();
    const fetch = vi.fn(() => {throw new Error('Provider/network access forbidden');});vi.stubGlobal('fetch',fetch);
    try {
      local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
      const ids = local.sqlite.prepare('SELECT id FROM movies ORDER BY id').all().map(r => String(r.id));
      const active = String(local.sqlite.prepare('SELECT sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL LIMIT 1').get()!.movie_id);
      const candidate = ids.find(id => !local.sqlite.prepare('SELECT 1 FROM session_movies WHERE movie_id=?').get(id))!;
      expect(candidate).toBeTruthy();
      const deleted = 'metrics-deleted';
      local.sqlite.exec(`INSERT INTO movies(id,title) VALUES ('${deleted}','Deleted only'); INSERT INTO sessions(id,event_date,kind,host_member_id,date_precision,deleted_at) VALUES ('deleted-metrics','2020-01-01','hosted','member-1','exact','2020-01-02'); INSERT INTO session_movies(session_id,movie_id,position) VALUES ('deleted-metrics','${deleted}',1)`);
      for (const id of [active,candidate,deleted]) {
        local.sqlite.prepare("INSERT INTO movie_provider_metadata(movie_id,provider,title,original_language,budget,revenue,popularity,tagline,fetched_at) VALUES (?,'tmdb','Provider title','ja',10,30,99,'Private irrelevant text','2020')").run(id);
        local.sqlite.prepare("INSERT INTO movie_provider_keywords(movie_id,provider,item_key,name,fetched_at) VALUES (?,'mdblist','k','MDB keyword','2020')").run(id);
      }
      local.sqlite.prepare("INSERT INTO movie_provider_countries(movie_id,provider,item_key,code,name,fetched_at) VALUES (?,'tmdb','JP','JP','Japan','2020')").run(active);
      local.sqlite.prepare("INSERT INTO movie_provider_languages(movie_id,provider,item_key,code,english_name,fetched_at) VALUES (?,'tmdb','ja','ja','Japanese','2020')").run(active);
      local.sqlite.prepare("INSERT INTO movie_provider_companies(movie_id,provider,item_key,external_id,name,fetched_at) VALUES (?,'tmdb','1','1','Studio','2020')").run(active);
      for (const role of ['writer','screenplay','unrelated']) local.sqlite.prepare("INSERT INTO movie_provider_credits(movie_id,provider,item_key,kind,role,person_id,name,ordinal,fetched_at) VALUES (?,'tmdb',?,'crew',?,'1','Person',0,'2020')").run(active,role,role);
      for (const country of ['AU','US']) local.sqlite.prepare("INSERT INTO movie_provider_content_ratings(movie_id,provider,item_key,country,certification,release_type,fetched_at) VALUES (?,'tmdb',?,?,'M',3,'2020')").run(active,country,country);
      const before = local.sqlite.prepare('SELECT total_changes() n').get()!.n;
      const queries:string[] = [],original = local.db.prepare.bind(local.db),batch = vi.spyOn(local.db,'batch');
      vi.spyOn(local.db,'prepare').mockImplementation(sql => {queries.push(sql);if (!/^SELECT /i.test(sql)) throw new Error('Mutation forbidden');return original(sql);});
      const payload = await new MetricsRepository(local.db).enrichment();
      expect(queries).toHaveLength(11);expect(batch).toHaveBeenCalledTimes(2);expect(queries.filter(sql=>!sql.includes('sqlite_master')).every(sql => sql.includes('s.deleted_at IS NULL') && sql.includes('SELECT sm.movie_id'))).toBe(true);
      expect(Object.keys(payload.movies)).toEqual([active]);expect(payload.movies[active]).toMatchObject({metadata:{original_language:'ja',budget:10,revenue:30},keywords:[{provider:'mdblist',name:'MDB keyword'}],countries:[{code:'JP',name:'Japan'}],contentRatings:[{certification:'M',release_type:3}]});
      expect(payload.movies[active].credits.map(c => c.role).sort()).toEqual(['screenplay','writer']);
      expect(JSON.stringify(payload)).not.toMatch(/Provider title|Private irrelevant text|popularity|fetched_at|item_key|watch_offers|identity_claims/);
      expect(local.sqlite.prepare('SELECT total_changes() n').get()!.n).toBe(before);expect(fetch).not.toHaveBeenCalled();
      // Repeat History and many canonical films never change query count.
      queries.length = 0;
      await new MetricsRepository(local.db).enrichment();expect(queries).toHaveLength(11);
    } finally {local.sqlite.close();vi.unstubAllGlobals();vi.restoreAllMocks();}
  });
  it('authenticated route needs no provider credentials, returns partial cache and leaves catalog transports unchanged',async() => {
    const local = disposableD1();
    try {
      local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
      const env:Env = {DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173'};
      const response = await worker.fetch(new Request('http://api/api/v1/metrics/enrichment'),env);
      expect(response.status).toBe(200);expect(await response.json()).toEqual({data:{movies:{}}});
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      for (const path of ['/catalog','/catalog/compact']) {
        const json = await (await worker.fetch(new Request(`http://api/api/v1${path}`),env)).text();expect(json).not.toMatch(/contentRatings|keywords|original_language|companies/);
      }
      const unauthenticated = await worker.fetch(new Request('http://api/api/v1/metrics/enrichment'),{...env,APP_ENV:'production',LOCAL_WRITE_BYPASS:'false'});
      expect(unauthenticated.status).toBe(401);
    } finally {local.sqlite.close();}
  });
  it('older schemas fail safely with a retryable unavailable response',async() => {
    const local = disposableD1('0015_drop_redundant_score_index.sql');
    try {await expect(new MetricsRepository(local.db).enrichment()).rejects.toMatchObject({status:503,code:'METRICS_ENRICHMENT_UNAVAILABLE'});} finally {local.sqlite.close();}
  });
});
