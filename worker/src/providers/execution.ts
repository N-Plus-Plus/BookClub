import { ProviderError } from './http';

export interface CooldownStore {
  providerCooldown?: (provider: string, readOnly?: boolean) => Promise<number | null>;
  setProviderCooldown?: (provider: string, seconds: number) => Promise<void>;
}
/** Common request gate; workflow quota decisions and failover remain with callers. */
export async function executeProvider<T>(store: CooldownStore, identity: string, operation: () => Promise<T>, options: {
  readOnly?: boolean; provider?: string; cooldownMessage?: string; onFailure?: (error: ProviderError) => void;
} = {}): Promise<T> {
  const wait = await store.providerCooldown?.(identity,options.readOnly ?? false) ?? null;
  if (wait !== null) throw new ProviderError(options.provider ?? identity,'rate_limited',options.cooldownMessage ?? `${identity} is cooling down after a rate limit. Try later.`,wait);
  try { return await operation(); }
  catch (error) {
    if (error instanceof ProviderError) {
      options.onFailure?.(error);
      if (!options.readOnly && error.kind === 'rate_limited') await store.setProviderCooldown?.(identity,Math.max(0,Math.min(error.retryAfter ?? 60,86400)));
    }
    throw error;
  }
}
/** Successful quota headers: callers choose their own exhaustion/reserve threshold. */
export function quotaCooldown(headers: Headers, now = Date.now()): number {
  const reset = Number(headers.get('X-RateLimit-Reset'));
  return Number.isFinite(reset) && reset > now/1000 ? Math.min(Math.ceil(reset-now/1000),86400) : 60;
}
