import { catalogIndex } from '../shared/catalog-index';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, Check, ChevronRight, Eye, History, Home, Plus, RefreshCw, X } from 'lucide-react';
import { metricsSummary } from '../shared/metrics-summary';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { SignInScreen } from './SignInScreen';
import { api, clearSession, setDevMember, setUnauthorizedHandler, storeSession } from './api';
import { Action, Empty, Failure, LoadingView, RankingCard, RouteLink, SessionCard } from './components';
import { EventScreen } from './EventScreen';
import { SeenScreen } from './SeenScreen';
import { DetailScreen } from './DetailScreen';
import { PreviewScreen } from './PreviewScreen';
import { HistoryScreen } from './HistoryScreen';
import { AddClassicModal } from './AddClassicModal';
import { ClassicsScreen } from './ClassicsScreen';
import { AvatarScreen } from './AvatarScreen';
import { BuilderScreen } from './BuilderScreen';
import { RotationCard } from './RotationCard';
import { needsAvatar } from '../shared/identity';

import { useHashRoute } from './useHashRoute';
import { useBookClubData } from './useBookClubData';
import { useFilmInspection } from './useFilmInspection';
import { AppShell } from './AppShell';
import { resolveRoute } from './routes';

const MetricsScreen = lazy(() => import('./MetricsScreen').then(module => ({default:module.MetricsScreen})));
const AdminScreen = lazy(() => import('./AdminScreen').then(module => ({default:module.AdminScreen})));
const DevTools = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview' ? lazy(() => import('./DevTools')) : null;
const localLogin = import.meta.env.DEV && import.meta.env.MODE !== 'import-preview';
export function App() {
  const [historyOldestFirst,setHistoryOldestFirst] = useState(false);
  const historyContext = useRef(false);
  const [builderEditing,setBuilderEditing] = useState(false);
  const builderEditorChanged = useCallback((editing: boolean) => setBuilderEditing(editing),[]);
  const [newSetRequest,setNewSetRequest] = useState(0);
  const [addingClassic,setAddingClassic] = useState(false);
  const [eventPrefill,setEventPrefill] = useState<string[] | null>(null);
  const consumeEventPrefill = useCallback(() => setEventPrefill(null),[]);
  const [navigationExpanded,setNavigationExpanded]=useState(true);
  const data=useBookClubData(localLogin);
  const {catalog,health,rotation,viewer,setViewer,metricsResource,seenAnswers,loadError,loading,refreshing,refreshData,applyMovie,updateRotation,applyJournalMutation,readJournalMutation}=data;
  const [authBusy,setAuthBusy]=useState(false);
  const [actionError,setActionError]=useState('');
  const [notice,setNotice]=useState('');
  const {page,route:resolvedRoute,shellTitle,heading}=useHashRoute((next,previous)=>{
    const nextRoute=resolveRoute(next), previousRoute=resolveRoute(previous);
    if (nextRoute.kind === 'history') historyContext.current=true;
    else if (!(historyContext.current && nextRoute.kind === 'movie' && (previousRoute.kind === 'history' || previousRoute.kind === 'movie'))) {
      historyContext.current=false; setHistoryOldestFirst(false);
    }
    const result=filmInspection.onRouteChange(next,previous);
    if (!result.preserveEventPrefill) setEventPrefill(null);
    return result.focusHeading;
  });
  useEffect(()=>{if(resolvedRoute.kind === 'history')historyContext.current=true;},[resolvedRoute.kind]);
  const filmInspection=useFilmInspection(page,catalog,applyMovie);
  const {inspection,confirmedMovie,consumeConfirmedMovie,inspectionError,confirming,inspect,confirmFilm}=filmInspection;
  const resetAuth=useCallback(()=>{
    data.clear(); filmInspection.reset(); setEventPrefill(null); setNotice(''); setActionError('');
  },[data.clear,filmInspection.reset]);
  const load=useCallback(()=>{setActionError('');return data.load();},[data.load]);
  useEffect(()=>{setUnauthorizedHandler(resetAuth);void load();return()=>{data.dispose();setUnauthorizedHandler();};},[load,resetAuth,data.dispose]);
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
  const quickFacts = useMemo(() => catalog ? metricsSummary(catalog) : null,[catalog]);
  const classics = useMemo(()=>catalog ? sortClassics(catalog.movies.filter(m=>m.classic)) : [],[catalog]);
  const eligible = useMemo(()=>classics.filter(m=>m.ranking?.eligible && m.ranking.rankable),[classics]);
  const excluded = useMemo(()=>classics.filter(m=>!m.ranking?.eligible),[classics]);
  const missing = useMemo(()=>catalog ? missingAnswers(catalog.movies,catalog.members,viewer?.id ?? '',catalogIndex(catalog).historyMovieIds).length : 0,[catalog,viewer?.id]);
  const detailContext = inspection && page === inspection.target;
  const inspecting = detailContext && inspection.source !== 'seen';
  const builderInspection = detailContext && inspection.source === 'builder';
  const eventRoute = resolvedRoute.kind === 'event' ? resolvedRoute : inspecting && inspection.source !== 'builder' ? resolveRoute(inspection.source) : null;
  const localDevelopment = localLogin && health?.environment === 'local' && !health.authenticationRequired;
  const isAdminPage = resolvedRoute.kind === 'admin' && viewer?.role === 'admin';
  const shellRoute = resolvedRoute.kind === 'admin' && !isAdminPage ? resolveRoute('not-found') : resolvedRoute;
  const writesEnabled = Boolean(health && (!health.authenticationRequired || viewer));
  if ((localLogin || health?.authenticationRequired) && health && !viewer && !loading) return <SignInScreen configured={health.googleAuthConfigured} error={actionError || loadError} busy={authBusy} onCredential={signIn} onLocalLogin={localLogin ? signInAsTroy : undefined} onRetry={() => void load()} />;
  if (needsAvatar(viewer) && viewer) return <AvatarScreen viewer={viewer} externalError={actionError || loadError} onClaimed={claimed => { setViewer(claimed); void load(); }} onLogout={() => void logout()} />;
  return <AppShell navigationExpanded={navigationExpanded} onToggleNavigation={()=>setNavigationExpanded(value=>!value)} page={page} route={shellRoute} shellTitle={shellTitle} heading={heading} viewer={viewer} authBusy={authBusy} onLogout={()=>void logout()} demo={Boolean(health?.demo)} localDevelopment={localDevelopment}
    subtitle={resolvedRoute.kind === 'event' && resolvedRoute.id ? 'Correct the event details and film lineup.' : undefined}
    actions={<>{resolvedRoute.kind === 'builder' && !builderEditing && viewer && writesEnabled && catalog && <div className="page-heading-actions"><Action icon={Plus} variant="primary" onClick={() => setNewSetRequest(value => value+1)}>New set</Action></div>}{resolvedRoute.kind === 'classics' && viewer && writesEnabled && catalog && <div className="page-heading-actions"><Action icon={Plus} variant="primary" onClick={() => setAddingClassic(true)}>Add Classic</Action></div>}{detailContext && inspection.source === 'seen' && <Action icon={ArrowLeft} onClick={() => { window.location.hash = '/seen'; }}>Back</Action>}{builderInspection && <div className="page-heading-actions"><Action icon={Plus} variant="primary" disabled={confirming || !writesEnabled} onClick={() => void confirmFilm()}>{confirming ? 'Adding…' : 'Add to Set'}</Action></div>}{inspecting && !builderInspection && <div className="button-set inspection-actions"><Action icon={X} disabled={confirming} onClick={() => { window.location.hash = `/${inspection.source}`; }}>Nope, this isn't it</Action><Action icon={Check} variant="primary" disabled={confirming || !writesEnabled} onClick={() => void confirmFilm()}>{confirming ? 'Adding…' : 'Yes, this one!'}</Action></div>}</>}>
    {resolvedRoute.kind === 'classics' && addingClassic && viewer && writesEnabled && catalog && <AddClassicModal catalog={catalog} onMovie={applyMovie} onClose={() => setAddingClassic(false)} />}{inspectionError && inspecting && <p className="error-message" role="alert">{inspectionError}</p>}
    {notice && <div className="notice" role="status"><Check size={20} aria-hidden="true" /><span>{notice}</span><Action icon={X} aria-label="Dismiss message" onClick={() => setNotice('')} /></div>}
    {isAdminPage && DevTools && localDevelopment && catalog && <Suspense fallback={null}><DevTools members={catalog.members} onChanged={load} /></Suspense>}
    {catalog && loadError && <div className="refresh-failure" role="alert"><p>Could not load BookClub data. Showing the last loaded journal.</p><p className="meta">{loadError}</p><Action icon={RefreshCw} variant="secondary" disabled={refreshing} onClick={() => void load()}>Try again</Action></div>}
    {resolvedRoute.kind !== 'seen' && seenAnswers.failures.length > 0 && <p className="error-message" role="alert">{seenAnswers.failures.length} Seen answers are unsaved. <RouteLink to="seen" icon={Eye}>Review and retry</RouteLink></p>}
    {actionError && <p className="error-message" role="alert">{actionError}</p>}
    {catalog && refreshing && <p className="meta refresh-status" role="status">Refreshing the journal…</p>}
    {loading && !catalog ? <LoadingView /> : !catalog && loadError ? <Failure message={loadError} retry={() => void load()} /> : catalog && <>
      {resolvedRoute.kind === 'home' && <div className="stack home-dashboard"><RotationCard catalog={catalog} rotation={rotation} viewer={viewer} onUpdated={updateRotation} onUseBuilder={movieIds => { setEventPrefill(movieIds); window.location.hash = '/event'; }} />

      <div className="dashboard-grid"><section className="stack"><div className="section-title"><h2>Last turn</h2><RouteLink to="history" icon={History} variant="tertiary">History</RouteLink></div>{catalog.sessions[0] ? <SessionCard variant="home" session={catalog.sessions[0]} members={catalog.members} /> : <Empty title="Your first night is waiting">Create an event to begin your shared history.</Empty>}</section>
      <section className="stack"><div className="section-title"><h2>Next Classics</h2><RouteLink to="classics" icon={ChevronRight} variant="tertiary">View all</RouteLink></div>{eligible.slice(0,2).map((m,i) => <RankingCard variant="home" key={m.id} movie={m} rank={i+1} />)}{!eligible.length && <Empty title="No eligible Classics">Open Classics to inspect the candidate pool.</Empty>}</section></div><section className="stack"><div className="section-title"><h2>Classics Snapshot</h2><RouteLink to="classics" icon={ChevronRight} variant="tertiary">View all</RouteLink></div><div className="stats-grid"><div className="card stat"><strong>{eligible.length}</strong><span>Eligible Classics</span></div><div className="card stat"><strong>{excluded.length}</strong><span>Already seen by all</span></div><a className="card stat stat-link" href="#/seen"><strong>{missing}</strong><span>Missing answers</span></a></div></section>{quickFacts && <section className="stack home-quick-facts"><div className="section-title"><h2>Quick Facts</h2></div><div className="stats-grid">{[['Events',quickFacts.events],['Films brought',quickFacts.appearances],['Average IMDb / 10',quickFacts.imdbAverage === null ? '—' : quickFacts.imdbAverage.toFixed(2)]].map(([label,value]) => <div className="card stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>}</div>}
      {resolvedRoute.kind === 'history' && <HistoryScreen readJournalMutation={readJournalMutation} oldestFirst={historyOldestFirst} onSortChange={setHistoryOldestFirst} viewer={viewer} catalog={catalog} onChanged={applyJournalMutation} />}
      {isAdminPage && <Suspense fallback={<LoadingView />}><AdminScreen onEnrichmentChanged={()=>metricsResource.invalidate()} catalog={catalog} rotation={rotation} onRotationUpdated={updateRotation} writesEnabled={writesEnabled} onMovie={applyMovie} onUpdated={refreshData} /></Suspense>}
      {resolvedRoute.kind === 'metrics' && <Suspense fallback={<LoadingView />}><MetricsScreen resource={metricsResource} catalog={catalog} viewer={viewer} onUpdated={refreshData} /></Suspense>}
      {(resolvedRoute.kind === 'builder' || builderInspection) && <div hidden={Boolean(builderInspection)}><BuilderScreen readJournalMutation={readJournalMutation} onEditorChanged={builderEditorChanged} newSetRequest={newSetRequest} onInspect={inspect} confirmedMovie={resolvedRoute.kind === 'builder' ? confirmedMovie : null} onConfirmedConsumed={consumeConfirmedMovie} key={viewer?.id} catalog={catalog} viewer={viewer} rotation={rotation} onMovie={applyMovie} onPublished={result => { applyJournalMutation(result); setNotice('Set added to History.'); window.location.hash = '/history'; }} /></div>}
      {eventRoute?.kind === 'event' && (!eventRoute.id || catalogIndex(catalog).sessionById.has(eventRoute.id)) && <div hidden={Boolean(inspecting)} key={eventRoute.path}><EventScreen readJournalMutation={readJournalMutation} onInspect={inspect} confirmedMovie={page === eventRoute.path ? confirmedMovie : null} onConfirmedConsumed={consumeConfirmedMovie} prefillMovieIds={!eventRoute.id ? eventPrefill : null} onPrefillConsumed={consumeEventPrefill} initial={!eventRoute.id ? undefined : catalogIndex(catalog).sessionById.get(eventRoute.id)} viewer={viewer} rotation={rotation} catalog={catalog} writesEnabled={writesEnabled} onMovie={applyMovie} onSaved={result => {
        applyJournalMutation(result); setNotice('Event saved to the film journal.'); window.location.hash = '/history';
      }} /></div>}
      {resolvedRoute.kind === 'event' && resolvedRoute.id && !catalogIndex(catalog).sessionById.has(resolvedRoute.id) && <Empty title="Event not found">The event may have been deleted. Return to History to review available events.</Empty>}
      {resolvedRoute.kind === 'classics' && <ClassicsScreen viewer={viewer} catalog={catalog} onUpdated={refreshData} movies={classics} writesEnabled={writesEnabled} onMovie={applyMovie} />}
      {(resolvedRoute.kind === 'seen' || (detailContext && inspection.source === 'seen')) && <div hidden={resolvedRoute.kind !== 'seen'}><SeenScreen key={viewer?.id} viewerId={viewer?.id ?? ''} catalog={catalog} answer={seenAnswers.answer} pending={seenAnswers.pending} failures={seenAnswers.failures} retry={seenAnswers.retry} writesEnabled={writesEnabled} /></div>}
      {resolvedRoute.kind === 'movie' && <DetailScreen key={page} id={resolvedRoute.id} members={catalog.members} />}
      {resolvedRoute.kind === 'tmdb-preview' && <PreviewScreen key={page} id={resolvedRoute.id} preview={inspecting ? inspection.preview : undefined} pending={inspecting ? inspection.pending : undefined} />}
      {shellRoute.kind === 'not-found' && <Empty title="Page not found"><RouteLink to="home" icon={Home}>Go home</RouteLink></Empty>}
    </>}
  </AppShell>;
}
