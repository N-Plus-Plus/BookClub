import { describe, expect, it } from 'vitest';
import worker from '../worker/src/index';
import { authorizeMutation, type Env } from '../worker/src/http';
import { dateSchema, importSchema, movieSchema, seenSchema, sessionSchema } from '../worker/src/validation';

const env = { APP_ENV: 'local',LOCAL_WRITE_BYPASS: 'true',ALLOWED_ORIGINS: 'http://localhost:5173',DB: {} } as Env;
const errorBody = (response: Response) => response.json() as Promise<{error: {code: string; fields: unknown[]}}>;
describe('boundary validation',() => {
  it('validates real calendar dates',() => { expect(dateSchema.safeParse('2026-02-30').success).toBe(false); expect(dateSchema.safeParse('2024-02-29').success).toBe(true); });
  it('accepts any positive number of session films',() => { expect(sessionSchema.safeParse({event_date: '2026-10-04',movie_ids: []}).success).toBe(false); expect(sessionSchema.safeParse({event_date: '2026-10-04',movie_ids: ['a','b','c','d','e']}).success).toBe(true); });
  it('requires explicit boolean or null seen state',() => { for (const seen of [true,false,null]) expect(seenSchema.safeParse({seen}).success).toBe(true); expect(seenSchema.safeParse({seen: 'false'}).success).toBe(false); expect(seenSchema.safeParse({}).success).toBe(false); });
  it('trims titles and rejects invalid metadata',() => { expect(movieSchema.parse({title: '  Moon  '}).title).toBe('Moon'); expect(movieSchema.safeParse({title: ' ',runtime: -1}).success).toBe(false); expect(movieSchema.safeParse({title: 'Moon',year: 20}).success).toBe(false); });
  it('constrains external provider imports',() => { expect(importSchema.safeParse({provider: 'imdb',externalId: '42'}).success).toBe(false); expect(importSchema.safeParse({provider: 'tmdb',externalId: '../1'}).success).toBe(false); });
});
describe('write guard and CORS',() => {
  it('requires both explicit local flags',() => { expect(() => authorizeMutation(env)).not.toThrow(); expect(() => authorizeMutation({...env,APP_ENV: 'production'})).toThrow(); expect(() => authorizeMutation({...env,LOCAL_WRITE_BYPASS: 'false'})).toThrow(); });
  it('production mutations fail closed before database access',async () => { const response = await worker.fetch(new Request('http://api/api/v1/sessions',{method: 'POST',body: '{}'}),{...env,APP_ENV: 'production'}); expect(response.status).toBe(401); expect((await errorBody(response)).error.code).toBe('SESSION_REQUIRED'); });
  it('allows configured local preflights',async () => { const response = await worker.fetch(new Request('http://api/api/v1/sessions',{method: 'OPTIONS',headers: {Origin: 'http://localhost:5173'}}),env); expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173'); });
  it('rejects unconfigured origins',async () => { const response = await worker.fetch(new Request('http://api/api/v1/health',{headers: {Origin: 'https://untrusted.example'}}),env); expect(response.status).toBe(403); expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false); });
  it('reports invalid JSON safely',async () => { const response = await worker.fetch(new Request('http://api/api/v1/movies',{method: 'POST',body: '{'}),env); expect(response.status).toBe(400); expect((await errorBody(response)).error.code).toBe('INVALID_JSON'); });
  it('returns structured validation errors',async () => { const response = await worker.fetch(new Request('http://api/api/v1/sessions',{method: 'POST',body: JSON.stringify({event_date: 'invalid',movie_ids: []})}),env); expect(response.status).toBe(422); expect((await errorBody(response)).error.fields.length).toBeGreaterThan(0); });
  it('does not expose credentials through health',async () => { const response = await worker.fetch(new Request('http://api/api/v1/health'),{...env,TMDB_READ_TOKEN: 'test-token'}); const payload = await response.text(); expect(payload).toContain('tmdbConfigured'); expect(payload).not.toContain('test-token'); });
  it('rejects oversized input',async () => { const response = await worker.fetch(new Request('http://api/api/v1/movies',{method: 'POST',body: ' '.repeat(131073)}),env); expect(response.status).toBe(413); });
});
