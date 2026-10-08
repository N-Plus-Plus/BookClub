import { json } from '../http';
import { idSchema } from '../validation';

import { MetricsRepository } from '../metrics-repository';

import { sortClassics } from '../../../shared/ranking';

import type { RouteContext } from './context';

export async function catalogRoutes({env,path,method,repo}: RouteContext): Promise<Response | undefined> {
  const sessionMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)$/);
  if (path === '/api/v1/metrics/enrichment' && method === 'GET') return json(await new MetricsRepository(env.DB).enrichment());
  if (path === '/api/v1/catalog/compact' && method === 'GET') return json(await repo.compactCatalog());
  if (method === 'GET' && ['/api/v1/catalog','/api/v1/members','/api/v1/movies','/api/v1/sessions','/api/v1/classics','/api/v1/cycles'].includes(path)) {
    if (path.endsWith('/catalog')) return json(await repo.catalog());
    if (path.endsWith('/classics')) return json(sortClassics(await repo.movies(true)));
    if (path.endsWith('/members')) return json(await repo.members());
    if (path.endsWith('/cycles')) return json(await repo.cycles());
    if (path.endsWith('/movies')) return json(await repo.movies());
    return json(await repo.sessions());
  }
  if (sessionMatch && method === 'GET') {
    return json(await repo.session(idSchema.parse(sessionMatch[1])));
  }
  return undefined;
}
