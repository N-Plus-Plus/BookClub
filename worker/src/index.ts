import { z, ZodError } from 'zod';
import { ApiError, allowedOrigins, authorizeMutation, localBypass, json, type Env } from './http';
import { classicSchema, enrichmentSchema, idSchema, importSchema, movieSchema, seenSchema, sessionSchema } from './validation';
import { ScoreService } from './score-service';
import { Repository } from './repository';
import { MovieService } from './services';
import { authenticate, login, verifyGoogle, type GoogleVerifier } from './auth';
import { AuthRepository } from './auth-repository';
import { sortClassics } from '../../shared/ranking';
import { ProductRepository, requireAdmin, requireViewer } from './product-repository';
import { avatarSchema, builderSchema, publishSchema, revisionSchema, rotationSchema } from './validation';

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

async function route(request: Request, env: Env, verify: GoogleVerifier): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const repo = new Repository(env.DB), movies = new MovieService(repo,env), product = new ProductRepository(env.DB);
  if (!['GET','POST','PUT','DELETE','OPTIONS'].includes(method)) throw new ApiError(405,'METHOD_NOT_ALLOWED','Method not supported.');
  if (path === '/api/v1/health' && method === 'GET') return json({ status: 'ok', environment: env.APP_ENV,
    authenticationRequired: !localBypass(env), googleAuthConfigured: Boolean(env.GOOGLE_CLIENT_ID?.trim()), tmdbConfigured: Boolean(env.TMDB_READ_TOKEN), mdblistConfigured: Boolean(env.MDBLIST_API_KEY), omdbConfigured: Boolean(env.OMDB_API_KEY), demo: env.APP_ENV === 'local' });
  if (path === '/api/v1/auth/google' && method === 'POST') {
    const input = await body(request);
    return json(await login(input && typeof input === 'object' ? (input as {credential?: unknown}).credential : undefined,env,verify));
  }
  const auth = await authenticate(request,env);
  if (path === '/api/v1/auth/me' && method === 'GET') return json({ viewer: auth.viewer });
  if (path === '/api/v1/auth/logout' && method === 'POST') {
    if (auth.tokenHash) await new AuthRepository(env.DB).revoke(auth.tokenHash);
    return json({ loggedOut: true });
  }
  if (method !== 'GET' && method !== 'OPTIONS') authorizeMutation(env,auth.viewer);
  if (path === '/api/v1/avatars' && method === 'GET') { requireViewer(auth.viewer); return json(await product.availableAvatars()); }
  if (path === '/api/v1/auth/avatar' && method === 'POST') return json(await product.claimAvatar(requireViewer(auth.viewer),avatarSchema.parse(await body(request)).avatar));
  if (path === '/api/v1/rotation' && method === 'GET') return json(await product.rotation());
  if (path === '/api/v1/rotation/swap' && method === 'POST') {
    const actor = requireAdmin(auth.viewer); return json(await product.swapRotation(actor,rotationSchema.parse(await body(request))));
  }
  const builderMatch = path.match(/^\/api\/v1\/builders\/([^/]+)(?:\/(publish))?$/);
  if (path === '/api/v1/builders' || builderMatch) {
    const actor = requireViewer(auth.viewer), id = builderMatch ? idSchema.parse(builderMatch[1]) : undefined;
    if (!id && method === 'GET') return json(await product.builders(actor.id));
    if (!id && method === 'POST') return json(await product.saveBuilder(actor.id,builderSchema.parse(await body(request))),201);
    if (id && builderMatch?.[2] === 'publish' && method === 'POST') {
      const {revision,...input} = publishSchema.parse(await body(request));
      const sessionId = await product.publishBuilder(actor,id,revision,{...input,movie_ids: [],kind: input.cycle_slot === 5 ? 'classics' : 'hosted',date_precision: 'exact'});
      return json((await repo.catalog()).sessions.find(s => s.id === sessionId),201);
    }
    if (id && !builderMatch?.[2]) {
      if (method === 'GET') return json(await product.builder(actor.id,id));
      if (method === 'PUT') return json(await product.saveBuilder(actor.id,builderSchema.parse(await body(request)),id,true));
      if (method === 'DELETE') { await product.deleteBuilder(actor.id,id,revisionSchema.parse(await body(request)).revision); return json({deleted: true}); }
    }
    throw new ApiError(404,'NOT_FOUND','API route not found.');
  }
  const historyAction = path.match(/^\/api\/v1\/sessions\/([^/]+)\/(audit|restore)$/);
  if (historyAction) {
    const id = idSchema.parse(historyAction[1]);
    if (historyAction[2] === 'audit' && method === 'GET') return json(await product.auditTrail(id));
    if (historyAction[2] === 'restore' && method === 'POST') { await product.restoreSession(requireAdmin(auth.viewer),id); return json({restored: true}); }
  }
  if (path === '/api/v1/classics/enrich' && method === 'POST') {
    const input = enrichmentSchema.parse(await body(request)); return json(await new ScoreService(repo,env).enrich(input.limit));
  }
  if (path === '/api/v1/movies/enrich-metadata' && method === 'POST') {
    requireAdmin(auth.viewer);
    return json(await movies.enrichMetadata(enrichmentSchema.parse(await body(request)).limit));
  }
  const refreshMatch = path.match(/^\/api\/v1\/movies\/([^/]+)\/refresh-scores$/);
  if (refreshMatch && method === 'POST') return json(await new ScoreService(repo,env).refresh(idSchema.parse(refreshMatch[1])));
  const classicMatch = path.match(/^\/api\/v1\/movies\/([^/]+)\/classics$/);
  if (classicMatch && method === 'PUT') {
    const id = idSchema.parse(classicMatch[1]); await repo.setClassic(id,classicSchema.parse(await body(request)).classic); return json(await movies.detail(id));
  }
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
  const sessionMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)$/);
  if (sessionMatch && method === 'DELETE') { await product.deleteSession(auth.viewer,idSchema.parse(sessionMatch[1])); return json({deleted: true}); }
  if ((path === '/api/v1/sessions' && method === 'POST') || (sessionMatch && method === 'PUT')) {
    const input = sessionSchema.parse(await body(request));
    const id = await product.saveSession(input,auth.viewer,sessionMatch ? idSchema.parse(sessionMatch[1]) : undefined);
    return json((await repo.catalog()).sessions.find(s => s.id === id),sessionMatch ? 200 : 201);
  }
  if (method === 'GET' && ['/api/v1/catalog','/api/v1/members','/api/v1/movies','/api/v1/sessions','/api/v1/classics','/api/v1/cycles'].includes(path)) {
    const catalog = await repo.catalog();
    if (path.endsWith('/catalog')) return json(catalog);
    if (path.endsWith('/classics')) return json(sortClassics(catalog.movies.filter(m => m.classic)));
    if (path.endsWith('/members')) return json(catalog.members);
    if (path.endsWith('/cycles')) return json(catalog.cycles);
    if (path.endsWith('/movies')) return json(catalog.movies);
    return json(catalog.sessions);
  }
  if (sessionMatch && method === 'GET') {
    const session = (await repo.catalog()).sessions.find(s => s.id === idSchema.parse(sessionMatch[1]));
    if (!session) throw new ApiError(404,'NOT_FOUND','Event not found.'); return json(session);
  }
  throw new ApiError(404,'NOT_FOUND','API route not found.');
}

export function createWorker(verify: GoogleVerifier = verifyGoogle) { return {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const permitted = origin !== null && allowedOrigins(env).includes(origin);
    let response: Response;
    try {
      if (origin && !permitted) throw new ApiError(403,'ORIGIN_DENIED','This origin is not allowed.');
      if (request.method === 'OPTIONS') response = new Response(null,{ status: 204 });
      else response = await route(request,env,verify);
    } catch (error) {
      const known = error instanceof ApiError;
      const invalid = error instanceof ZodError;
      if (!known && !invalid) console.error('Unexpected Worker error',error);
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
      response.headers.set('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers',localBypass(env) ? 'Content-Type, Authorization, X-BookClub-Dev-Member' : 'Content-Type, Authorization');
    }
    return response;
  },
}; }
export default createWorker();
