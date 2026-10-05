import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Library, Undo2, X } from 'lucide-react';
import type { Catalog, MovieDetail } from '../shared/types';
import { api } from './api';
import { missingAnswers } from '../shared/ranking';
import { Action, Empty, MovieLink, Poster, RouteLink } from './components';

interface Recent { movieId: string; memberId: string; title: string; seen: boolean; previous: boolean | null }
export function SeenScreen({catalog,viewerId,answer,writesEnabled}: { catalog: Catalog; viewerId: string; answer: (m: string,p: string,s: boolean | null) => Promise<MovieDetail>; writesEnabled: boolean }) {
  const [submittingMovie,setSubmittingMovie] = useState<string | null>(null);
  const queue = missingAnswers(catalog.movies,catalog.members,viewerId).filter(item => item.movie.id !== submittingMovie);
  const initial = useRef(queue.length);
  const [recent,setRecent] = useState<Recent[]>([]);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [recentPage,setRecentPage] = useState(1);
  const details = useRef(new Map<string,MovieDetail>());
  const pending = useRef(new Map<string,Promise<void>>());
  const failed = useRef(new Set<string>());
  const [,setDetailsVersion] = useState(0);
  const upcomingIds = queue.slice(0,4).map(item => item.movie.id).join('|');
  useEffect(() => {
    let active = true;
    upcomingIds.split('|').filter(Boolean).forEach((id,index) => {
      if (details.current.has(id) || (index > 0 && failed.current.has(id))) return;
      let request = pending.current.get(id);
      if (!request) {
        request = api.detail(id).then(movie => { details.current.set(id,movie); failed.current.delete(id); }).catch(() => { failed.current.add(id); }).finally(() => { pending.current.delete(id); });
        pending.current.set(id,request);
      }
      void request.then(() => { if (active) setDetailsVersion(version => version+1); });
    });
    return () => { active = false; };
  },[upcomingIds]);
  const next = queue[0];
  const visibleMovie = next ? details.current.get(next.movie.id) ?? next.movie : null;
  const recentPageCount = Math.max(1,Math.ceil(recent.length/20));
  const currentRecentPage = Math.min(recentPage,recentPageCount);
  useEffect(() => { setRecentPage(page => Math.min(page,recentPageCount)); },[recentPageCount]);
  const completed = Math.max(0,initial.current-queue.length);
  const act = async (operation: () => Promise<void>) => { setBusy(true); setError(''); try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save answer.'); } finally { setBusy(false); } };
  const respond = (seen: boolean) => next && void act(async () => {
    setSubmittingMovie(next.movie.id);
    try {
      const saved = await answer(next.movie.id,next.member.id,seen);
      details.current.set(saved.id,saved);
      setRecentPage(1);
      setRecent(r => [...r,{movieId: next.movie.id,memberId: next.member.id,title: next.movie.title,seen,previous: null}]);
    } finally { setSubmittingMovie(null); }
  });
  const undo = () => { const last = recent.at(-1); if (!last) return; void act(async () => { const saved = await answer(last.movieId,last.memberId,last.previous); details.current.set(saved.id,saved); setRecent(r => r.slice(0,-1)); }); };
  return <div className="seen-content"><div className="seen-layout"><section className="card stack"><div className="section-title"><h2>The quick check</h2><span className="badge">{queue.length} remaining</span></div>
    <label className="progress-label">{completed} of {Math.max(initial.current,queue.length)} answers completed this visit<progress value={completed} max={Math.max(1,initial.current,queue.length)} /></label>
    <div aria-live="polite" aria-atomic="true">{next ? <MovieLink movie={visibleMovie!} className="answer-card" key={`${next.movie.id}-${next.member.id}`}><Poster movie={visibleMovie!} large /><div className="answer-copy"><p className="eyebrow">HAVE YOU SEEN...</p><h2 className="movie-title">{visibleMovie!.title}</h2><p className="meta">{visibleMovie!.year ?? 'Year unknown'}</p><p className="meta">{visibleMovie!.runtime ? `${visibleMovie!.runtime} min` : 'Runtime unknown'}</p><p className="meta">Director: {visibleMovie!.director ?? 'Unknown'}</p></div></MovieLink> : <Empty title="All caught up">You have answered every current Classics candidate.<RouteLink to="classics" icon={Library}>Explore Classics</RouteLink></Empty>}</div>
    {next && <div className="answer-actions"><Action className="button seen-yes" icon={Check} disabled={busy || !writesEnabled} onClick={() => respond(true)}>Yes, seen it</Action><Action className="button seen-no" icon={X} disabled={busy || !writesEnabled} onClick={() => respond(false)}>No, not yet</Action></div>}
    {busy && <p role="status">Saving answer…</p>}{error && <p className="error-message" role="alert">{error}</p>}
    <Action icon={Undo2} disabled={!recent.length || busy || !writesEnabled} onClick={undo}>Undo last answer</Action></section>
    <aside className="card stack"><p className="eyebrow">THIS VISIT</p><h2>Recent answers</h2><p className="meta">Undo restores your last answer to unanswered. You can correct your recent answers below.</p>{!recent.length && <p className="meta">Your answers will appear here.</p>}
    <div className="recent-list">{[...recent].reverse().slice((currentRecentPage-1)*20,currentRecentPage*20).map((r,i) => <div className="recent-answer" key={`${r.movieId}-${r.memberId}-${i}`}><strong>{r.title}</strong><p className="meta">{r.seen ? 'Seen' : 'Not seen'}</p><Action icon={r.seen ? X : Check} disabled={busy || !writesEnabled} onClick={() => void act(async () => { await answer(r.movieId,r.memberId,!r.seen); setRecent(list => list.map(item => item === r ? {...item,seen: !item.seen} : item)); })}>Change to {r.seen ? 'No' : 'Yes'}</Action></div>)}</div>{recent.length > 20 && <div className="button-set recent-pagination" role="group" aria-label="Recent answers pagination"><Action icon={ChevronLeft} disabled={currentRecentPage === 1 || busy} onClick={() => setRecentPage(currentRecentPage-1)}>Previous</Action><span className="meta">Page {currentRecentPage} of {recentPageCount}</span><Action icon={ChevronRight} disabled={currentRecentPage === recentPageCount || busy} onClick={() => setRecentPage(currentRecentPage+1)}>Next</Action></div>}</aside></div></div>;
}
