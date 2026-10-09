import { ZodError } from 'zod';
import { ApiError, allowedOrigins, authorizeMutation, localBypass, json, type Env } from './http';
import { Repository } from './repository';
import { MovieService } from './services';
import { ProductRepository } from './product-repository';
import { authenticate, login, verifyGoogle, type GoogleVerifier } from './auth';
import { AuthRepository } from './auth-repository';
import { maintenanceRoutes } from './routes/maintenance';
import { productRoutes } from './routes/product';
import { moviesRoutes } from './routes/movies';
import { catalogRoutes } from './routes/catalog';

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
    authenticationRequired: !localBypass(env), googleAuthConfigured: Boolean(env.GOOGLE_CLIENT_ID?.trim()), tmdbConfigured: Boolean(env.TMDB_READ_TOKEN), mdblistConfigured: Boolean(env.MDBLIST_API_KEY), omdbConfigured: Boolean(env.OMDB_API_KEY_PREMIUM || env.OMDB_API_KEY || env.OMDB_API_KEY_SECONDARY), demo: env.APP_ENV === 'local' });
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
  const context = {request,env,url,path,method,repo,movies,product,auth,body};
  // Maintenance names precede the selected-movie matcher, as in the public API.
  for (const handle of [maintenanceRoutes,productRoutes,moviesRoutes,catalogRoutes]) {
    const response = await handle(context);
    if (response) return response;
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
