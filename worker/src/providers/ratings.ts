import { normalizeScore } from '../../../shared/ranking';
import type { Score } from '../../../shared/types';
import { ApiError } from '../http';
export class RatingError extends ApiError {
  constructor(message: string, public retryAfter?: number) { super(503,'SCORE_PROVIDER_UNAVAILABLE',message); }
}
export async function ratingRequest(url: string, provider: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url,{...init,signal: AbortSignal.timeout(8000),headers: {Accept: 'application/json',...init?.headers}});
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      const delay = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header)-Date.now())/1000) : NaN;
      throw new RatingError(`${provider} rate limit reached. Try later.`,Number.isFinite(delay) ? Math.max(0,Math.min(delay,86400)) : undefined);
    }
    if (!response.ok) throw new RatingError(`${provider} lookup is unavailable. Check Worker configuration or try later.`);
    return await response.json();
  } catch (error) {
    if (error instanceof RatingError) throw error;
    throw new RatingError(`${provider} could not return usable data. Try later.`);
  }
}
export function record(provider: string, metric: string, value: unknown, scale: number, via: string, at: string, votes?: unknown): Score | null {
  // Empty, absent and N/A never become zero.
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value.trim()))) return null;
  const raw_value = Number(value), normalized_value = normalizeScore(raw_value,scale);
  if (normalized_value === null) return null;
  const count = typeof votes === 'number' ? votes : typeof votes === 'string' && /^\d[\d,]*$/.test(votes) ? Number(votes.replaceAll(',','')) : NaN;
  return {provider,metric,raw_value,raw_scale: scale,normalized_value,vote_count: Number.isSafeInteger(count) && count >= 0 ? count : null,fetched_at: at,retrieved_via: via};
}
