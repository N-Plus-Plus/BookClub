import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarPlus, Check, ChevronRight, Clapperboard, Eye, History, Home, Info, Library, LogOut, RefreshCw, X } from 'lucide-react';
import type { Catalog, Movie, MovieDetail, Viewer } from '../shared/types';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { SignInScreen } from './SignInScreen';
import { api, ApiClientError, clearSession, hasSession, setUnauthorizedHandler, storeSession, type Health } from './api';
import { Action, Empty, Failure, RankingCard, RouteLink, SessionCard } from './components';
import { EventScreen } from './EventScreen';
import { SeenScreen } from './SeenScreen';
import { DetailScreen } from './DetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { ClassicsScreen } from './ClassicsScreen';

const destinations = [ {path: 'home',label: 'Home',icon: Home}, {path: 'history',label: 'History',icon: History},
  {path: 'event',label: 'Event',icon: CalendarPlus}, {path: 'classics',label: 'Classics',icon: Library}, {path: 'seen',label: 'Seen It?',icon: Eye} ];
const route = () => window.location.hash.slice(2) || 'home';
export function App() {
  const [page,setPage] = useState(route);
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const [health,setHealth] = useState<Health | null>(null);
  const [viewer,setViewer] = useState<Viewer | null>(null);
  const [authBusy,setAuthBusy] = useState(false);
  const generation = useRef(0);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetAuth = useCallback(() => {
    generation.current++; setCatalog(null); setViewer(null); setNotice(''); setError(''); setLoading(false);
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
      }
      const data = await api.catalog();
      if (current === generation.current) setCatalog(data);
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
  const logout = async () => {
    setAuthBusy(true);
    try { await api.logout(); clearSession(); window.google?.accounts.id.disableAutoSelect(); resetAuth(); }
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
  const title = isDetail ? 'Film detail' : destinations.find(d => d.path === page)?.label ?? 'Page not found';
  const subtitles: Record<string,string> = { home: 'A weekly ritual. A growing collection.',history: 'Every night has a story.',event: 'Make room for the next great film.',classics: 'The next watch, decided together.',seen: 'A quick answer keeps the list moving.' };
  const writesEnabled = Boolean(health && (!health.authenticationRequired || viewer));
  if (health?.authenticationRequired && !viewer && !loading) return <SignInScreen configured={health.googleAuthConfigured} error={error} busy={authBusy} onCredential={signIn} onRetry={() => void load()} />;
  return <div className="bookclub-shell"><header className="site-header"><a className="brand" href="#/home"><Clapperboard aria-hidden="true" /><span>BookClub<small>THE WEEKLY FILM JOURNAL</small></span></a><div className="viewer-controls">{viewer ? <><span className="meta">{viewer.display_name}</span><Action icon={LogOut} aria-label="Log out of BookClub" disabled={authBusy} onClick={() => void logout()} /></> : <span className="header-tag">{health?.demo ? 'LOCAL DEMO' : 'FILM CLUB'}</span>}</div></header>
    <main id="main"><div className="page-heading"><div><p className="eyebrow">FOUR PEOPLE · ONE SHARED SCREEN</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p className="subtitle">{subtitles[page] ?? 'The film, the scores, and our shared history.'}</p></div><Action icon={RefreshCw} aria-label="Refresh BookClub data" disabled={refreshing} onClick={() => void load()} /></div>
    {notice && <div className="notice" role="status"><Check size={20} aria-hidden="true" /><span>{notice}</span><Action icon={X} aria-label="Dismiss message" onClick={() => setNotice('')} /></div>}
    {health?.demo && <p className="demo-label"><Info size={16} aria-hidden="true" />Development fixtures · events and ratings are illustrative</p>}
    {loading ? <div className="loading-state" role="status">Loading the film journal…</div> : error ? <Failure message={error} retry={() => void load()} /> : catalog && <>
      {page === 'home' && <div className="stack"><section className="welcome card"><div><p className="eyebrow">NEXT UP</p><h2>A good night starts<br />with a good film.</h2><p>Gather the four. Choose the films. Keep the story.</p><RouteLink to="event" icon={CalendarPlus}>Start an event</RouteLink></div><Clapperboard className="welcome-icon" aria-hidden="true" /></section>
      <div className="stats-grid"><div className="card stat"><strong>{eligible.length}</strong><span>Eligible Classics</span></div><div className="card stat"><strong>{excluded.length}</strong><span>Already seen by all</span></div><a className="card stat stat-link" href="#/seen"><strong>{missing}</strong><span><Eye size={16} aria-hidden="true" />Missing answers</span></a></div>
      <div className="dashboard-grid"><section className="stack"><div className="section-title"><h2>Last time together</h2><RouteLink to="history" icon={History}>History</RouteLink></div>{catalog.sessions[0] ? <SessionCard session={catalog.sessions[0]} members={catalog.members} /> : <Empty title="Your first night is waiting">Create an event to begin your shared history.</Empty>}</section>
      <section className="stack"><div className="section-title"><h2>On the shortlist</h2><RouteLink to="classics" icon={ChevronRight}>View all</RouteLink></div>{eligible.slice(0,3).map((m,i) => <RankingCard key={m.id} movie={m} rank={i+1} />)}{!eligible.length && <Empty title="No eligible Classics">Open Classics to inspect the candidate pool.</Empty>}</section></div></div>}
      {page === 'history' && <HistoryScreen catalog={catalog} />}
      {page === 'event' && <EventScreen catalog={catalog} writesEnabled={writesEnabled} onMovie={applyMovie} onSaved={session => {
        setCatalog(c => c ? {...c,sessions: [session,...c.sessions].sort((a,b) => b.event_date.localeCompare(a.event_date))} : c);
        void load(); setNotice('Event saved to the film journal.'); window.location.hash = '/history';
      }} />}
      {page === 'classics' && <ClassicsScreen movies={classics} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {page === 'seen' && <SeenScreen catalog={catalog} answer={answer} writesEnabled={writesEnabled} />}
      {isDetail && <DetailScreen key={page} id={page.slice(6)} members={catalog.members} answer={answer} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {!isDetail && !destinations.some(d => d.path === page) && <Empty title="Page not found"><RouteLink to="home" icon={Home}>Go home</RouteLink></Empty>}
    </>}
    <footer className="data-sources"><h2><Info size={18} aria-hidden="true" />About & data sources</h2><p>BookClub is a film journal for four people. Local demo scores are invented examples. Optional MDBList and OMDb retrieve ratings from other sources; BookClub has no direct IMDb, Rotten Tomatoes or Letterboxd API relationship.</p><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><Info size={16} aria-hidden="true" /><img className="tmdb-logo" src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="The Movie Database" /></a><p>Classics uses the historical sum-of-squares formula. Additional ratings do not affect Watch Order.</p><p><a href="https://mdblist.com/" target="_blank" rel="noreferrer"><Info size={16} aria-hidden="true" />MDBList</a> · <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer"><Info size={16} aria-hidden="true" />OMDb</a></p></footer>
    </main><nav className="bottom-nav" aria-label="Primary navigation">{destinations.map(({path,label,icon: Icon}) => <a key={path} href={`#/${path}`} aria-current={page === path ? 'page' : undefined}><Icon size={22} aria-hidden="true" /><span>{label}</span></a>)}</nav>
  </div>;
}
