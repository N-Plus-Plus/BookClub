import { hydrateCatalog } from '../shared/catalog';
import { validationFieldLabel } from './presentation';
import type { Catalog, CompactCatalog, ManualMovieInput, MovieDetail, SearchResponse, JournalMutationResult, SessionInput, AuthLogin, Viewer, RefreshResult, Rotation, BuilderSet, BuilderInput, BuilderPublishInput, HistoryAudit, RotationSwapInput, SelectedMetadataEnrichment, ScoreMaintenance, TmdbPreview } from '../shared/types';

const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/,'');
const base = import.meta.env.DEV ? 'http://localhost:8787' : configured || '';
export function setDevMember(id: string) { if (import.meta.env.DEV) localStorage.setItem('bookclub.dev-member',id); }
export interface Health { status: string; environment: string; authenticationRequired: boolean; googleAuthConfigured: boolean; tmdbConfigured: boolean; mdblistConfigured: boolean; omdbConfigured: boolean; demo: boolean }
const storageKey = 'bookclub.session';
let sessionToken: string | null = null;
try { sessionToken = localStorage.getItem(storageKey); } catch { /* Sign-in explains unavailable storage. */ }
let unauthorized: (() => void) | undefined;
export class ApiClientError extends Error {
  constructor(public status: number,message: string,public fields: {path: string; message: string}[] = []) { super(message); }
}
export function setUnauthorizedHandler(handler?: () => void) { unauthorized = handler; }
export function hasSession() { return Boolean(sessionToken); }
export function storeSession(token: string) {
  try { localStorage.setItem(storageKey,token); }
  catch { throw new Error('Allow browser storage to stay signed in to BookClub.'); }
  sessionToken = token;
}
export function clearSession() { sessionToken = null; try { localStorage.removeItem(storageKey); } catch { /* In-memory session is still cleared. */ } }
async function request<T>(path: string, method = 'GET', data?: unknown, authenticated = true, signal?: AbortSignal): Promise<T> {
  if (!base) throw new Error('Set VITE_API_BASE_URL to the Worker origin before building the production frontend.');
  const sentToken = sessionToken;
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method, headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(import.meta.env.DEV && localStorage.getItem('bookclub.dev-member') ? {'X-BookClub-Dev-Member': localStorage.getItem('bookclub.dev-member')!} : {}),
        ...(authenticated && sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      }, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout((path === '/movies/enrich-metadata' || path === '/movies/enrich-metadata-selected' || path === '/movies/enrich-provider-selected' || path === '/movies/maintain' || path === '/movies/maintenance-provider') ? 105000 : path === '/classics/enrich' ? 65000 : 15000),
    });
  } catch { throw new Error('Could not reach BookClub. Check your connection and that the API is running, then retry.'); }
  if (response.status === 401 && authenticated && sentToken === sessionToken) { clearSession(); unauthorized?.(); }
  let payload: { data?: T; error?: { message: string; fields?: {path: string; message: string}[] } };
  try { payload = await response.json(); }
  catch {
    if (!response.ok) throw new ApiClientError(response.status,'The API returned an unexpected response. Check the configured API URL.');
    throw new Error('The API returned an unexpected response. Check the configured API URL.');
  }
  if (!response.ok) throw new ApiClientError(response.status,payload.error?.fields?.map(f => `${validationFieldLabel(f.path)}: ${f.message}`).join(' · ') || payload.error?.message || 'Request failed.',payload.error?.fields);
  return payload.data as T;
}
export const api = {
  collectionRosterStatus:()=>request<import('../shared/collection-roster').CollectionRosterStatus>('/collections/maintenance'),
  maintainCollectionRosters:(intent:'populate'|'refresh',ids:number[],startedAt:string)=>request<import('../shared/collection-roster').CollectionRosterBatch>('/collections/maintenance','POST',{intent,ids,startedAt}),
  maintenanceCoverage: (after:string | null=null) => request<import('../shared/maintenance-plan').MaintenanceCoverage & {next:string | null}>(`/movies/maintenance-coverage${after ? '?after='+encodeURIComponent(after) : ''}`),
  maintenanceProvider: (intent:import('../shared/maintenance-plan').MaintenanceIntent,units:import('../shared/maintenance-plan').MaintenanceUnit[],startedAt:string) => request<import('../shared/maintenance-plan').MaintenanceBatchResult>('/movies/maintenance-provider','POST',{intent,units,startedAt}),
  metricsEnrichment: () => request<import('../shared/metrics-enrichment').MetricsEnrichment>('/metrics/enrichment'),
  catalog: async (): Promise<Catalog> => {
    try { return hydrateCatalog(await request<CompactCatalog>('/catalog/compact')); }
    catch (error) {
      if (!(error instanceof ApiClientError) || ![404,405,501].includes(error.status)) throw error;
      return request<Catalog>('/catalog');
    }
  }, health: () => request<Health>('/health','GET',undefined,false),
  scoreMaintenanceStatus: () => request<import('../shared/types').ScoreMaintenanceStatus>('/movies/maintenance-status'),
  maintainMovies: (mode: import('../shared/score-maintenance').MaintenanceMode,movie_ids: string[]) => request<ScoreMaintenance>('/movies/maintain','POST',{mode,movie_ids}),
  enrichProvider: (provider: import('../shared/enrichment').EnrichmentProvider,movie_ids: string[]) => request<import('../shared/enrichment').EnrichmentBatch>('/movies/enrich-provider-selected','POST',{provider,movie_ids}),
  enrichMetadataSelected: async (movie_ids: string[]): Promise<SelectedMetadataEnrichment> => {
    try { return await request<SelectedMetadataEnrichment>('/movies/enrich-metadata-selected','POST',{movie_ids}); }
    catch (error) {
      if (!(error instanceof ApiClientError) || ![404,405,501].includes(error.status)) throw error;
      throw new ApiClientError(error.status,'Selected-film metadata enrichment is unavailable. The API Worker may need updating; update it before retrying to process only the selected films.');
    }
  },
  me: () => request<{viewer: Viewer | null}>('/auth/me'),
  googleLogin: (credential: string) => request<AuthLogin>('/auth/google','POST',{credential},false),
  logout: () => request<{loggedOut: boolean}>('/auth/logout','POST'),
  detail: (id: string) => request<MovieDetail>(`/movies/${encodeURIComponent(id)}`),
  search: (query: string) => request<SearchResponse>(`/movies/search?q=${encodeURIComponent(query)}`),
  preview: (externalId: string, signal?: AbortSignal) => request<TmdbPreview>(`/movies/preview/tmdb/${encodeURIComponent(externalId)}`,'GET',undefined,true,signal),
  createMovie: (input: ManualMovieInput) => request<MovieDetail>('/movies','POST',input),
  importMovie: (externalId: string) => request<MovieDetail>('/movies/import','POST',{provider: 'tmdb',externalId}),
  saveSession: (input: SessionInput,id?: string) => request<JournalMutationResult>(id ? `/sessions/${encodeURIComponent(id)}` : '/sessions',id ? 'PUT' : 'POST',input),
  avatars: () => request<number[]>('/avatars'),
  claimAvatar: (avatar: number) => request<Viewer>('/auth/avatar','POST',{avatar}),
  rotation: () => request<Rotation | null>('/rotation'),
  swapRotation: (input: RotationSwapInput) => request<Rotation>('/rotation/swap','POST',input),
  builders: () => request<BuilderSet[]>('/builders'),
  saveBuilder: (input: BuilderInput,id?: string) => request<BuilderSet>(id ? `/builders/${encodeURIComponent(id)}` : '/builders',id ? 'PUT' : 'POST',input),
  deleteBuilder: (id: string,revision: number) => request(`/builders/${encodeURIComponent(id)}`,'DELETE',{revision}),
  publishBuilder: (id: string,input: BuilderPublishInput) => request<JournalMutationResult>(`/builders/${encodeURIComponent(id)}/publish`,'POST',input),
  deleteSession: (id: string) => request<JournalMutationResult>(`/sessions/${encodeURIComponent(id)}`,'DELETE'),
  restoreSession: (id: string) => request<JournalMutationResult>(`/sessions/${encodeURIComponent(id)}/restore`,'POST'),
  audit: (id: string) => request<HistoryAudit[]>(`/sessions/${encodeURIComponent(id)}/audit`),
  removeClassic: (id: string) => request<MovieDetail>(`/movies/${encodeURIComponent(id)}/classics`,'DELETE'),
  classic: (id: string,classic: boolean) => request<MovieDetail>(`/movies/${encodeURIComponent(id)}/classics`,'PUT',{classic}),
  refreshScores: (id: string) => request<RefreshResult>(`/movies/${encodeURIComponent(id)}/refresh-scores`,'POST'),
  enrich: (limit = 10) => request<{results: RefreshResult[]; remaining: number; unidentified: number}>('/classics/enrich','POST',{limit}),
  seen: (movieId: string, memberId: string, seen: boolean | null) => request<MovieDetail>(`/movies/${encodeURIComponent(movieId)}/seen/${encodeURIComponent(memberId)}`,'PUT',{seen}),
};
