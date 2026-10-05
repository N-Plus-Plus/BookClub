import { normalizeScore } from '../../../shared/ranking';
import type { Score } from '../../../shared/types';
import { ProviderError, providerJson } from './http';
export class RatingError extends ProviderError { constructor(message: string, retryAfter?: number) { super('rating','outage',message,retryAfter); } }
export async function ratingRequest(url: string, provider: string, init?: RequestInit, onLimits?: (headers: Headers) => Promise<void>): Promise<unknown> {
  return providerJson(url,provider,init,onLimits);
}
export function record(provider: string, metric: string, value: unknown, scale: number, via: string, at: string, votes?: unknown): Score | null {
  // Empty, absent and N/A never become zero.
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value.trim()))) return null;
  const raw_value = Number(value), normalized_value = normalizeScore(raw_value,scale);
  if (normalized_value === null) return null;
  const count = typeof votes === 'number' ? votes : typeof votes === 'string' && /^\d[\d,]*$/.test(votes) ? Number(votes.replaceAll(',','')) : NaN;
  return {provider,metric,raw_value,raw_scale: scale,normalized_value,vote_count: Number.isSafeInteger(count) && count >= 0 ? count : null,fetched_at: at,retrieved_via: via};
}
