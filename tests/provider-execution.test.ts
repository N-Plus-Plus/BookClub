import { expect, it, vi } from 'vitest';
import { executeProvider, quotaCooldown } from '../worker/src/providers/execution';
import { ProviderError, retryAfter } from '../worker/src/providers/http';
it.each([true,false])('suppresses active cooldown without requests or cooldown writes (readOnly=%s)',async readOnly=>{
  const store={providerCooldown:vi.fn(async()=>42),setProviderCooldown:vi.fn()},call=vi.fn();
  await expect(executeProvider(store,'tmdb',call,{readOnly})).rejects.toMatchObject({kind:'rate_limited',retryAfter:42});
  expect(call).not.toHaveBeenCalled();expect(store.setProviderCooldown).not.toHaveBeenCalled();expect(store.providerCooldown).toHaveBeenCalledWith('tmdb',readOnly);
});
it.each([true,false])('persists rate-limit cooldown only on writable operations (readOnly=%s)',async readOnly=>{
  const store={providerCooldown:vi.fn(async()=>null),setProviderCooldown:vi.fn()},error=new ProviderError('TMDB','rate_limited','Wait',120);
  const call=vi.fn(async()=>{throw error;});
  await expect(executeProvider(store,'tmdb',call,{readOnly})).rejects.toBe(error);
  expect(call).toHaveBeenCalledOnce();expect(store.setProviderCooldown).toHaveBeenCalledTimes(readOnly?0:1);
  if (!readOnly) expect(store.setProviderCooldown).toHaveBeenCalledWith('tmdb',120);
});
it('preserves successful values and exposes safe failure quota metadata without extra calls',async()=>{
  const store={providerCooldown:vi.fn(async()=>null),setProviderCooldown:vi.fn()},operation=vi.fn(async()=>7);
  expect(await executeProvider(store,'mdblist',operation)).toBe(7);expect(operation).toHaveBeenCalledOnce();
  const quota={'X-RateLimit-Remaining':'0'},onFailure=vi.fn(),error=new ProviderError('MDBList','outage','Unavailable',undefined,quota);
  await expect(executeProvider(store,'mdblist',async()=>{throw error;},{onFailure})).rejects.toBe(error);
  expect(onFailure).toHaveBeenCalledWith(error);expect(store.setProviderCooldown).not.toHaveBeenCalled();
});
it('bounds Retry-After/reset and defaults unusable or expired reset',()=>{
  const now=1000000;
  expect(retryAfter('999999',now)).toBe(86400);
  expect(quotaCooldown(new Headers({'Retry-After':'0','X-RateLimit-Reset':'2000'}),now)).toBe(1000);
  expect(quotaCooldown(new Headers({'X-RateLimit-Reset':'1030'}),now)).toBe(30);
  expect(quotaCooldown(new Headers({'X-RateLimit-Reset':'999999999999'}),now)).toBe(86400);
  for (const reset of ['garbage','900','Infinity']) expect(quotaCooldown(new Headers({'X-RateLimit-Reset':reset}),now)).toBe(60);
});
