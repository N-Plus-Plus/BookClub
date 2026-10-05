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

it('retains API field paths for local form validation',async () => {
  vi.stubEnv('DEV',true);
  const fields = [{path:'movie_ids.0',message:'Choose a saved film.'},{path:'event_date',message:'Invalid date.'}];
  vi.stubGlobal('fetch',vi.fn(async () => Response.json({error:{message:'Invalid event.',fields}},{status:422})));
  const {api} = await import('../frontend/api');
  await expect(api.catalog()).rejects.toMatchObject({status:422,fields});
});


it('uses a human historical turn label in Builder validation errors while retaining field paths',async () => {
  vi.stubEnv('DEV',true);
  const fields = [{path:'cycle_slot',message:'Choose a cycle for this historical turn.'}];
  vi.stubGlobal('fetch',vi.fn(async () => Response.json({error:{message:'Invalid event.',fields}},{status:422})));
  const {api} = await import('../frontend/api');
  await expect(api.publishBuilder('set',{revision:0,event_date:'2026-01-01',cycle_id:null,cycle_slot:1,complete_turn:false})).rejects.toMatchObject({fields,message:'Historical turn: Choose a cycle for this historical turn.'});
});

it('bounds browser TMDB maintenance to two films and retains ordinary request timeouts',async()=>{
 vi.stubEnv('DEV',true);
 const timeout=vi.spyOn(AbortSignal,'timeout');
 const fetch=vi.fn(async(_url:string,_init:RequestInit)=>Response.json({data:{members:[],movies:[],sessions:[],cycles:[]}}));vi.stubGlobal('fetch',fetch);
 try {
  const {api}=await import('../frontend/api');
  await api.enrichMetadata();await api.enrichMetadata(10);await api.enrichMetadata(1);
  expect(fetch.mock.calls.map(([,init])=>JSON.parse(init.body as string).limit)).toEqual([2,2,1]);
  await api.catalog();await api.me();await api.seen('film','member',true);
  expect(timeout.mock.calls.map(([ms])=>ms)).toEqual([105000,105000,105000,15000,15000,15000]);
 } finally {timeout.mockRestore();}
});

it('hydrates compact references and falls back only when an older Worker lacks the capability',async () => {
  vi.stubEnv('DEV',true);
  const movie={id:'film',title:'Fixture'},wire={members:[],cycles:[],movies:[movie],sessions:[{id:'event',movie_ids:['film','film']}]};
  const fetch=vi.fn(async(_url:string)=>Response.json({data:wire}));vi.stubGlobal('fetch',fetch);
  const {api}=await import('../frontend/api');const catalog=await api.catalog();
  expect(fetch.mock.calls).toHaveLength(1);expect(catalog.sessions[0].movies).toEqual([movie,movie]);expect(catalog.sessions[0].movies[0]).toBe(catalog.movies[0]);
  fetch.mockResolvedValueOnce(Response.json({error:{message:'API route not found.'}},{status:404}));
  fetch.mockResolvedValueOnce(Response.json({data:catalog}));expect(await api.catalog()).toEqual(catalog);
  expect(fetch.mock.calls[1][0]).toMatch(/catalog\/compact$/);expect(fetch.mock.calls[2][0]).toMatch(/catalog$/);
  fetch.mockResolvedValueOnce(Response.json({error:{message:'Database unavailable.'}},{status:500}));await expect(api.catalog()).rejects.toMatchObject({status:500});expect(fetch).toHaveBeenCalledTimes(4);
});
