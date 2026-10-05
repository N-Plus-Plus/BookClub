import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ChartNoAxesColumn, CalendarPlus, ListPlus, Check, ChevronRight, Clapperboard, Eye, History, Home, Info, Library, LogOut, RefreshCw, X } from 'lucide-react';
import type { Catalog, Movie, MovieDetail, Viewer, Rotation } from '../shared/types';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { SignInScreen } from './SignInScreen';
import { api, ApiClientError, clearSession, hasSession, setDevMember, setUnauthorizedHandler, storeSession, type Health } from './api';
import { Action, Empty, Failure, LoadingView, RankingCard, RouteLink, SessionCard } from './components';
import { EventScreen } from './EventScreen';
import { SeenScreen } from './SeenScreen';
import { DetailScreen } from './DetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { ClassicsScreen } from './ClassicsScreen';
import { AvatarScreen } from './AvatarScreen';
import { ClubIdentity } from './ClubIdentity';
import { BuilderScreen } from './BuilderScreen';
import { RotationCard } from './RotationCard';
import { needsAvatar } from '../shared/identity';
import { MetricsScreen } from './MetricsScreen';
import { Navigation, destinations } from './Navigation';

const DevTools = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview' ? lazy(() => import('./DevTools')) : null;
const localLogin = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview';
const route = () => window.location.hash.slice(2) || 'home';
export function App() {
  const [page,setPage] = useState(route);
  const [navigationExpanded,setNavigationExpanded] = useState(true);
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const [health,setHealth] = useState<Health | null>(null);
  const [rotation,setRotation] = useState<Rotation | null>(null);
  const [viewer,setViewer] = useState<Viewer | null>(null);
  const [authBusy,setAuthBusy] = useState(false);
  const generation = useRef(0);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetAuth = useCallback(() => {
    generation.current++; setRotation(null); setCatalog(null); setViewer(null); setNotice(''); setError(''); setLoading(false);
  },[]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setRefreshing(true); setError('');
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
      if (current === generation.current && !(e instanceof ApiClientError && e.status === 401)) setError(e instanceof Error ? e.message : 'Could not load BookClub.');
    } finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  },[]);
  useEffect(() => { setUnauthorizedHandler(resetAuth); void load(); return () => { generation.current++; setUnauthorizedHandler(); }; },[load,resetAuth]);
  const signIn = async (credential: string) => {
    if (authBusy) return;
    setAuthBusy(true); setError('');
    try { const result = await api.googleLogin(credential); storeSession(result.token); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setAuthBusy(false); }
  };
  const signInAsTroy = async () => {
    if (!localLogin || authBusy) return;
    setAuthBusy(true); setError('');
    try {
      if (health?.environment !== 'local' || health.authenticationRequired) throw new Error('Start the local BookClub API with development authentication enabled, then retry.');
      // Reuse the local identity header; never create a member or a Google binding.
      setDevMember('club-member-2');
      const result = await api.me();
      if (result.viewer?.id !== 'club-member-2') throw new Error('Troy’s existing member record is unavailable in the local database.');
      await load();
    } catch (e) { setDevMember(''); setError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setAuthBusy(false); }
  };
  const logout = async () => {
    setAuthBusy(true);
    try { await api.logout(); if (localLogin) setDevMember(''); clearSession(); window.google?.accounts.id.disableAutoSelect(); resetAuth(); }
    catch (e) {
      // Preserve the session on network failure so server revocation can be retried.
      setError(e instanceof Error ? e.message : 'Could not log out. Please retry.');
    } finally { setAuthBusy(false); }
  };
  useEffect(() => {
    const update = () => { setPage(route()); window.scrollTo(0,0); requestAnimationFrame(() => heading.current?.focus()); };
    window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange',update);
  },[]);
  const applyMovie = (movie: MovieDetail | Movie) => setCatalog(current => current ? ({...current,
    movies: current.movies.some(m => m.id === movie.id) ? current.movies.map(m => m.id === movie.id ? movie : m) : [...current.movies,movie],
    sessions: current.sessions.map(s => ({...s,movies: s.movies.map(m => m.id === movie.id ? movie : m)})),
  }) : current);
  const answer = async (movieId: string,memberId: string,seen: boolean | null) => {
    const movie = await api.seen(movieId,memberId,seen); applyMovie(movie); return movie;
  };
  const classics = catalog ? sortClassics(catalog.movies.filter(m => m.classic)) : [];
  const eligible = classics.filter(m => m.ranking?.eligible && m.ranking.rankable);
  const excluded = classics.filter(m => !m.ranking?.eligible);
  const missing = catalog ? missingAnswers(catalog.movies,catalog.members).length : 0;
  const isDetail = page.startsWith('movie/');
  const title = (page === 'event' || page.startsWith('event/')) ? 'Event' : isDetail ? 'Film detail' : destinations.find(d => d.path === page)?.label ?? 'Page not found';
  const writesEnabled = Boolean(health && (!health.authenticationRequired || viewer));
  if ((localLogin || health?.authenticationRequired) && health && !viewer && !loading) return <SignInScreen configured={health.googleAuthConfigured} error={error} busy={authBusy} onCredential={signIn} onLocalLogin={localLogin ? signInAsTroy : undefined} onRetry={() => void load()} />;
  if (needsAvatar(viewer) && viewer) return <AvatarScreen viewer={viewer} externalError={error} onClaimed={claimed => { setViewer(claimed); void load(); }} onLogout={() => void logout()} />;
  return <div className={`app-layout ${navigationExpanded ? 'navigation-expanded' : 'navigation-collapsed'}`}><Navigation page={page} expanded={navigationExpanded} onToggle={() => setNavigationExpanded(value => !value)} /><div className="bookclub-shell"><header className="site-header"><a className="brand" href="#/home"><Clapperboard aria-hidden="true" /><span>BookClub<small>THE WEEKLY FILM JOURNAL</small></span></a><div className="viewer-controls">{viewer ? <><ClubIdentity identity={{kind: 'member',member: viewer}} /><Action icon={LogOut} aria-label="Log out of BookClub" disabled={authBusy} onClick={() => void logout()} /></> : <span className="header-tag">{health?.demo ? 'LOCAL DEMO' : 'FILM CLUB'}</span>}</div></header>
    <main id="main"><div className="page-heading"><div><h1 ref={heading} tabIndex={-1}>{title}</h1>{page.startsWith('event/') && <p className="subtitle">Correct the event details and film lineup.</p>}</div><Action icon={RefreshCw} aria-label="Refresh BookClub data" disabled={refreshing} onClick={() => void load()} /></div>
    {notice && <div className="notice" role="status"><Check size={20} aria-hidden="true" /><span>{notice}</span><Action icon={X} aria-label="Dismiss message" onClick={() => setNotice('')} /></div>}
    {health?.demo && <p className="demo-label"><Info size={16} aria-hidden="true" />Local disposable database</p>}
    {DevTools && health?.environment === 'local' && !health.authenticationRequired && catalog && <Suspense fallback={null}><DevTools members={catalog.members} onChanged={load} /></Suspense>}
    {catalog && error && <div className="refresh-failure" role="alert"><p>Could not refresh. Showing the last loaded journal.</p><p className="meta">{error}</p><Action icon={RefreshCw} variant="secondary" disabled={refreshing} onClick={() => void load()}>Retry refresh</Action></div>}
    {catalog && refreshing && <p className="meta refresh-status" role="status">Refreshing the journal…</p>}
    {loading && !catalog ? <LoadingView /> : !catalog && error ? <Failure message={error} retry={() => void load()} /> : catalog && <>
      {page === 'home' && <div className="stack"><RotationCard catalog={catalog} rotation={rotation} viewer={viewer} onUpdated={() => void load()} />
      <div className="stats-grid"><div className="card stat"><strong>{eligible.length}</strong><span>Eligible Classics</span></div><div className="card stat"><strong>{excluded.length}</strong><span>Already seen by all</span></div><a className="card stat stat-link" href="#/seen"><strong>{missing}</strong><span><Eye size={16} aria-hidden="true" />Missing answers</span></a></div>
      <div className="dashboard-grid"><section className="stack"><div className="section-title"><h2>Last time together</h2><RouteLink to="history" icon={History} variant="tertiary">History</RouteLink></div>{catalog.sessions[0] ? <SessionCard session={catalog.sessions[0]} members={catalog.members} /> : <Empty title="Your first night is waiting">Create an event to begin your shared history.</Empty>}</section>
      <section className="stack"><div className="section-title"><h2>On the shortlist</h2><RouteLink to="classics" icon={ChevronRight} variant="tertiary">View all</RouteLink></div>{eligible.slice(0,3).map((m,i) => <RankingCard key={m.id} movie={m} rank={i+1} />)}{!eligible.length && <Empty title="No eligible Classics">Open Classics to inspect the candidate pool.</Empty>}</section></div></div>}
      {page === 'history' && <HistoryScreen catalog={catalog} onChanged={() => void load()} />}
      {page === 'metrics' && <MetricsScreen catalog={catalog} viewer={viewer} onUpdated={load} />}
      {page === 'builder' && <BuilderScreen key={viewer?.id} catalog={catalog} viewer={viewer} rotation={rotation} onMovie={applyMovie} onPublished={() => { void load(); setNotice('Published to History.'); window.location.hash = '/history'; }} />}
      {(page === 'event' || (page.startsWith('event/') && catalog.sessions.some(s => s.id === page.slice(6)))) && <EventScreen key={page} initial={catalog.sessions.find(s => s.id === page.slice(6))} viewer={viewer} rotation={rotation} catalog={catalog} writesEnabled={writesEnabled} onMovie={applyMovie} onSaved={session => {
        setCatalog(c => c ? {...c,sessions: [session,...c.sessions.filter(s => s.id !== session.id)].sort((a,b) => b.event_date.localeCompare(a.event_date))} : c);
        void load(); setNotice('Event saved to the film journal.'); window.location.hash = '/history';
      }} />}
      {page.startsWith('event/') && !catalog.sessions.some(s => s.id === page.slice(6)) && <Empty title="Event not found">The event may have been deleted. Return to History to review available events.</Empty>}
      {page === 'classics' && <ClassicsScreen viewer={viewer} movies={classics} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {page === 'seen' && <SeenScreen catalog={catalog} answer={answer} writesEnabled={writesEnabled} />}
      {isDetail && <DetailScreen key={page} id={page.slice(6)} members={catalog.members} answer={answer} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {!isDetail && page !== 'event' && !page.startsWith('event/') && !destinations.some(d => d.path === page) && <Empty title="Page not found"><RouteLink to="home" icon={Home}>Go home</RouteLink></Empty>}
    </>}
    <footer className="data-sources"><details><summary><Info size={18} aria-hidden="true" />Data sources & attribution</summary><div className="stack"><p>Ratings are stored snapshots, not live values. MDBList and OMDb retrieve third-party ratings; BookClub has no direct IMDb, Rotten Tomatoes or Letterboxd API relationship.</p><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><img className="tmdb-logo" src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="The Movie Database" /></a><p><a href="https://mdblist.com/" target="_blank" rel="noreferrer">MDBList</a> · <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer">OMDb</a></p></div></details></footer>
    </main></div></div>;
}
