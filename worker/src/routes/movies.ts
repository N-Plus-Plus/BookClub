import { z } from 'zod';
import { ApiError, json } from '../http';
import { classicSchema, idSchema, importSchema, movieSchema, seenSchema } from '../validation';

import { requireAdmin, requireViewer } from '../product-repository';

import type { RouteContext } from './context';

export async function moviesRoutes({request,url,path,method,repo,movies,auth,body}: RouteContext): Promise<Response | undefined> {
  const classicMatch = path.match(/^\/api\/v1\/movies\/([^/]+)\/classics$/);
  if (classicMatch && method === 'PUT') {
    const id = idSchema.parse(classicMatch[1]); const input = classicSchema.parse(await body(request)); if (!input.classic) { requireAdmin(auth.viewer); await repo.removeClassic(id); } else await repo.setClassic(id,true); return json(await movies.detail(id));
  }
  if (classicMatch && method === 'DELETE') { requireAdmin(auth.viewer); const id = idSchema.parse(classicMatch[1]); await repo.removeClassic(id); return json(await movies.detail(id)); }
  if (path === '/api/v1/movies/search' && method === 'GET') {
    const query = z.string().trim().min(1).max(150).parse(url.searchParams.get('q') ?? '');
    return json(await movies.search(query));
  }
  if (path === '/api/v1/movies/import' && method === 'POST') {
    const input = importSchema.parse(await body(request)); return json(await movies.import(input.provider,input.externalId),201);
  }
  const previewMatch = path.match(/^\/api\/v1\/movies\/preview\/tmdb\/([^/]+)$/);
  if (previewMatch && method === 'GET') return json(await movies.preview(importSchema.shape.externalId.parse(previewMatch[1])));
  if (path === '/api/v1/movies' && method === 'POST') {
    const id = await repo.manualMovie(movieSchema.parse(await body(request))); return json(await movies.detail(id),201);
  }
  const seenMatch = path.match(/^\/api\/v1\/movies\/([^/]+)\/seen\/([^/]+)$/);
  if (seenMatch && method === 'PUT') {
    const movieId = idSchema.parse(seenMatch[1]), memberId = idSchema.parse(seenMatch[2]);
    const actor = requireViewer(auth.viewer);
    if (actor.id !== memberId) throw new ApiError(403,'FORBIDDEN','You may only answer Seen It? for yourself.');
    const input = seenSchema.parse(await body(request)); await repo.setSeen(movieId,memberId,input.seen);
    return json(await movies.detail(movieId));
  }
  const movieMatch = path.match(/^\/api\/v1\/movies\/([^/]+)$/);
  if (movieMatch && method === 'GET') return json(await movies.detail(idSchema.parse(movieMatch[1])));
  return undefined;
}
