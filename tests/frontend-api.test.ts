import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const storage = new Map<string,string>();
beforeEach(() => {
  vi.resetModules(); storage.clear();
  vi.stubGlobal('localStorage',{
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string,value: string) => storage.set(key,value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});
it('local Vite always targets local API despite stale production variables',async () => {
  vi.stubEnv('DEV',true); vi.stubEnv('VITE_API_BASE_URL','https://bookclub-api.troy-nissen.workers.dev');
  const fetch = vi.fn(async (_url: string) => Response.json({data:{}})); vi.stubGlobal('fetch',fetch);
  const {api} = await import('../frontend/api'); await api.health();
  expect(fetch.mock.calls[0][0]).toBe('http://localhost:8787/api/v1/health');
});
it('production requires a public API origin and uses it when configured',async () => {
  vi.stubEnv('DEV',false); vi.stubEnv('VITE_API_BASE_URL','');
  const fetch = vi.fn(async (_url: string) => Response.json({data:{}})); vi.stubGlobal('fetch',fetch);
  await expect((await import('../frontend/api')).api.health()).rejects.toThrow('Set VITE_API_BASE_URL');
  expect(fetch).not.toHaveBeenCalled();
  vi.resetModules(); vi.stubEnv('VITE_API_BASE_URL','https://bookclub-api.troy-nissen.workers.dev');
  await (await import('../frontend/api')).api.health();
  expect(fetch.mock.calls[0][0]).toBe('https://bookclub-api.troy-nissen.workers.dev/api/v1/health');
});
it('restores the saved bearer centrally and keeps public endpoints token-free',async () => {
  const token = 'c'.repeat(64); storage.set('bookclub.session',token);
  const fetch = vi.fn(async () => Response.json({data: {}})); vi.stubGlobal('fetch',fetch);
  const {api,hasSession} = await import('../frontend/api'); expect(hasSession()).toBe(true);
  await api.me(); expect(fetch.mock.calls[0]).toEqual(expect.arrayContaining([expect.any(String),expect.objectContaining({headers: {Authorization: `Bearer ${token}`}})]));
  await api.health(); expect(fetch.mock.calls[1]).toEqual(expect.arrayContaining([expect.any(String),expect.objectContaining({headers: {}})]));
  await api.googleLogin('fake-google-credential');
  expect(storage.get('bookclub.session')).toBe(token);
  expect(fetch.mock.calls[2]).toEqual(expect.arrayContaining([expect.any(String),expect.objectContaining({headers: {'Content-Type':'application/json'},body: JSON.stringify({credential:'fake-google-credential'})})]));
});
it('clears a rejected session and distinguishes 401 without exposing a token',async () => {
  const token = 'd'.repeat(64); storage.set('bookclub.session',token);
  vi.stubGlobal('fetch',vi.fn(async () => Response.json({error:{message:'Sign in again.'}},{status:401})));
  const {api,hasSession,setUnauthorizedHandler} = await import('../frontend/api');
  const rejected = vi.fn(); setUnauthorizedHandler(rejected);
  await expect(api.catalog()).rejects.toMatchObject({status:401,message:'Sign in again.'});
  expect(rejected).toHaveBeenCalledOnce(); expect(hasSession()).toBe(false); expect(storage.size).toBe(0);
});
it('does not clear BookClub session when Google login returns an ordinary 403',async () => {
  const token = 'e'.repeat(64); storage.set('bookclub.session',token);
  vi.stubGlobal('fetch',vi.fn(async () => Response.json({error:{message:'Account not authorised.'}},{status:403})));
  const {api,hasSession,setUnauthorizedHandler} = await import('../frontend/api'); const rejected = vi.fn(); setUnauthorizedHandler(rejected);
  await expect(api.googleLogin('mock')).rejects.toMatchObject({status:403}); expect(rejected).not.toHaveBeenCalled(); expect(hasSession()).toBe(true);
});
