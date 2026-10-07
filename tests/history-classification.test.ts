import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { disposableD1 } from './d1';
import { Repository } from '../worker/src/repository';
import { MetricsRepository } from '../worker/src/metrics-repository';
import { australianClassification } from '../shared/metrics-enrichment';
it('catalogue resolves the same AU theatrical/severity category as Metrics in one set query without provider calls or raw enrichment transport',async()=>{
 const local=disposableD1();vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Provider request forbidden');}));
 try {
  local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  for (const [key,country,certification,type] of [['au-m','AU','M',3],['au-ma','AU',' ma15 ',2],['au-r','AU','R18+',4],['us-r','US','R18+',3]] as const)
   local.sqlite.prepare("INSERT INTO movie_provider_content_ratings(movie_id,provider,item_key,country,certification,release_type,fetched_at) VALUES ('arrival','tmdb',?,?,?,?, '2026')").run(key,country,certification,type);
  const queries:string[]=[],prepare=local.db.prepare.bind(local.db);vi.spyOn(local.db,'prepare').mockImplementation(sql=>{queries.push(sql);return prepare(sql);});
  const before=local.sqlite.prepare('SELECT total_changes() n').get()!.n;
  const catalog=await new Repository(local.db).catalog();expect(catalog.movies.find(m=>m.id==='arrival')!.au_classification).toBe('MA15+');
  expect(queries.filter(sql=>sql.includes('FROM movie_provider_content_ratings'))).toHaveLength(1);
  expect(catalog.movies.find(m=>m.id==='alien')!.au_classification).toBeUndefined();expect(JSON.stringify(catalog)).not.toMatch(/contentRatings|release_type|keywords|original_language/);
  const metrics=await new MetricsRepository(local.db).enrichment();expect(australianClassification(metrics.movies.arrival)).toBe(catalog.movies.find(m=>m.id==='arrival')!.au_classification);
  expect(local.sqlite.prepare('SELECT total_changes() n').get()!.n).toBe(before);expect(fetch).not.toHaveBeenCalled();
 } finally {local.sqlite.close();vi.unstubAllGlobals();vi.restoreAllMocks();}
});
it('pre-cache schemas keep ordinary History catalogue reads available',async()=>{
 const local=disposableD1('0015_drop_redundant_score_index.sql');try {local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));const catalog=await new Repository(local.db).compactCatalog();expect(catalog.movies.every(m=>m.au_classification===undefined)).toBe(true);} finally {local.sqlite.close();}
});
