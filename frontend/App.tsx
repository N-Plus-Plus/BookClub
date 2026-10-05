import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChartNoAxesColumn, CalendarPlus, ListPlus, Check, ChevronRight, Clapperboard, Eye, History, Home, Info, Library, RefreshCw, X } from 'lucide-react';
import type { Catalog, FilmCandidate, Movie, MovieDetail, TmdbPreview, Viewer, Rotation } from '../shared/types';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { SignInScreen } from './SignInScreen';
import { api, ApiClientError, clearSession, hasSession, setDevMember, setUnauthorizedHandler, storeSession, type Health } from './api';
import { Action, Empty, Failure, LoadingView, RankingCard, RouteLink, SessionCard } from './components';
import { EventScreen } from './EventScreen';
import { SeenScreen } from './SeenScreen';
import { DetailScreen } from './DetailScreen';
import { PreviewScreen } from './PreviewScreen';
import { HistoryScreen } from './HistoryScreen';
import { ClassicsScreen } from './ClassicsScreen';
import { AvatarScreen } from './AvatarScreen';
import { AccountMenu } from './AccountMenu';
import { BuilderScreen } from './BuilderScreen';
import { RotationCard } from './RotationCard';
import { needsAvatar } from '../shared/identity';
import { AdminScreen } from './AdminScreen';
import { MetricsScreen } from './MetricsScreen';
import { Navigation, destinations } from './Navigation';

const DevTools = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview' ? lazy(() => import('./DevTools')) : null;
const localLogin = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview';
type Inspection = {source: string; target: string; candidate: FilmCandidate; preview?: TmdbPreview; pending?: Promise<TmdbPreview>};
const route = () => window.location.hash.slice(2) || 'home';
export function App() {
  const [page,setPage] = useState(route);
  const pageRef = useRef(page);
  const [inspection,setInspection] = useState<Inspection | null>(null);
  const inspectionRef = useRef<Inspection | null>(null);
  const [confirmedMovie,setConfirmedMovie] = useState<Movie | null>(null);
  const consumeConfirmedMovie = useCallback(() => setConfirmedMovie(null),[]);
  const [inspectionError,setInspectionError] = useState('');
  const [confirming,setConfirming] = useState(false);
  const confirmInFlight = useRef(false);
  const [eventPrefill,setEventPrefill] = useState<string[] | null>(null);
  const consumeEventPrefill = useCallback(() => setEventPrefill(null),[]);
  const [navigationExpanded,setNavigationExpanded] = useState(true);
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const [health,setHealth] = useState<Health | null>(null);
  const [rotation,setRotation] = useState<Rotation | null>(null);
  const [viewer,setViewer] = useState<Viewer | null>(null);
  const [authBusy,setAuthBusy] = useState(false);
  const generation = useRef(0);
  const [loadError,setLoadError] = useState('');
  const [actionError,setActionError] = useState('');
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetAuth = useCallback(() => {
    generation.current++; inspectionRef.current = null; setInspection(null); setConfirmedMovie(null); setEventPrefill(null); setRotation(null); setCatalog(null); setViewer(null); setNotice(''); setLoadError(''); setActionError(''); setLoading(false);
  },[]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setRefreshing(true); setLoadError(''); setActionError('');
    try {
      const status = await api.health();
      if (current !== generation.current) return;
      setHealth(status);
      if (status.authenticationRequired) {
        if (!hasSession()) { setCatalog(null); setViewer(null); return; }
        const result = await api.me();
        if (current !== generation.current) return;
        setViewer(result.viewer);
        if (needsAvatar(result.viewer)) { setCatalog(null); return; }
      }
      if (import.meta.env.DEV && !status.authenticationRequired) {
        const result = await api.me();
        if (current !== generation.current) return;
        setViewer(result.viewer);
        if (localLogin && (!result.viewer || needsAvatar(result.viewer))) { setCatalog(null); setRotation(null); return; }
      }
      const [data,turn] = await Promise.all([api.catalog(),api.rotation()]);
      if (current === generation.current) { setCatalog(data); setRotation(turn); }
    } catch (e) {
      if (current === generation.current && !(e instanceof ApiClientError && e.status === 401)) setLoadError(e instanceof Error ? e.message : 'Could not load BookClub.');
    } finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  },[]);
  useEffect(() => { setUnauthorizedHandler(resetAuth); void load(); return () => { generation.current++; setUnauthorizedHandler(); }; },[load,resetAuth]);
  const signIn = async (credential: string) => {
    if (authBusy) return;
    setAuthBusy(true); setActionError('');
    try { const result = await api.googleLogin(credential); storeSession(result.token); await load(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setAuthBusy(false); }
  };
  const signInAsTroy = async () => {
    if (!localLogin || authBusy) return;
    setAuthBusy(true); setActionError('');
    try {
      if (health?.environment !== 'local' || health.authenticationRequired) throw new Error('Start the local BookClub API with development authentication enabled, then retry.');
      // Reuse the local identity header; never create a member or a Google binding.
      setDevMember('club-member-2');
      const result = await api.me();
      if (result.viewer?.id !== 'club-member-2') throw new Error('Troy’s existing member record is unavailable in the local database.');
      await load();
    } catch (e) { setDevMember(''); setActionError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setAuthBusy(false); }
  };
  const logout = async () => {
    setAuthBusy(true); setActionError('');
    try { await api.logout(); if (localLogin) setDevMember(''); clearSession(); window.google?.accounts.id.disableAutoSelect(); resetAuth(); }
    catch (e) {
      // Preserve the session on network failure so server revocation can be retried.
      setActionError(e instanceof Error ? e.message : 'Could not log out. Please retry.');
    } finally { setAuthBusy(false); }
  };
  useEffect(() => {
    const update = () => { const next = route();
      const context = inspectionRef.current;
      if (context && next !== context.target) { inspectionRef.current = null; setInspection(null); setInspectionError(''); if (next !== context.source) setConfirmedMovie(null); }
      if (next !== 'event' && next !== context?.target) setEventPrefill(null);
      if (!context && pageRef.current === 'seen' && next.startsWith('movie/')) {
        const context: Inspection = {source:'seen',target:next,candidate:{kind:'local',movie:{id:next.slice(6),title:'',year:null,tmdbId:null,poster:null}}};
        inspectionRef.current = context; setInspection(context);
      }
      pageRef.current = next; setPage(next); window.scrollTo(0,0); requestAnimationFrame(() => heading.current?.focus()); };
    window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange',update);
  },[]);
  const applyMovie = (movie: MovieDetail | Movie) => setCatalog(current => current ? ({...current,
    movies: current.movies.some(m => m.id === movie.id) ? current.movies.map(m => m.id === movie.id ? movie : m) : [...current.movies,movie],
    sessions: current.sessions.map(s => ({...s,movies: s.movies.map(m => m.id === movie.id ? movie : m)})),
  }) : current);
  const inspect = (candidate: FilmCandidate,preview?: TmdbPreview,pending?: Promise<TmdbPreview>) => {
    const target = candidate.kind === 'local' ? `movie/${candidate.movie.id}` : `preview/tmdb/${candidate.movie.externalId}`;
    const context = {source:page,target,candidate,preview,pending};
    inspectionRef.current = context; setInspection(context); setInspectionError(''); window.location.hash = `/${target}`;
  };
  const confirmFilm = async () => {
    const context = inspectionRef.current;
    if (!context || confirmInFlight.current) return;
    confirmInFlight.current = true; setConfirming(true); setInspectionError('');
    try {
      const candidate = context.candidate;
      const movie = candidate.kind === 'local'
        ? catalog?.movies.find(movie => movie.id === candidate.movie.id) ?? await api.detail(candidate.movie.id)
        : await api.importMovie(candidate.movie.externalId);
      if (inspectionRef.current !== context) return;
      applyMovie(movie); setConfirmedMovie(movie); window.location.hash = `/${context.source}`;
    } catch (error) {
      if (inspectionRef.current === context) setInspectionError(error instanceof Error ? error.message : 'Could not add this film. Try again.');
    } finally { confirmInFlight.current = false; setConfirming(false); }
  };
  const answer = async (movieId: string,memberId: string,seen: boolean | null) => {
    const movie = await api.seen(movieId,memberId,seen); applyMovie(movie); return movie;
  };
  const classics = catalog ? sortClassics(catalog.movies.filter(m => m.classic)) : [];
  const eligible = classics.filter(m => m.ranking?.eligible && m.ranking.rankable);
  const excluded = classics.filter(m => !m.ranking?.eligible);
  const missing = catalog ? missingAnswers(catalog.movies,catalog.members,viewer?.id ?? '').length : 0;
  const isPreview = page.startsWith('preview/tmdb/');
  const isDetail = page.startsWith('movie/') || isPreview;
  const detailContext = inspection && page === inspection.target;
  const inspecting = detailContext && inspection.source !== 'seen';
  const eventRoute = page === 'event' || page.startsWith('event/') ? page : inspecting ? inspection.source : null;
  const isAdminPage = page === 'admin' && viewer?.role === 'admin';
  const title = (page === 'event' || page.startsWith('event/')) ? 'Event' : isDetail ? 'Film detail' : isAdminPage ? 'Admin' : destinations.find(d => d.path === page)?.label ?? 'Page not found';
  const writesEnabled = Boolean(health && (!health.authenticationRequired || viewer));
  if ((localLogin || health?.authenticationRequired) && health && !viewer && !loading) return <SignInScreen configured={health.googleAuthConfigured} error={actionError || loadError} busy={authBusy} onCredential={signIn} onLocalLogin={localLogin ? signInAsTroy : undefined} onRetry={() => void load()} />;
  if (needsAvatar(viewer) && viewer) return <AvatarScreen viewer={viewer} externalError={actionError || loadError} onClaimed={claimed => { setViewer(claimed); void load(); }} onLogout={() => void logout()} />;
  return <div className={`app-layout ${navigationExpanded ? 'navigation-expanded' : 'navigation-collapsed'}`}><Navigation page={page} expanded={navigationExpanded} onToggle={() => setNavigationExpanded(value => !value)} /><div className="bookclub-shell"><header className="site-header"><a className="brand" href="#/home"><Clapperboard aria-hidden="true" /><span>BookClub<small>HAVE YOU UPDATED THE SPREADSH... WEB APP?</small></span></a><div className="viewer-controls">{viewer ? <AccountMenu viewer={viewer} busy={authBusy} onLogout={() => void logout()} /> : <span className="header-tag">{health?.demo ? 'LOCAL DEMO' : 'FILM CLUB'}</span>}</div></header>
    <main id="main"><div className="page-heading"><div><h1 ref={heading} tabIndex={-1}>{title}</h1>{page.startsWith('event/') && <p className="subtitle">Correct the event details and film lineup.</p>}</div>{detailContext && inspection.source === 'seen' && <Action icon={ArrowLeft} onClick={() => { window.location.hash = '/seen'; }}>Back</Action>}{inspecting && <div className="button-set inspection-actions"><Action icon={X} disabled={confirming} onClick={() => { window.location.hash = `/${inspection.source}`; }}>Nope, this isn't it</Action><Action icon={Check} variant="primary" disabled={confirming || !writesEnabled} onClick={() => void confirmFilm()}>{confirming ? 'Adding…' : 'Yes, this one!'}</Action></div>}</div>
    {inspectionError && inspecting && <p className="error-message" role="alert">{inspectionError}</p>}
    {notice && <div className="notice" role="status"><Check size={20} aria-hidden="true" /><span>{notice}</span><Action icon={X} aria-label="Dismiss message" onClick={() => setNotice('')} /></div>}
    {health?.demo && <p className="demo-label"><Info size={16} aria-hidden="true" />Local disposable database</p>}
    {DevTools && health?.environment === 'local' && !health.authenticationRequired && catalog && <Suspense fallback={null}><DevTools members={catalog.members} onChanged={load} /></Suspense>}
    {catalog && loadError && <div className="refresh-failure" role="alert"><p>Could not load BookClub data. Showing the last loaded journal.</p><p className="meta">{loadError}</p><Action icon={RefreshCw} variant="secondary" disabled={refreshing} onClick={() => void load()}>Try again</Action></div>}
    {actionError && <p className="error-message" role="alert">{actionError}</p>}
    {catalog && refreshing && <p className="meta refresh-status" role="status">Refreshing the journal…</p>}
    {loading && !catalog ? <LoadingView /> : !catalog && loadError ? <Failure message={loadError} retry={() => void load()} /> : catalog && <>
      {page === 'home' && <div className="stack"><RotationCard catalog={catalog} rotation={rotation} viewer={viewer} onUpdated={() => void load()} onUseBuilder={movieIds => { setEventPrefill(movieIds); window.location.hash = '/event'; }} />
      <div className="stats-grid"><div className="card stat"><strong>{eligible.length}</strong><span>Eligible Classics</span></div><div className="card stat"><strong>{excluded.length}</strong><span>Already seen by all</span></div><a className="card stat stat-link" href="#/seen"><strong>{missing}</strong><span><Eye size={16} aria-hidden="true" />Missing answers</span></a></div>
      <div className="dashboard-grid"><section className="stack"><div className="section-title"><h2>Last turn</h2><RouteLink to="history" icon={History} variant="tertiary">History</RouteLink></div>{catalog.sessions[0] ? <SessionCard variant="home" session={catalog.sessions[0]} members={catalog.members} /> : <Empty title="Your first night is waiting">Create an event to begin your shared history.</Empty>}</section>
      <section className="stack"><div className="section-title"><h2>Next Classics</h2><RouteLink to="classics" icon={ChevronRight} variant="tertiary">View all</RouteLink></div>{eligible.slice(0,2).map((m,i) => <RankingCard variant="home" key={m.id} movie={m} rank={i+1} />)}{!eligible.length && <Empty title="No eligible Classics">Open Classics to inspect the candidate pool.</Empty>}</section></div></div>}
      {page === 'history' && <HistoryScreen viewer={viewer} catalog={catalog} onChanged={() => void load()} />}
      {isAdminPage && <AdminScreen catalog={catalog} writesEnabled={writesEnabled} onMovie={applyMovie} onUpdated={load} />}
      {page === 'metrics' && <MetricsScreen catalog={catalog} viewer={viewer} onUpdated={load} />}
      {page === 'builder' && <BuilderScreen key={viewer?.id} catalog={catalog} viewer={viewer} rotation={rotation} onMovie={applyMovie} onPublished={() => { void load(); setNotice('Published to History.'); window.location.hash = '/history'; }} />}
      {eventRoute && (eventRoute === 'event' || catalog.sessions.some(s => s.id === eventRoute.slice(6))) && <div hidden={Boolean(inspecting)} key={eventRoute}><EventScreen onInspect={inspect} confirmedMovie={confirmedMovie} onConfirmedConsumed={consumeConfirmedMovie} prefillMovieIds={eventRoute === 'event' ? eventPrefill : null} onPrefillConsumed={consumeEventPrefill} initial={eventRoute === 'event' ? undefined : catalog.sessions.find(s => s.id === eventRoute.slice(6))} viewer={viewer} rotation={rotation} catalog={catalog} writesEnabled={writesEnabled} onMovie={applyMovie} onSaved={session => {
        setCatalog(c => c ? {...c,sessions: [session,...c.sessions.filter(s => s.id !== session.id)].sort((a,b) => b.event_date.localeCompare(a.event_date))} : c);
        void load(); setNotice('Event saved to the film journal.'); window.location.hash = '/history';
      }} /></div>}
      {page.startsWith('event/') && !catalog.sessions.some(s => s.id === page.slice(6)) && <Empty title="Event not found">The event may have been deleted. Return to History to review available events.</Empty>}
      {page === 'classics' && <ClassicsScreen viewer={viewer} catalog={catalog} onUpdated={load} movies={classics} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {(page === 'seen' || (detailContext && inspection.source === 'seen')) && <div hidden={page !== 'seen'}><SeenScreen key={viewer?.id} viewerId={viewer?.id ?? ''} catalog={catalog} answer={answer} writesEnabled={writesEnabled} /></div>}
      {isDetail && !isPreview && <DetailScreen isAdmin={viewer?.role === 'admin'} key={page} id={page.slice(6)} members={catalog.members} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {isPreview && <PreviewScreen key={page} id={page.slice('preview/tmdb/'.length)} preview={inspecting ? inspection.preview : undefined} pending={inspecting ? inspection.pending : undefined} />}
      {!isAdminPage && !isDetail && page !== 'event' && !page.startsWith('event/') && !destinations.some(d => d.path === page) && <Empty title="Page not found"><RouteLink to="home" icon={Home}>Go home</RouteLink></Empty>}
    </>}
    <footer className="data-sources"><details><summary><Info size={18} aria-hidden="true" />Data sources & attribution</summary><div className="stack"><p>Ratings are stored snapshots, not live values. MDBList and OMDb retrieve third-party ratings; BookClub has no direct IMDb, Rotten Tomatoes or Letterboxd API relationship.</p><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><img className="tmdb-logo" src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="The Movie Database" /></a><p><a href="https://mdblist.com/" target="_blank" rel="noreferrer">MDBList</a> · <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer">OMDb</a></p></div></details></footer>
    </main></div></div>;
}
