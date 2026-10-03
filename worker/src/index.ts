import { z, ZodError } from 'zod';
import { ApiError, allowedOrigins, authorizeMutation, json, type Env } from './http';
import { idSchema, importSchema, movieSchema, seenSchema, sessionSchema } from './validation';
import { Repository } from './repository';
import { MovieService } from './services';
import { sortClassics } from '../../shared/ranking';

async function body(request: Request): Promise<unknown> {
  // Bound JSON input before parsing, including requests without Content-Length.
  if (Number(request.headers.get('Content-Length')) > 131072) throw new ApiError(413,'BODY_TOO_LARGE','Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400,'INVALID_JSON','Send a JSON request body.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value,done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 131072) { await reader.cancel(); throw new ApiError(413,'BODY_TOO_LARGE','Request is too large.'); }
    chunks.push(value);
  }
  const combined = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { combined.set(chunk,offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(combined)); }
  catch { throw new ApiError(400,'INVALID_JSON','Send a valid JSON request body.'); }
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const repo = new Repository(env.DB), movies = new MovieService(repo,env);
  if (!['GET','POST','PUT','OPTIONS'].includes(method)) throw new ApiError(405,'METHOD_NOT_ALLOWED','Method not supported.');
  if (method !== 'GET' && method !== 'OPTIONS') authorizeMutation(env);
  if (path === '/api/v1/health' && method === 'GET') return json({ status: 'ok', environment: env.APP_ENV,
    writesEnabled: env.APP_ENV === 'local' && env.LOCAL_WRITE_BYPASS === 'true', tmdbConfigured: Boolean(env.TMDB_READ_TOKEN), demo: env.APP_ENV === 'local' });
  if (path === '/api/v1/movies/search' && method === 'GET') {
    const query = z.string().trim().min(1).max(150).parse(url.searchParams.get('q') ?? '');
    return json(await movies.search(query));
  }
  if (path === '/api/v1/movies/import' && method === 'POST') {
    const input = importSchema.parse(await body(request)); return json(await movies.import(input.provider,input.externalId),201);
  }
  if (path === '/api/v1/movies' && method === 'POST') {
    const id = await repo.manualMovie(movieSchema.parse(await body(request))); return json(await movies.detail(id),201);
  }
  const seenMatch = path.match(/^\/api\/v1\/movies\/([^/]+)\/seen\/([^/]+)$/);
  if (seenMatch && method === 'PUT') {
    const movieId = idSchema.parse(seenMatch[1]), memberId = idSchema.parse(seenMatch[2]);
    const input = seenSchema.parse(await body(request)); await repo.setSeen(movieId,memberId,input.seen);
    return json(await movies.detail(movieId));
  }
  const movieMatch = path.match(/^\/api\/v1\/movies\/([^/]+)$/);
  if (movieMatch && method === 'GET') return json(await movies.detail(idSchema.parse(movieMatch[1])));
  const sessionMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)$/);
  if ((path === '/api/v1/sessions' && method === 'POST') || (sessionMatch && method === 'PUT')) {
    const input = sessionSchema.parse(await body(request));
    const id = await repo.saveSession(input,sessionMatch ? idSchema.parse(sessionMatch[1]) : undefined);
    return json((await repo.catalog()).sessions.find(s => s.id === id),sessionMatch ? 200 : 201);
  }
  if (method === 'GET' && ['/api/v1/catalog','/api/v1/members','/api/v1/movies','/api/v1/sessions','/api/v1/classics'].includes(path)) {
    const catalog = await repo.catalog();
    if (path.endsWith('/catalog')) return json(catalog);
    if (path.endsWith('/classics')) return json(sortClassics(catalog.movies.filter(m => m.classic)));
    if (path.endsWith('/members')) return json(catalog.members);
    if (path.endsWith('/movies')) return json(catalog.movies);
    return json(catalog.sessions);
  }
  if (sessionMatch && method === 'GET') {
    const session = (await repo.catalog()).sessions.find(s => s.id === idSchema.parse(sessionMatch[1]));
    if (!session) throw new ApiError(404,'NOT_FOUND','Event not found.'); return json(session);
  }
  throw new ApiError(404,'NOT_FOUND','API route not found.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const permitted = origin !== null && allowedOrigins(env).includes(origin);
    let response: Response;
    try {
      if (origin && !permitted) throw new ApiError(403,'ORIGIN_DENIED','This origin is not allowed.');
      if (request.method === 'OPTIONS') response = new Response(null,{ status: 204 });
      else response = await route(request,env);
    } catch (error) {
      const known = error instanceof ApiError;
      const invalid = error instanceof ZodError;
      response = Response.json({ error: {
        code: known ? error.code : invalid ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: known ? error.message : invalid ? 'Check the submitted fields.' : 'The API could not complete this request.',
        ...(invalid ? { fields: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) } : {}),
      } },{ status: known ? error.status : invalid ? 422 : 500 });
    }
    response.headers.set('Vary','Origin');
    response.headers.set('Cache-Control','no-store');
    response.headers.set('X-Content-Type-Options','nosniff');
    if (permitted) {
      response.headers.set('Access-Control-Allow-Origin',origin!);
      response.headers.set('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers','Content-Type');
    }
    return response;
  },
};
