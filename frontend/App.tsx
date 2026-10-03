import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarPlus, Check, ChevronRight, Clapperboard, Eye, History, Home, Info, Library, RefreshCw, X } from 'lucide-react';
import type { Catalog, Movie, MovieDetail } from '../shared/types';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { api, type Health } from './api';
import { Action, Empty, Failure, RankingCard, RouteLink, SessionCard } from './components';
import { EventScreen } from './EventScreen';
import { SeenScreen } from './SeenScreen';
import { DetailScreen } from './DetailScreen';

const destinations = [ {path: 'home',label: 'Home',icon: Home}, {path: 'history',label: 'History',icon: History},
  {path: 'event',label: 'Event',icon: CalendarPlus}, {path: 'classics',label: 'Classics',icon: Library}, {path: 'seen',label: 'Seen It?',icon: Eye} ];
const route = () => window.location.hash.slice(2) || 'home';
export function App() {
  const [page,setPage] = useState(route);
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const [health,setHealth] = useState<Health | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  const [disqualified,setDisqualified] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async () => {
    setRefreshing(true); setError('');
    try { const [data,status] = await Promise.all([api.catalog(),api.health()]); setCatalog(data); setHealth(status); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load BookClub.'); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);
  useEffect(() => { void load(); },[load]);
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
  const eligible = classics.filter(m => m.ranking?.eligible);
  const excluded = classics.filter(m => !m.ranking?.eligible);
  const missing = catalog ? missingAnswers(catalog.movies,catalog.members).length : 0;
  const isDetail = page.startsWith('movie/');
  const title = isDetail ? 'Film detail' : destinations.find(d => d.path === page)?.label ?? 'Page not found';
  const subtitles: Record<string,string> = { home: 'A weekly ritual. A growing collection.',history: 'Every night has a story.',event: 'Make room for the next great film.',classics: 'The next watch, decided together.',seen: 'A quick answer keeps the list moving.' };
  return <div className="bookclub-shell"><header className="site-header"><a className="brand" href="#/home"><Clapperboard aria-hidden="true" /><span>BookClub<small>THE WEEKLY FILM JOURNAL</small></span></a><span className="header-tag">{health?.demo ? 'LOCAL DEMO' : 'FILM CLUB'}</span></header>
    <main id="main"><div className="page-heading"><div><p className="eyebrow">FOUR PEOPLE · ONE SHARED SCREEN</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p className="subtitle">{subtitles[page] ?? 'The film, the scores, and our shared history.'}</p></div><Action icon={RefreshCw} aria-label="Refresh BookClub data" disabled={refreshing} onClick={() => void load()} /></div>
    {notice && <div className="notice" role="status"><Check size={20} aria-hidden="true" /><span>{notice}</span><Action icon={X} aria-label="Dismiss message" onClick={() => setNotice('')} /></div>}
    {health?.demo && <p className="demo-label"><Info size={16} aria-hidden="true" />Development fixtures · events and ratings are illustrative</p>}
    {health && !health.writesEnabled && <p className="notice">This API is read-only. Authentication must be configured before production writes.</p>}
    {loading ? <div className="loading-state" role="status">Loading the film journal…</div> : error ? <Failure message={error} retry={() => void load()} /> : catalog && <>
      {page === 'home' && <div className="stack"><section className="welcome card"><div><p className="eyebrow">NEXT UP</p><h2>A good night starts<br />with a good film.</h2><p>Gather the four. Choose the films. Keep the story.</p><RouteLink to="event" icon={CalendarPlus}>Start an event</RouteLink></div><Clapperboard className="welcome-icon" aria-hidden="true" /></section>
      <div className="stats-grid"><div className="card stat"><strong>{eligible.length}</strong><span>Eligible Classics</span></div><div className="card stat"><strong>{excluded.length}</strong><span>Already seen by all</span></div><a className="card stat stat-link" href="#/seen"><strong>{missing}</strong><span><Eye size={16} aria-hidden="true" />Missing answers</span></a></div>
      <div className="dashboard-grid"><section className="stack"><div className="section-title"><h2>Last time together</h2><RouteLink to="history" icon={History}>History</RouteLink></div>{catalog.sessions[0] ? <SessionCard session={catalog.sessions[0]} members={catalog.members} /> : <Empty title="Your first night is waiting">Create an event to begin your shared history.</Empty>}</section>
      <section className="stack"><div className="section-title"><h2>On the shortlist</h2><RouteLink to="classics" icon={ChevronRight}>View all</RouteLink></div>{eligible.slice(0,3).map((m,i) => <RankingCard key={m.id} movie={m} rank={i+1} />)}{!eligible.length && <Empty title="No eligible Classics">Open Classics to inspect the candidate pool.</Empty>}</section></div></div>}
      {page === 'history' && <div className="history-grid">{catalog.sessions.map(s => <SessionCard key={s.id} session={s} members={catalog.members} />)}{!catalog.sessions.length && <Empty title="No events yet"><RouteLink to="event" icon={CalendarPlus}>Create your first event</RouteLink></Empty>}</div>}
      {page === 'event' && <EventScreen catalog={catalog} writesEnabled={health?.writesEnabled ?? false} onMovie={applyMovie} onSaved={session => {
        setCatalog(c => c ? {...c,sessions: [session,...c.sessions].sort((a,b) => b.event_date.localeCompare(a.event_date))} : c);
        setNotice('Event saved to the film journal.'); window.location.hash = '/history';
      }} />}
      {page === 'classics' && <div className="stack"><div className="classics-toolbar"><p className="meta">Live ranking · provisional formula</p><Action icon={Library} aria-pressed={disqualified} onClick={() => setDisqualified(v => !v)}>{disqualified ? 'Show eligible' : `Disqualified (${excluded.length})`}</Action></div><div className="classics-grid">{(disqualified ? excluded : eligible).map((m,i) => <RankingCard key={m.id} movie={m} rank={disqualified ? undefined : i+1} />)}</div>{!(disqualified ? excluded : eligible).length && <Empty title={disqualified ? 'No disqualified films' : 'No eligible films'}>Candidates appear here when they belong to the Classics pool.</Empty>}</div>}
      {page === 'seen' && <SeenScreen catalog={catalog} answer={answer} writesEnabled={health?.writesEnabled ?? false} />}
      {isDetail && <DetailScreen key={page} id={page.slice(6)} members={catalog.members} answer={answer} writesEnabled={health?.writesEnabled ?? false} />}
      {!isDetail && !destinations.some(d => d.path === page) && <Empty title="Page not found"><RouteLink to="home" icon={Home}>Go home</RouteLink></Empty>}
    </>}
    <footer className="data-sources"><h2><Info size={18} aria-hidden="true" />About & data sources</h2><p>BookClub is a film journal for four people. Local demo scores are invented examples; no IMDb or critic integration is connected.</p><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><Info size={16} aria-hidden="true" /><img className="tmdb-logo" src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="The Movie Database" /></a><p>Classics scores are provisional. The historical spreadsheet formula and importer will follow.</p></footer>
    </main><nav className="bottom-nav" aria-label="Primary navigation">{destinations.map(({path,label,icon: Icon}) => <a key={path} href={`#/${path}`} aria-current={page === path ? 'page' : undefined}><Icon size={22} aria-hidden="true" /><span>{label}</span></a>)}</nav>
  </div>;
}
