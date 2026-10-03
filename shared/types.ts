export interface Viewer { id: string; display_name: string }
export interface AuthLogin { token: string; viewer: Viewer; expiresAt: string }
export interface Member { id: string; display_name: string; sort_order: number; active: number }
export interface Score { provider: string; metric: string; raw_value: number; raw_scale: number | null; normalized_value: number | null; vote_count: number | null; fetched_at: string }
export interface Asset { provider: string; asset_type: 'poster' | 'backdrop'; reference: string; width: number | null; height: number | null; preferred: number }
export interface ExternalId { provider: string; external_id: string }
export interface SeenAnswer { member_id: string; seen: number; updated_at: string }
export interface Ranking {
  weightedBaseScore: number; seenCount: number; unseenCount: number; unknownCount: number;
  seenAdjustment: number; finalScore: number; eligible: boolean; warnings: string[];
  sources: { provider: string; metric: string; value: number; weight: number }[];
}
export interface Movie {
  id: string; title: string; original_title: string | null; year: number | null;
  release_date: string | null; runtime: number | null; overview: string | null;
  genres: string[]; assets: Asset[]; external_ids: ExternalId[]; scores: Score[];
  seen: SeenAnswer[]; classic: boolean; ranking: Ranking | null;
}
export interface Session {
  id: string; event_date: string; title: string | null; host_member_id: string | null;
  legacy_cycle_label: string | null; notes: string | null; movies: Movie[];
}
export interface MovieDetail extends Movie { appearances: { id: string; event_date: string; title: string | null; position: number }[] }
export interface Catalog { members: Member[]; movies: Movie[]; sessions: Session[] }
export interface SearchResult { provider: string; externalId: string; title: string; year: number | null; poster: string | null }
export interface SearchResponse { local: Movie[]; external: SearchResult[]; lookup: { available: boolean; message: string | null } }
export interface SessionInput { event_date: string; title?: string; host_member_id?: string | null; legacy_cycle_label?: string; notes?: string; movie_ids: string[] }
export interface ManualMovieInput { title: string; year?: number; runtime?: number }
