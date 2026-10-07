import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Catalog, Movie, MovieDetail } from '../shared/types';
import { rankMovie } from '../shared/ranking';

export interface SeenSave { movieId: string; memberId: string; seen: boolean | null; title: string; status: 'queued' | 'saving' | 'failed'; message?: string }
export function patchCatalogMovie(catalog: Catalog, movie: Movie): Catalog {
  if (movie.au_classification === undefined) {
    const existing = catalog.movies.find(m => m.id === movie.id);
    if (existing?.au_classification !== undefined) movie = {...movie,au_classification:existing.au_classification};
  }
  return {...catalog,movies:catalog.movies.some(m => m.id === movie.id) ? catalog.movies.map(m => m.id === movie.id ? movie : m) : [...catalog.movies,movie],
    sessions:catalog.sessions.map(s => ({...s,movies:s.movies.map(m => m.id === movie.id ? movie : m)}))};
}
function withAnswer(movie: Movie, task: SeenSave, catalog: Catalog): Movie {
  const seen = movie.seen.filter(s => s.member_id !== task.memberId);
  if (task.seen !== null) seen.push({member_id:task.memberId,seen:Number(task.seen),updated_at:new Date().toISOString()});
  return {...movie,seen,ranking:movie.classic ? rankMovie(movie.scores,seen,catalog.members,movie.classics_membership?.rank_seed ?? 0) : null};
}
/** App-owned FIFO survives route changes. Failed latest intentions remain explicit until retry/correction. */
export function useSeenAnswers(viewerId: string, setCatalog: Dispatch<SetStateAction<Catalog | null>>,
  save: (movieId:string,memberId:string,seen:boolean|null) => Promise<MovieDetail>) {
  const [saves,setSaves] = useState<SeenSave[]>([]);
  const latest = useRef(new Map<string,SeenSave>()), queue = useRef<SeenSave[]>([]), running = useRef(false);
  const catalogReads = useRef(new Set<Map<string,SeenSave>>());
  const identity = useRef(viewerId), generation = useRef(0), mounted = useRef(true);
  const saveRef = useRef(save); saveRef.current = save;
  const key = (task: SeenSave) => `${task.movieId}:${task.memberId}`;
  const publish = () => { if (mounted.current) setSaves([...latest.current.values()].map(task => ({...task}))); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; queue.current = []; latest.current.clear(); catalogReads.current.clear(); }; },[]);
  useEffect(() => {
    if (identity.current === viewerId) return;
    identity.current = viewerId; generation.current++; queue.current = []; latest.current.clear(); catalogReads.current.clear(); publish();
  },[viewerId]);
  const reconcile = (movie: Movie, catalog: Catalog) => {
    for (const task of latest.current.values()) if (task.movieId === movie.id) movie = withAnswer(movie,task,catalog);
    return movie;
  };
  const drain = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const task = queue.current.shift()!, epoch = generation.current;
        task.status = 'saving'; publish();
        try {
          const movie = await saveRef.current(task.movieId,task.memberId,task.seen);
          if (epoch !== generation.current || !mounted.current) continue;
          if (latest.current.get(key(task)) === task) latest.current.delete(key(task));
          setCatalog(catalog => catalog ? patchCatalogMovie(catalog,reconcile(movie,catalog)) : catalog);
        } catch (error) {
          if (epoch !== generation.current || !mounted.current) continue;
          task.status = 'failed'; task.message = error instanceof Error ? error.message : 'Could not confirm this answer.';
          // A newer state-setting answer supersedes this failed attempt, and remains queued.
        }
        publish();
      }
    } finally { running.current = false; }
  };
  const answer = (movieId: string,memberId: string,seen: boolean | null,title: string) => {
    if (!viewerId || memberId !== viewerId) return;
    const task: SeenSave = {movieId,memberId,seen,title,status:'queued'};
    latest.current.set(key(task),task); queue.current.push(task);
    for (const read of catalogReads.current) read.set(key(task),task);
    setCatalog(catalog => {
      const movie = catalog?.movies.find(m => m.id === movieId);
      return catalog && movie ? patchCatalogMovie(catalog,withAnswer(movie,task,catalog)) : catalog;
    });
    publish(); void drain();
  };
  const retry = (task: SeenSave) => {
    const current = latest.current.get(key(task));
    if (current?.status === 'failed') answer(current.movieId,current.memberId,current.seen,current.title);
  };
  const reconcileCatalog = (catalog:Catalog, intentions:Iterable<SeenSave> = latest.current.values()): Catalog => {
    const byMovie = new Map<string,SeenSave[]>();
    for (const task of intentions) { const group = byMovie.get(task.movieId) ?? []; group.push(task); byMovie.set(task.movieId,group); }
    const movies = catalog.movies.map(movie => {
      for (const task of byMovie.get(movie.id) ?? []) movie = withAnswer(movie,task,catalog);
      return movie;
    });
    const byId = new Map(movies.map(movie => [movie.id,movie]));
    return {...catalog,movies,sessions:catalog.sessions.map(session => ({...session,movies:session.movies.map(movie => byId.get(movie.id) ?? movie)}))};
  };
  // Keep intentions during an in-flight snapshot even if their writes finish
  // before that older snapshot arrives. Drop this temporary map after the read.
  const beginCatalogRead = () => {
    const intentions = new Map(latest.current); catalogReads.current.add(intentions);
    return {apply:(catalog:Catalog) => {
      for (const [key,task] of latest.current) intentions.set(key,task);
      return reconcileCatalog(catalog,intentions.values());
    },release:() => { catalogReads.current.delete(intentions); }};
  };
  return {answer,retry,reconcile,reconcileCatalog,beginCatalogRead,pending:saves.filter(s => s.status !== 'failed').length,failures:saves.filter(s => s.status === 'failed')};
}
