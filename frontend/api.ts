import type { Catalog, ManualMovieInput, MovieDetail, SearchResponse, Session, SessionInput } from '../shared/types';

const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/,'');
const base = configured || (import.meta.env.DEV ? 'http://localhost:8787' : '');
export interface Health { status: string; environment: string; writesEnabled: boolean; tmdbConfigured: boolean; demo: boolean }
async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  if (!base) throw new Error('Set VITE_API_BASE_URL to the Worker origin before building the production frontend.');
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method, ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' },body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('Could not reach BookClub. Check your connection and that the API is running, then retry.'); }
  let payload: { data?: T; error?: { message: string; fields?: {path: string; message: string}[] } };
  try { payload = await response.json(); }
  catch { throw new Error('The API returned an unexpected response. Check the configured API URL.'); }
  if (!response.ok) throw new Error(payload.error?.fields?.map(f => `${f.path}: ${f.message}`).join(' · ') || payload.error?.message || 'Request failed.');
  return payload.data as T;
}
export const api = {
  catalog: () => request<Catalog>('/catalog'), health: () => request<Health>('/health'),
  detail: (id: string) => request<MovieDetail>(`/movies/${encodeURIComponent(id)}`),
  search: (query: string) => request<SearchResponse>(`/movies/search?q=${encodeURIComponent(query)}`),
  createMovie: (input: ManualMovieInput) => request<MovieDetail>('/movies','POST',input),
  importMovie: (externalId: string) => request<MovieDetail>('/movies/import','POST',{provider: 'tmdb',externalId}),
  saveSession: (input: SessionInput) => request<Session>('/sessions','POST',input),
  seen: (movieId: string, memberId: string, seen: boolean | null) => request<MovieDetail>(`/movies/${encodeURIComponent(movieId)}/seen/${encodeURIComponent(memberId)}`,'PUT',{seen}),
};
