export interface Env {
  DB: D1Database; APP_ENV: string; LOCAL_WRITE_BYPASS: string; ALLOWED_ORIGINS: string; TMDB_READ_TOKEN?: string;
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function authorizeMutation(env: Pick<Env, 'APP_ENV' | 'LOCAL_WRITE_BYPASS'>) {
  // Deliberately fail closed in every deployed environment. Future auth lives here.
  if (env.APP_ENV === 'local' && env.LOCAL_WRITE_BYPASS === 'true') return;
  throw new ApiError(403, 'WRITES_LOCKED', 'Writes are disabled until Book Club authentication is configured.');
}
export function allowedOrigins(env: Pick<Env, 'ALLOWED_ORIGINS'>) {
  return env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
}
export function json(data: unknown, status = 200) { return Response.json({ data }, { status }); }
