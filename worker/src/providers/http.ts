import { ApiError } from '../http';

export type ProviderFailureKind = 'not_found' | 'credentials' | 'rate_limited' | 'outage' | 'network';
export class ProviderError extends ApiError {
  constructor(public provider: string, public kind: ProviderFailureKind, message: string, public retryAfter?: number, public rateLimit?: Record<string,string>) {
    super(kind === 'not_found' ? 404 : 503, kind === 'credentials' ? 'PROVIDER_NOT_CONFIGURED' : kind === 'rate_limited' ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE', message);
  }
}
export function retryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = /^\s*\d+\s*$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(0,Math.min(seconds,86400)) : undefined;
}
export function rateLimitHeaders(headers: Headers) {
  const values: Record<string,string> = {};
  for (const key of ['X-RateLimit-Limit','X-RateLimit-Remaining','X-RateLimit-Reset','Retry-After']) { const value = headers.get(key); if (value) values[key] = value; }
  return Object.keys(values).length ? values : undefined;
}
export async function providerJson(url: string, provider: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url,{...init,signal: AbortSignal.timeout(8000),headers:{Accept:'application/json',...init?.headers}}); }
  catch { throw new ProviderError(provider,'network',`${provider} could not be reached. Try later.`); }
  const limits = rateLimitHeaders(response.headers);
  if (response.status === 404) throw new ProviderError(provider,'not_found',`${provider} could not find this film.`);
  if (response.status === 401 || response.status === 403) throw new ProviderError(provider,'credentials',`${provider} credentials are unavailable. Contact the administrator.`);
  if (response.status === 429) throw new ProviderError(provider,'rate_limited',`${provider} rate limit reached. Try later.`,retryAfter(response.headers.get('Retry-After')),limits);
  if (response.status >= 500) throw new ProviderError(provider,'outage',`${provider} is temporarily unavailable. Try later.`,undefined,limits);
  if (!response.ok) throw new ProviderError(provider,'outage',`${provider} lookup is unavailable. Try later.`,undefined,limits);
  try { return await response.json(); } catch { throw new ProviderError(provider,'outage',`${provider} returned an unusable response.`); }
}
