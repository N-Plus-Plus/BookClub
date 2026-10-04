import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { localId } from './snapshot.ts';
import { Repository } from '../../worker/src/repository.ts';
import { ProductRepository } from '../../worker/src/product-repository.ts';
import { calculateMetrics } from '../../shared/metrics.ts';
import { sortClassics } from '../../shared/ranking.ts';

export async function verifyReplacement(persistence: string) {
  const require = createRequire(import.meta.url), wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
  const {Miniflare,convertV4MiniflareOptions,NoOpLog} = wranglerRequire('miniflare');
  const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:'',resourcePersistencePath:resolve(persistence,'v3'),d1Databases:{DB:localId},log:new NoOpLog()}));
  try {
    const db: D1Database = await mf.getD1Database('DB');
    const catalog = await new Repository(db).catalog();
    calculateMetrics(catalog); sortClassics(catalog.movies.filter(m => m.classic));
    const product = new ProductRepository(db);
    await product.rotation();
    for (const member of catalog.members) await product.builders(member.id);
    if (!catalog.movies.length || catalog.members.filter(m => m.active).length !== 4 || (await db.prepare('PRAGMA foreign_key_check').all()).results.length || (await db.prepare('SELECT count(*) n FROM auth_sessions').first<{n:number}>())?.n !== 0) throw new Error('Refreshed local application verification failed.');
  } finally { await mf.dispose(); }
}
