import type { Asset, ExternalId, Score, SearchResult } from '../../../shared/types';
export interface ProviderMovie {
  title: string; original_title: string | null; year: number | null; release_date: string | null;
  runtime: number | null; overview: string | null; genres: string[];
  external_ids: ExternalId[]; assets: Asset[]; scores: Score[]; fetched_at: string;
}
export interface MovieSearchProvider { search(query: string): Promise<SearchResult[]> }
export interface MovieMetadataProvider { details(id: string): Promise<ProviderMovie> }
export interface MovieArtworkProvider { artwork(id: string): Promise<Asset[]> }
export interface MovieScoreProvider { scores(id: string): Promise<Score[]> }
// Future lawful IMDb/OMDb adapters implement these interfaces. No scraping or fake API calls.
