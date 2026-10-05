import { useRef, useState } from 'react';
import { Check, Library, Undo2, X } from 'lucide-react';
import type { Catalog, MovieDetail } from '../shared/types';
import { missingAnswers } from '../shared/ranking';
import { Action, Empty, MovieLink, Poster, RouteLink } from './components';

interface Recent { movieId: string; memberId: string; title: string; seen: boolean; previous: boolean | null }
export function SeenScreen({catalog,viewerId,answer,writesEnabled}: { catalog: Catalog; viewerId: string; answer: (m: string,p: string,s: boolean | null) => Promise<MovieDetail>; writesEnabled: boolean }) {
  const queue = missingAnswers(catalog.movies,catalog.members,viewerId);
  const initial = useRef(queue.length);
  const [recent,setRecent] = useState<Recent[]>([]);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const next = queue[0];
  const completed = Math.max(0,initial.current-queue.length);
  const act = async (operation: () => Promise<void>) => { setBusy(true); setError(''); try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save answer.'); } finally { setBusy(false); } };
  const respond = (seen: boolean) => next && void act(async () => {
    await answer(next.movie.id,next.member.id,seen);
    setRecent(r => [...r.slice(-9),{movieId: next.movie.id,memberId: next.member.id,title: next.movie.title,seen,previous: null}]);
  });
  const undo = () => { const last = recent.at(-1); if (!last) return; void act(async () => { await answer(last.movieId,last.memberId,last.previous); setRecent(r => r.slice(0,-1)); }); };
  return <div className="seen-content"><div className="seen-layout"><section className="card stack"><div className="section-title"><h2>The quick check</h2><span className="badge">{queue.length} remaining</span></div>
    <label className="progress-label">{completed} of {Math.max(initial.current,queue.length)} answers completed this visit<progress value={completed} max={Math.max(1,initial.current,queue.length)} /></label>
    <div aria-live="polite" aria-atomic="true">{next ? <MovieLink movie={next.movie} className="answer-card" key={`${next.movie.id}-${next.member.id}`}><Poster movie={next.movie} large /><div className="answer-copy"><p className="eyebrow">HAVE YOU SEEN...</p><h2 className="movie-title">{next.movie.title}</h2><p className="meta">{next.movie.year ?? 'Year unknown'}</p><p className="meta">{next.movie.runtime ? `${next.movie.runtime} min` : 'Runtime unknown'}</p><p className="meta">Director: {next.movie.director ?? 'Unknown'}</p></div></MovieLink> : <Empty title="All caught up">You have answered every current Classics candidate.<RouteLink to="classics" icon={Library}>Explore Classics</RouteLink></Empty>}</div>
    {next && <div className="answer-actions"><Action icon={Check} disabled={busy || !writesEnabled} onClick={() => respond(true)}>Yes, seen it</Action><Action icon={X} disabled={busy || !writesEnabled} onClick={() => respond(false)}>No, not yet</Action></div>}
    {busy && <p role="status">Saving answer…</p>}{error && <p className="error-message" role="alert">{error}</p>}
    <Action icon={Undo2} disabled={!recent.length || busy || !writesEnabled} onClick={undo}>Undo last answer</Action></section>
    <aside className="card stack"><p className="eyebrow">THIS VISIT</p><h2>Recent answers</h2><p className="meta">Undo restores your last answer to unanswered. You can correct your recent answers below.</p>{!recent.length && <p className="meta">Your answers will appear here.</p>}
    <div className="recent-list">{[...recent].reverse().map((r,i) => <div className="recent-answer" key={`${r.movieId}-${r.memberId}-${i}`}><strong>{r.title}</strong><p className="meta">{r.seen ? 'Seen' : 'Not seen'}</p><Action icon={r.seen ? X : Check} disabled={busy || !writesEnabled} onClick={() => void act(async () => { await answer(r.movieId,r.memberId,!r.seen); setRecent(list => list.map(item => item === r ? {...item,seen: !item.seen} : item)); })}>Change to {r.seen ? 'No' : 'Yes'}</Action></div>)}</div></aside></div></div>;
}
