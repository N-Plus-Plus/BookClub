import { lazy, Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, ChartNoAxesColumn, CalendarPlus, ListPlus, Check, ChevronRight, Eye, History, Home, Info, Library, Plus, RefreshCw, X } from 'lucide-react';
import type { Catalog, FilmCandidate, Movie, MovieDetail, TmdbPreview, Viewer, Rotation } from '../shared/types';
import { metricsSummary } from '../shared/metrics';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { SignInScreen } from './SignInScreen';
import { api, ApiClientError, clearSession, hasSession, setDevMember, setUnauthorizedHandler, storeSession, type Health } from './api';
import { Action, Empty, Failure, LoadingView, RankingCard, RouteLink, SessionCard } from './components';
import { EventScreen } from './EventScreen';
import { SeenScreen } from './SeenScreen';
import { patchCatalogMovie, useSeenAnswers } from './seen-answers';
import { DetailScreen } from './DetailScreen';
import { PreviewScreen } from './PreviewScreen';
import { HistoryScreen } from './HistoryScreen';
import { AddClassicModal } from './AddClassicModal';
import { ClassicsScreen } from './ClassicsScreen';
import { AvatarScreen } from './AvatarScreen';
import { AccountMenu } from './AccountMenu';
import { BuilderScreen } from './BuilderScreen';
import { RotationCard } from './RotationCard';
import { needsAvatar } from '../shared/identity';
import { AdminScreen } from './AdminScreen';
import { MetricsScreen } from './MetricsScreen';
import { MetricsEnrichmentResource } from './metrics-cache';
import { Navigation, destinations } from './Navigation';
import { selectShellTitle } from './app-shell-title';

const DevTools = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview' ? lazy(() => import('./DevTools')) : null;
const localLogin = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview';
type Inspection = {source: string; target: string; candidate: FilmCandidate; preview?: TmdbPreview; pending?: Promise<TmdbPreview>};
const route = () => window.location.hash.slice(2) || 'home';
export function App() {
  const [historyOldestFirst,setHistoryOldestFirst] = useState(false);
  const historyContext = useRef(false);
  const [builderEditing,setBuilderEditing] = useState(false);
  const builderEditorChanged = useCallback((editing: boolean) => setBuilderEditing(editing),[]);
  const [newSetRequest,setNewSetRequest] = useState(0);
  const [addingClassic,setAddingClassic] = useState(false);
  const [page,setPage] = useState(route);
  const pageRef = useRef(page);
  const [shellTitle,setShellTitle] = useState(() => selectShellTitle(page));
  useEffect(() => { if (page === 'history') historyContext.current = true; },[page]);
  const [inspection,setInspection] = useState<Inspection | null>(null);
  const inspectionRef = useRef<Inspection | null>(null);
  const [confirmedMovie,setConfirmedMovie] = useState<Movie | null>(null);
  const consumeConfirmedMovie = useCallback(() => setConfirmedMovie(null),[]);
  const [inspectionError,setInspectionError] = useState('');
  const [confirming,setConfirming] = useState(false);
  const confirmInFlight = useRef(false);
  const confirmedReturn = useRef<string | null>(null);
  const [eventPrefill,setEventPrefill] = useState<string[] | null>(null);
  const consumeEventPrefill = useCallback(() => setEventPrefill(null),[]);
  const [navigationExpanded,setNavigationExpanded] = useState(true);
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const [health,setHealth] = useState<Health | null>(null);
  const [rotation,setRotation] = useState<Rotation | null>(null);
  const [viewer,setViewer] = useState<Viewer | null>(null);
  const metricsResource=useMemo(()=>new MetricsEnrichmentResource(),[viewer?.id]);
  const metricsResourceRef=useRef(metricsResource);metricsResourceRef.current=metricsResource;
  const seenAnswers = useSeenAnswers(viewer?.id ?? '',setCatalog,api.seen);
  const seenRef = useRef(seenAnswers); seenRef.current = seenAnswers;
  const [authBusy,setAuthBusy] = useState(false);
  const generation = useRef(0);
  const rotationRevision = useRef(0);
  const [loadError,setLoadError] = useState('');
  const [actionError,setActionError] = useState('');
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetAuth = useCallback(() => {
    generation.current++; confirmedReturn.current = null; inspectionRef.current = null; setInspection(null); setConfirmedMovie(null); setEventPrefill(null); setRotation(null); setCatalog(null); setViewer(null); setNotice(''); setLoadError(''); setActionError(''); setLoading(false);
  },[]);
  const load = useCallback(async () => {
    metricsResourceRef.current.invalidate();
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
      const read = seenRef.current.beginCatalogRead(), turnRevision = rotationRevision.current;
      try {
        const [data,turn] = await Promise.all([api.catalog(),api.rotation()]);
        if (current === generation.current) { setCatalog(read.apply(data)); if (turnRevision === rotationRevision.current) setRotation(turn); }
      } finally { read.release(); }
    } catch (e) {
      if (current === generation.current && !(e instanceof ApiClientError && e.status === 401)) setLoadError(e instanceof Error ? e.message : 'Could not load BookClub.');
    } finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  },[]);
  const refreshData = useCallback(async () => {
    metricsResource.invalidate();
    const current = ++generation.current;
    setRefreshing(true); setLoadError('');
    try {
      const read = seenRef.current.beginCatalogRead(), turnRevision = rotationRevision.current;
      try {
        const [data,turn] = await Promise.all([api.catalog(),api.rotation()]);
        if (current === generation.current) { setCatalog(read.apply(data)); if (turnRevision === rotationRevision.current) setRotation(turn); }
      } finally { read.release(); }
    } catch (error) {
      if (current === generation.current && !(error instanceof ApiClientError && error.status === 401)) setLoadError(error instanceof Error ? error.message : 'Could not load BookClub.');
    } finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  },[metricsResource]);
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
      if (next === 'history') historyContext.current = true;
      else if (!(historyContext.current && next.startsWith('movie/') && (pageRef.current === 'history' || pageRef.current.startsWith('movie/')))) { historyContext.current = false; setHistoryOldestFirst(false); }
      if (context && next !== context.target) { inspectionRef.current = null; setInspection(null); setInspectionError(''); if (next !== context.source) setConfirmedMovie(null); }
      if (next !== 'event' && next !== context?.target) setEventPrefill(null);
      if (!context && pageRef.current === 'seen' && next.startsWith('movie/')) {
        const context: Inspection = {source:'seen',target:next,candidate:{kind:'local',movie:{id:next.slice(6),title:'',year:null,tmdbId:null,poster:null}}};
        inspectionRef.current = context; setInspection(context);
      }
      const acceptedReturn = confirmedReturn.current === next;
      if (confirmedReturn.current) { confirmInFlight.current = false; setConfirming(false); }
      confirmedReturn.current = null;
      if (next !== pageRef.current) setShellTitle(selectShellTitle(next));
      pageRef.current = next; setPage(next); window.scrollTo(0,0); if (!acceptedReturn) requestAnimationFrame(() => heading.current?.focus()); };
    window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange',update);
  },[]);
  const applyMovie = (movie: MovieDetail | Movie) => setCatalog(current => current
    ? patchCatalogMovie(current,seenAnswers.reconcile(movie,current)) : current);

  const inspect = (candidate: FilmCandidate,preview?: TmdbPreview,pending?: Promise<TmdbPreview>) => {
    const target = candidate.kind === 'local' ? `movie/${candidate.movie.id}` : `preview/tmdb/${candidate.movie.externalId}`;
    const context = {source:page,target,candidate,preview,pending};
    inspectionRef.current = context; setInspection(context); setInspectionError(''); window.location.hash = `/${target}`;
  };
  const confirmFilm = async () => {
    const context = inspectionRef.current;
    if (!context || confirmInFlight.current) return;
    confirmInFlight.current = true; setConfirming(true); setInspectionError('');
    let accepted = false;
    try {
      const candidate = context.candidate;
      const movie = candidate.kind === 'local'
        ? catalog?.movies.find(movie => movie.id === candidate.movie.id) ?? await api.detail(candidate.movie.id)
        : await api.importMovie(candidate.movie.externalId);
      if (inspectionRef.current !== context) return;
      accepted = true; applyMovie(movie); confirmedReturn.current = context.source; setConfirmedMovie(movie); window.location.hash = `/${context.source}`;
    } catch (error) {
      if (inspectionRef.current === context) setInspectionError(error instanceof Error ? error.message : 'Could not add this film. Try again.');
    } finally { if (!accepted) { confirmInFlight.current = false; setConfirming(false); } }
  };

  const quickFacts = useMemo(() => catalog ? metricsSummary(catalog) : null,[catalog]);
  const classics = useMemo(()=>catalog ? sortClassics(catalog.movies.filter(m=>m.classic)) : [],[catalog]);
  const eligible = useMemo(()=>classics.filter(m=>m.ranking?.eligible && m.ranking.rankable),[classics]);
  const excluded = useMemo(()=>classics.filter(m=>!m.ranking?.eligible),[classics]);
  const missing = useMemo(()=>catalog ? missingAnswers(catalog.movies,catalog.members,viewer?.id ?? '',new Set(catalog.sessions.flatMap(s=>s.movies.map(m=>m.id)))).length : 0,[catalog,viewer?.id]);
  const isPreview = page.startsWith('preview/tmdb/');
  const isDetail = page.startsWith('movie/') || isPreview;
  const detailContext = inspection && page === inspection.target;
  const inspecting = detailContext && inspection.source !== 'seen';
  const builderInspection = detailContext && inspection.source === 'builder';
  const eventRoute = page === 'event' || page.startsWith('event/') ? page : inspecting && inspection.source !== 'builder' ? inspection.source : null;
  const localDevelopment = localLogin && health?.environment === 'local' && !health.authenticationRequired;
  const isAdminPage = page === 'admin' && viewer?.role === 'admin';
  const destination = destinations.find(d => d.path === page);
  const headingImage = isDetail ? 'filmdetails.png' : isAdminPage ? 'admin.png' : (page === 'event' || page.startsWith('event/')) ? 'event.png' : destination?.image;
  const title = (page === 'event' || page.startsWith('event/')) ? 'Event' : isDetail ? 'Film detail' : isAdminPage ? 'Admin' : destination?.label ?? 'Page not found';
  const writesEnabled = Boolean(health && (!health.authenticationRequired || viewer));
  if ((localLogin || health?.authenticationRequired) && health && !viewer && !loading) return <SignInScreen configured={health.googleAuthConfigured} error={actionError || loadError} busy={authBusy} onCredential={signIn} onLocalLogin={localLogin ? signInAsTroy : undefined} onRetry={() => void load()} />;
  if (needsAvatar(viewer) && viewer) return <AvatarScreen viewer={viewer} externalError={actionError || loadError} onClaimed={claimed => { setViewer(claimed); void load(); }} onLogout={() => void logout()} />;
  return <div className={`app-layout ${navigationExpanded ? 'navigation-expanded' : 'navigation-collapsed'}`}>{localDevelopment && health?.demo && <p className="demo-label"><Info size={12} aria-hidden="true" />Local disposable database</p>}<Navigation page={page} expanded={navigationExpanded} onToggle={() => setNavigationExpanded(value => !value)} /><div className="bookclub-shell"><header className="site-header"><a className="brand" href="#/home"><img className="brand-icon" src={`${import.meta.env.BASE_URL}newFav/fav1.png`} alt="" /><span>{page === 'home' ? 'Book Club' : shellTitle}<small>HAVE YOU UPDATED THE SPREADSH... WEB APP?</small></span></a><div className="viewer-controls">{viewer ? <AccountMenu viewer={viewer} busy={authBusy} onLogout={() => void logout()} /> : <span className="header-tag">{health?.demo ? 'LOCAL DEMO' : 'FILM CLUB'}</span>}</div></header>
    <main id="main"><div className="page-heading"><div className="page-title-region"><h1 ref={heading} tabIndex={-1}>{headingImage && <img className="destination-icon" src={`${import.meta.env.BASE_URL}buttons/${headingImage}`} alt="" />}{title}</h1>{page.startsWith('event/') && <p className="subtitle">Correct the event details and film lineup.</p>}</div>{page === 'builder' && !builderEditing && viewer && writesEnabled && catalog && <div className="page-heading-actions"><Action icon={Plus} variant="primary" onClick={() => setNewSetRequest(value => value+1)}>New set</Action></div>}{page === 'classics' && viewer && writesEnabled && catalog && <div className="page-heading-actions"><Action icon={Plus} variant="primary" onClick={() => setAddingClassic(true)}>Add Classic</Action></div>}{detailContext && inspection.source === 'seen' && <Action icon={ArrowLeft} onClick={() => { window.location.hash = '/seen'; }}>Back</Action>}{builderInspection && <div className="page-heading-actions"><Action icon={Plus} variant="primary" disabled={confirming || !writesEnabled} onClick={() => void confirmFilm()}>{confirming ? 'Adding…' : 'Add to Set'}</Action></div>}{inspecting && !builderInspection && <div className="button-set inspection-actions"><Action icon={X} disabled={confirming} onClick={() => { window.location.hash = `/${inspection.source}`; }}>Nope, this isn't it</Action><Action icon={Check} variant="primary" disabled={confirming || !writesEnabled} onClick={() => void confirmFilm()}>{confirming ? 'Adding…' : 'Yes, this one!'}</Action></div>}</div>
    {page === 'classics' && addingClassic && viewer && writesEnabled && catalog && <AddClassicModal catalog={catalog} onMovie={applyMovie} onClose={() => setAddingClassic(false)} />}{inspectionError && inspecting && <p className="error-message" role="alert">{inspectionError}</p>}
    {notice && <div className="notice" role="status"><Check size={20} aria-hidden="true" /><span>{notice}</span><Action icon={X} aria-label="Dismiss message" onClick={() => setNotice('')} /></div>}
    {isAdminPage && DevTools && localDevelopment && catalog && <Suspense fallback={null}><DevTools members={catalog.members} onChanged={load} /></Suspense>}
    {catalog && loadError && <div className="refresh-failure" role="alert"><p>Could not load BookClub data. Showing the last loaded journal.</p><p className="meta">{loadError}</p><Action icon={RefreshCw} variant="secondary" disabled={refreshing} onClick={() => void load()}>Try again</Action></div>}
    {page !== 'seen' && seenAnswers.failures.length > 0 && <p className="error-message" role="alert">{seenAnswers.failures.length} Seen answers are unsaved. <RouteLink to="seen" icon={Eye}>Review and retry</RouteLink></p>}
    {actionError && <p className="error-message" role="alert">{actionError}</p>}
    {catalog && refreshing && <p className="meta refresh-status" role="status">Refreshing the journal…</p>}
    {loading && !catalog ? <LoadingView /> : !catalog && loadError ? <Failure message={loadError} retry={() => void load()} /> : catalog && <>
      {page === 'home' && <div className="stack home-dashboard"><RotationCard catalog={catalog} rotation={rotation} viewer={viewer} onUpdated={turn => { rotationRevision.current++; setRotation(turn); }} onUseBuilder={movieIds => { setEventPrefill(movieIds); window.location.hash = '/event'; }} />

      <div className="dashboard-grid"><section className="stack"><div className="section-title"><h2>Last turn</h2><RouteLink to="history" icon={History} variant="tertiary">History</RouteLink></div>{catalog.sessions[0] ? <SessionCard variant="home" session={catalog.sessions[0]} members={catalog.members} /> : <Empty title="Your first night is waiting">Create an event to begin your shared history.</Empty>}</section>
      <section className="stack"><div className="section-title"><h2>Next Classics</h2><RouteLink to="classics" icon={ChevronRight} variant="tertiary">View all</RouteLink></div>{eligible.slice(0,2).map((m,i) => <RankingCard variant="home" key={m.id} movie={m} rank={i+1} />)}{!eligible.length && <Empty title="No eligible Classics">Open Classics to inspect the candidate pool.</Empty>}</section></div><section className="stack"><div className="section-title"><h2>Classics Snapshot</h2><RouteLink to="classics" icon={ChevronRight} variant="tertiary">View all</RouteLink></div><div className="stats-grid"><div className="card stat"><strong>{eligible.length}</strong><span>Eligible Classics</span></div><div className="card stat"><strong>{excluded.length}</strong><span>Already seen by all</span></div><a className="card stat stat-link" href="#/seen"><strong>{missing}</strong><span>Missing answers</span></a></div></section>{quickFacts && <section className="stack home-quick-facts"><div className="section-title"><h2>Quick Facts</h2></div><div className="stats-grid">{[['Events',quickFacts.events],['Films brought',quickFacts.appearances],['Average IMDb / 10',quickFacts.imdbAverage === null ? '—' : quickFacts.imdbAverage.toFixed(2)]].map(([label,value]) => <div className="card stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>}</div>}
      {page === 'history' && <HistoryScreen oldestFirst={historyOldestFirst} onSortChange={setHistoryOldestFirst} viewer={viewer} catalog={catalog} onChanged={() => void refreshData()} />}
      {isAdminPage && <AdminScreen onEnrichmentChanged={()=>metricsResource.invalidate()} catalog={catalog} rotation={rotation} onRotationUpdated={turn => { rotationRevision.current++; setRotation(turn); }} writesEnabled={writesEnabled} onMovie={applyMovie} onUpdated={refreshData} />}
      {page === 'metrics' && <MetricsScreen resource={metricsResource} catalog={catalog} viewer={viewer} onUpdated={refreshData} />}
      {(page === 'builder' || builderInspection) && <div hidden={Boolean(builderInspection)}><BuilderScreen onEditorChanged={builderEditorChanged} newSetRequest={newSetRequest} onInspect={inspect} confirmedMovie={page === 'builder' ? confirmedMovie : null} onConfirmedConsumed={consumeConfirmedMovie} key={viewer?.id} catalog={catalog} viewer={viewer} rotation={rotation} onMovie={applyMovie} onPublished={() => { void refreshData(); setNotice('Set added to History.'); window.location.hash = '/history'; }} /></div>}
      {eventRoute && (eventRoute === 'event' || catalog.sessions.some(s => s.id === eventRoute.slice(6))) && <div hidden={Boolean(inspecting)} key={eventRoute}><EventScreen onInspect={inspect} confirmedMovie={page === eventRoute ? confirmedMovie : null} onConfirmedConsumed={consumeConfirmedMovie} prefillMovieIds={eventRoute === 'event' ? eventPrefill : null} onPrefillConsumed={consumeEventPrefill} initial={eventRoute === 'event' ? undefined : catalog.sessions.find(s => s.id === eventRoute.slice(6))} viewer={viewer} rotation={rotation} catalog={catalog} writesEnabled={writesEnabled} onMovie={applyMovie} onSaved={() => {
        void refreshData(); setNotice('Event saved to the film journal.'); window.location.hash = '/history';
      }} /></div>}
      {page.startsWith('event/') && !catalog.sessions.some(s => s.id === page.slice(6)) && <Empty title="Event not found">The event may have been deleted. Return to History to review available events.</Empty>}
      {page === 'classics' && <ClassicsScreen viewer={viewer} catalog={catalog} onUpdated={refreshData} movies={classics} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {(page === 'seen' || (detailContext && inspection.source === 'seen')) && <div hidden={page !== 'seen'}><SeenScreen key={viewer?.id} viewerId={viewer?.id ?? ''} catalog={catalog} answer={seenAnswers.answer} pending={seenAnswers.pending} failures={seenAnswers.failures} retry={seenAnswers.retry} writesEnabled={writesEnabled} /></div>}
      {isDetail && !isPreview && <DetailScreen key={page} id={page.slice(6)} members={catalog.members} />}
      {isPreview && <PreviewScreen key={page} id={page.slice('preview/tmdb/'.length)} preview={inspecting ? inspection.preview : undefined} pending={inspecting ? inspection.pending : undefined} />}
      {!isAdminPage && !isDetail && page !== 'event' && !page.startsWith('event/') && !destinations.some(d => d.path === page) && <Empty title="Page not found"><RouteLink to="home" icon={Home}>Go home</RouteLink></Empty>}
    </>}
    <footer className="data-sources"><details><summary><Info size={18} aria-hidden="true" />Data sources & attribution</summary><div className="stack"><p>Ratings are stored snapshots, not live values. MDBList and OMDb retrieve third-party ratings; BookClub has no direct IMDb, Rotten Tomatoes or Letterboxd API relationship.</p><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><img className="tmdb-logo" src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="The Movie Database" /></a><p><a href="https://mdblist.com/" target="_blank" rel="noreferrer">MDBList</a> · <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer">OMDb</a></p></div></details></footer>
    </main></div></div>;
}
