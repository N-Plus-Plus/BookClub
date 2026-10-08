import { useCallback, useMemo, useRef, useState } from 'react';
import type { Catalog, Movie, MovieDetail, Rotation, Viewer, JournalMutationResult } from '../shared/types';
import { needsAvatar } from '../shared/identity';
import { api, ApiClientError, hasSession, type Health } from './api';
import { MetricsEnrichmentResource } from './metrics-cache';
import { patchCatalogMovie, useSeenAnswers } from './seen-answers';

export type JournalMutationReader = (operation:()=>Promise<JournalMutationResult>)=>Promise<JournalMutationResult>;

export function useBookClubData(localLogin:boolean) {
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const catalogRef = useRef(catalog); catalogRef.current = catalog;
  const [health,setHealth] = useState<Health | null>(null);
  const [rotation,setRotation] = useState<Rotation | null>(null);
  const [viewer,setViewer] = useState<Viewer | null>(null);
  // Identity changes intentionally replace the authenticated resource lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const metricsResource=useMemo(()=>new MetricsEnrichmentResource(),[viewer?.id]);
  const metricsResourceRef=useRef(metricsResource);metricsResourceRef.current=metricsResource;
  const seenAnswers = useSeenAnswers(viewer?.id ?? '',setCatalog,api.seen);
  const seenRef = useRef(seenAnswers); seenRef.current = seenAnswers;
  const generation = useRef(0);
  const rotationRevision = useRef(0);
  const journalRevision = useRef(0);
  const [loadError,setLoadError] = useState('');
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const readJournal = useCallback(async (current:number) => {
      const read = seenRef.current.beginCatalogRead(), turnRevision = rotationRevision.current, snapshotRevision = journalRevision.current;
      try {
        const [data,turn] = await Promise.all([api.catalog(),api.rotation()]);
        if (current === generation.current) { if (snapshotRevision === journalRevision.current) setCatalog(read.apply(data)); if (turnRevision === rotationRevision.current) setRotation(turn); }
      } finally { read.release(); }
  },[]);
  const load = useCallback(async () => {
    metricsResourceRef.current.invalidate();
    const current = ++generation.current;
    setRefreshing(true); setLoadError('');
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
      await readJournal(current);
    } catch (e) {
      if (current === generation.current && !(e instanceof ApiClientError && e.status === 401)) setLoadError(e instanceof Error ? e.message : 'Could not load BookClub.');
    } finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  },[localLogin,readJournal]);
  const refreshData = useCallback(async () => {
    metricsResource.invalidate();
    const current = ++generation.current;
    setRefreshing(true); setLoadError('');
    try {
      await readJournal(current);
    } catch (error) {
      if (current === generation.current && !(error instanceof ApiClientError && error.status === 401)) setLoadError(error instanceof Error ? error.message : 'Could not load BookClub.');
    } finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  },[metricsResource,readJournal]);
  const clear = useCallback(() => {
    generation.current++; setRotation(null); setCatalog(null); setViewer(null); setLoadError(''); setLoading(false);
  },[]);
  const dispose = useCallback(() => { generation.current++; },[]);
  const applyMovie = (movie:MovieDetail|Movie) => setCatalog(current => current
    ? patchCatalogMovie(current,seenAnswers.reconcile(movie,current)) : current);
  const updateRotation = (turn:Rotation|null) => {rotationRevision.current++; setRotation(turn);};
  // Retain Seen intentions for the entire request, even when their saves finish
  // before an older journal response arrives. Reuse the existing snapshot lease.
  const readJournalMutation:JournalMutationReader = async operation => {
    const read = seenRef.current.beginCatalogRead();
    try {
      const result = await operation(), current = catalogRef.current;
      if (!result.session || !current) return result;
      const committed = {...current,sessions:[...current.sessions.filter(session => session.id !== result.session!.id),result.session]};
      return {...result,session:{...result.session,
        movies:result.session.movies.map(movie => read.reconcileMovie(movie,committed))}};
    } finally { read.release(); }
  };
  const applyJournalMutation = (result:JournalMutationResult) => {
    journalRevision.current++;
    metricsResourceRef.current.invalidate();
    if ('rotation' in result) updateRotation(result.rotation ?? null);
    setCatalog(current => {
      if (!current) return current;
      // Establish the committed History appearance before overlaying Seen intentions.
      let next = result.session ? {...current,sessions:[...current.sessions.filter(session => session.id !== result.session!.id),result.session]} : current;
      for (const movie of new Map(result.session?.movies.map(movie => [movie.id,movie])).values()) next = patchCatalogMovie(next,seenRef.current.reconcile(movie,next));
      const byId = new Map(next.movies.map(movie => [movie.id,movie]));
      let sessions = next.sessions.filter(session => session.id !== result.removedSessionId);
      if (result.session) {
        const session = {...result.session,movies:result.session.movies.map(movie => byId.get(movie.id) ?? movie)};
        sessions = [...sessions.filter(existing => existing.id !== session.id),session];
      }
      const dates = new Map(result.affectedSessionDates?.map(change => [change.id,change]));
      sessions = sessions.map(session => dates.has(session.id) ? {...session,...dates.get(session.id)!} : session)
        .sort((a,b) => b.event_date.localeCompare(a.event_date) || (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.id.localeCompare(b.id));
      const cycles = result.cycle ? [...next.cycles.filter(cycle => cycle.id !== result.cycle!.id),result.cycle]
        .sort((a,b) => b.ordinal-a.ordinal || a.id.localeCompare(b.id)) : next.cycles;
      return {...next,sessions,cycles};
    });
  };
  return {catalog,health,rotation,viewer,setViewer,metricsResource,seenAnswers,loadError,loading,refreshing,load,refreshData,clear,dispose,applyMovie,updateRotation,applyJournalMutation,readJournalMutation};
}
