import type { Catalog, ManualMovieInput, MovieDetail, SearchResponse, Session, SessionInput, AuthLogin, Viewer } from '../shared/types';

const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/,'');
const base = configured || (import.meta.env.DEV ? 'http://localhost:8787' : '');
export interface Health { status: string; environment: string; authenticationRequired: boolean; googleAuthConfigured: boolean; tmdbConfigured: boolean; demo: boolean }
const storageKey = 'bookclub.session';
let sessionToken: string | null = null;
try { sessionToken = localStorage.getItem(storageKey); } catch { /* Sign-in explains unavailable storage. */ }
let unauthorized: (() => void) | undefined;
export class ApiClientError extends Error {
  constructor(public status: number,message: string) { super(message); }
}
export function setUnauthorizedHandler(handler?: () => void) { unauthorized = handler; }
export function hasSession() { return Boolean(sessionToken); }
export function storeSession(token: string) {
  try { localStorage.setItem(storageKey,token); }
  catch { throw new Error('Allow browser storage to stay signed in to BookClub.'); }
  sessionToken = token;
}
export function clearSession() { sessionToken = null; try { localStorage.removeItem(storageKey); } catch { /* In-memory session is still cleared. */ } }
async function request<T>(path: string, method = 'GET', data?: unknown, authenticated = true): Promise<T> {
  if (!base) throw new Error('Set VITE_API_BASE_URL to the Worker origin before building the production frontend.');
  const sentToken = sessionToken;
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method, headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(authenticated && sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      }, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('Could not reach BookClub. Check your connection and that the API is running, then retry.'); }
  if (response.status === 401 && authenticated && sentToken === sessionToken) { clearSession(); unauthorized?.(); }
  let payload: { data?: T; error?: { message: string; fields?: {path: string; message: string}[] } };
  try { payload = await response.json(); }
  catch { throw new Error('The API returned an unexpected response. Check the configured API URL.'); }
  if (!response.ok) throw new ApiClientError(response.status,payload.error?.fields?.map(f => `${f.path}: ${f.message}`).join(' · ') || payload.error?.message || 'Request failed.');
  return payload.data as T;
}
export const api = {
  catalog: () => request<Catalog>('/catalog'), health: () => request<Health>('/health','GET',undefined,false),
  me: () => request<{viewer: Viewer | null}>('/auth/me'),
  googleLogin: (credential: string) => request<AuthLogin>('/auth/google','POST',{credential},false),
  logout: () => request<{loggedOut: boolean}>('/auth/logout','POST'),
  detail: (id: string) => request<MovieDetail>(`/movies/${encodeURIComponent(id)}`),
  search: (query: string) => request<SearchResponse>(`/movies/search?q=${encodeURIComponent(query)}`),
  createMovie: (input: ManualMovieInput) => request<MovieDetail>('/movies','POST',input),
  importMovie: (externalId: string) => request<MovieDetail>('/movies/import','POST',{provider: 'tmdb',externalId}),
  saveSession: (input: SessionInput) => request<Session>('/sessions','POST',input),
  seen: (movieId: string, memberId: string, seen: boolean | null) => request<MovieDetail>(`/movies/${encodeURIComponent(movieId)}/seen/${encodeURIComponent(memberId)}`,'PUT',{seen}),
};
