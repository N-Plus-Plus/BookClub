import type { ExternalId } from './types';

export type EnrichmentProvider = 'tmdb' | 'mdblist';
export const providerEnrichmentTables=['movie_provider_metadata','movie_provider_countries','movie_provider_languages','movie_provider_companies','movie_provider_credits','movie_provider_content_ratings','movie_provider_keywords','movie_provider_watch_offers','movie_provider_identity_claims','movie_provider_enrichment_state'] as const;
export interface EnrichmentCapture {
  provider: EnrichmentProvider; identity: ExternalId; fetchedAt: string;
  metadata: {title?: string | null; runtime?: number | null; original_language?: string | null; budget?: number | null; revenue?: number | null; popularity?: number | null; tagline?: string | null};
  countries?: {code: string; name: string | null}[];
  languages?: {code: string; name: string | null; english_name: string | null}[];
  companies?: {external_id: string; name: string; origin_country: string | null}[];
  credits?: {kind: string; role: string; person_id: string; name: string; original_name: string | null; department: string | null; job: string | null; character: string | null; billing_order: number | null; credit_id: string | null; ordinal: number}[];
  content_ratings?: {country: string; certification: string; release_type: number | null; release_date: string | null}[];
  keywords?: {external_id: string | null; name: string}[];
  watch_offers?: {collection: string; service_id: string; name: string; country: string | null; access_type: string | null; link: string | null; ordinal: number}[];
  identities?: ExternalId[];
}
export interface EnrichmentBatch {
  results: {movieId: string; status: 'updated' | 'no_change' | 'failed' | 'skipped'; message: string; blocking?: boolean; retryAfter?: number; conflicts?: number}[];
  canonicalChanged: boolean; quota?: Record<string,string>; stopped?: boolean;
}
export function enrichmentIdentity(ids: ExternalId[], provider: EnrichmentProvider) {
  const tmdb = ids.find(e => e.provider === 'tmdb' && /^[1-9]\d{0,9}$/.test(e.external_id));
  return provider === 'tmdb' ? tmdb : ids.find(e => e.provider === 'imdb' && /^tt\d{7,10}$/.test(e.external_id)) ?? tmdb;
}
