export interface Env {
  DB: D1Database; APP_ENV: string; LOCAL_WRITE_BYPASS: string; ALLOWED_ORIGINS: string; TMDB_READ_TOKEN?: string; GOOGLE_CLIENT_ID?: string;
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function localBypass(env: Pick<Env, 'APP_ENV' | 'LOCAL_WRITE_BYPASS'>) {
  return env.APP_ENV === 'local' && env.LOCAL_WRITE_BYPASS === 'true';
}
export function authorizeMutation(env: Pick<Env, 'APP_ENV' | 'LOCAL_WRITE_BYPASS'>, viewer?: { id: string } | null) {
  if (localBypass(env) || viewer) return;
  throw new ApiError(401, 'SESSION_REQUIRED', 'Sign in to BookClub to continue.');
}
export function allowedOrigins(env: Pick<Env, 'ALLOWED_ORIGINS'>) {
  return env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
}
export function json(data: unknown, status = 200) { return Response.json({ data }, { status }); }
