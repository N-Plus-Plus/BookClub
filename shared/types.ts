export interface Viewer { id: string; display_name: string; avatar: number | null; role: 'member' | 'admin'; sort_order: number }
export interface AuthLogin { token: string; viewer: Viewer; expiresAt: string }
export interface Member { id: string; display_name: string; sort_order: number; active: number; avatar?: number | null }
export interface Score { provider: string; metric: string; raw_value: number; raw_scale: number | null; normalized_value: number | null; vote_count: number | null; fetched_at: string; retrieved_via?: string; upstream_updated_at?: string | null; source_ref?: string; source_ordinal?: number | null; legacy_preferred?: number }
export interface Asset { provider: string; asset_type: 'poster' | 'backdrop'; reference: string; width: number | null; height: number | null; preferred: number }
export interface ExternalId { provider: string; external_id: string }
export interface SeenAnswer { member_id: string; seen: number; updated_at: string }
export interface Ranking {
  rawScore: number | null; seenCount: number; unseenCount: number; unknownCount: number;
  unseenMultiplier: number; tieBreak: number; residualScore: number | null; finalScore: number | null;
  rankable: boolean; eligible: boolean; missingRequiredScores: string[]; warnings: string[];
  sources: { provider: string; metric: string; value: number; retrieved_via: string }[];
}
export interface Movie {
  id: string; title: string; original_title: string | null; year: number | null;
  release_date: string | null; runtime: number | null; overview: string | null;
  tmdb_metadata_checked_at?: string | null;
  tmdb_artwork_checked_at?: string | null;
  genres: string[]; assets: Asset[]; external_ids: ExternalId[]; scores: Score[];
  seen: SeenAnswer[]; classic: boolean; ranking: Ranking | null;
  classics_membership?: { rank_seed: number; added_at: string; source: string | null } | null;
}
export interface Session {
  deleted_at?: string | null;
  id: string; event_date: string; host_member_id: string | null;
  legacy_cycle_label: string | null; movies: Movie[];
  planned_at?: string | null; published_by?: string | null; completed_turn_version?: number | null;
  cycle_id: string | null; kind: 'hosted' | 'classics'; date_precision: 'exact' | 'cycle_rough' | 'unknown'; cycle_slot: number | null;
}
export interface Cycle { id: string; ordinal: number; rough_date: string; title: string | null; import_source: string | null; import_key: string | null; created_at: string; updated_at: string }
export interface CycleInput { rough_date: string; title?: string; ordinal?: number }
export interface MovieDetail extends Movie { appearances: { id: string; event_date: string; date_precision: Session['date_precision']; kind: Session['kind']; position: number }[] }
export interface Catalog { members: Member[]; movies: Movie[]; sessions: Session[]; cycles: Cycle[] }
export interface SearchResult { provider: string; externalId: string; title: string; year: number | null; poster: string | null }
export interface SavedSearchResult { id: string; title: string; year: number | null; tmdbId: string | null; poster: string | null }
export interface SearchResponse { local: SavedSearchResult[]; external: SearchResult[]; lookup: { available: boolean; message: string | null } }
export interface TmdbPreview {
  provider: 'tmdb'; externalId: string; title: string; original_title: string | null; year: number | null;
  release_date: string | null; runtime: number | null; overview: string | null; genres: string[]; assets: Asset[]; director: string | null;
}
export type FilmCandidate = {kind: 'local'; movie: SavedSearchResult} | {kind: 'external'; movie: SearchResult};
export interface Rotation { id: number; cycle_id: string | null; nominal_slot: number; version: number; updated_at: string; human_order?: Record<string,string> }
export interface BuilderSet { id: string; owner_member_id: string; title: string | null; notes: string | null; created_at: string; updated_at: string; revision: number; movie_ids: string[] }
export interface BuilderInput { title?: string; notes?: string; movie_ids: string[]; revision?: number }
export interface BuilderPublishInput { revision: number; event_date: string; cycle_id: string | null; cycle_slot: number; complete_turn: boolean; turn_version?: number; new_cycle?: CycleInput }
export interface HistoryAudit { id: string; actor_member_id: string | null; session_id: string | null; action: string; occurred_at: string; changes_json: string }
export interface SessionInput { correct_anchor?: boolean; complete_turn?: boolean; turn_version?: number; event_date: string; host_member_id?: string | null; legacy_cycle_label?: string; movie_ids: string[]; cycle_id?: string | null; new_cycle?: CycleInput; kind?: Session['kind']; date_precision?: Session['date_precision']; cycle_slot?: number | null }
export interface ProviderResult { provider: string; status: 'success' | 'failed' | 'skipped'; count: number; message: string; retryAfter?: number }
export interface RefreshResult { movie: MovieDetail; providers: ProviderResult[] }
export interface ManualMovieInput { title: string; year?: number; runtime?: number }
export interface MetadataEnrichment {
  results: {movieId: string; title: string; provider: 'tmdb'; status: 'success' | 'failed' | 'conflict'; message: string; retryAfter?: number}[];
  remaining: number; unidentified: number;
}
