import { useCallback, useMemo, useRef, useState } from 'react';
import type { Catalog, Movie, MovieDetail, Rotation, Viewer } from '../shared/types';
import { needsAvatar } from '../shared/identity';
import { api, ApiClientError, hasSession, type Health } from './api';
import { MetricsEnrichmentResource } from './metrics-cache';
import { patchCatalogMovie, useSeenAnswers } from './seen-answers';

export function useBookClubData(localLogin:boolean) {
  const [catalog,setCatalog] = useState<Catalog | null>(null);
  const [health,setHealth] = useState<Health | null>(null);
  const [rotation,setRotation] = useState<Rotation | null>(null);
  const [viewer,setViewer] = useState<Viewer | null>(null);
  const metricsResource=useMemo(()=>new MetricsEnrichmentResource(),[viewer?.id]);
  const metricsResourceRef=useRef(metricsResource);metricsResourceRef.current=metricsResource;
  const seenAnswers = useSeenAnswers(viewer?.id ?? '',setCatalog,api.seen);
  const seenRef = useRef(seenAnswers); seenRef.current = seenAnswers;
  const generation = useRef(0);
  const rotationRevision = useRef(0);
  const [loadError,setLoadError] = useState('');
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const readJournal = useCallback(async (current:number) => {
      const read = seenRef.current.beginCatalogRead(), turnRevision = rotationRevision.current;
      try {
        const [data,turn] = await Promise.all([api.catalog(),api.rotation()]);
        if (current === generation.current) { setCatalog(read.apply(data)); if (turnRevision === rotationRevision.current) setRotation(turn); }
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
  return {catalog,health,rotation,viewer,setViewer,metricsResource,seenAnswers,loadError,loading,refreshing,load,refreshData,clear,dispose,applyMovie,updateRotation};
}
