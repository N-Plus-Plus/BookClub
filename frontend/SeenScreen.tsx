import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Library, RefreshCw, X } from 'lucide-react';
import type { Catalog } from '../shared/types';
import type { SeenSave } from './seen-answers';
import { missingAnswers } from '../shared/ranking';
import { Action, Empty, MovieLink, Poster, posterSource, RouteLink, SourceScores } from './components';

interface Recent { movieId: string; memberId: string; title: string; seen: boolean }
export function SeenScreen({catalog,viewerId,answer,writesEnabled,failures = [],retry}: {
  catalog: Catalog; viewerId: string; answer: (m:string,p:string,s:boolean|null,title:string) => void; writesEnabled: boolean;
  pending?: number; failures?: SeenSave[]; retry?: (save:SeenSave) => void;
}) {
  const queue = missingAnswers(catalog.movies,catalog.members,viewerId);
  const initial = useRef(queue.length);
  const [recent,setRecent] = useState<Recent[]>([]);
  const [recentPage,setRecentPage] = useState(1);
  const [plotExpanded,setPlotExpanded] = useState(false);
  const posters = useRef(new Map<string,HTMLImageElement>());
  const upcomingPosters = queue.slice(1,4).map(item => posterSource(item.movie,true)).filter((source): source is string => Boolean(source));
  const preloadKey = JSON.stringify(upcomingPosters);
  useEffect(() => {
    for (const source of JSON.parse(preloadKey) as string[]) {
      if (posters.current.has(source)) continue;
      const image = new Image();
      posters.current.set(source,image);
      // Failed preloads stay deduplicated; the visible Poster owns its fallback.
      image.src = source;
    }
  },[preloadKey]);
  const next = queue[0];
  const visibleMovie = next?.movie;
  const recentPageCount = Math.max(1,Math.ceil(recent.length/5));
  const currentRecentPage = Math.min(recentPage,recentPageCount);
  useEffect(() => { setRecentPage(page => Math.min(page,recentPageCount)); },[recentPageCount]);
  const completed = Math.max(0,initial.current-queue.length);
  const respond = (seen: boolean) => {
    if (!next) return;
    setRecentPage(1);
    setRecent(list => [...list.filter(r => r.movieId !== next.movie.id),{movieId:next.movie.id,memberId:next.member.id,title:next.movie.title,seen}]);
    answer(next.movie.id,next.member.id,seen,next.movie.title);
  };
  const correct = (recentAnswer: Recent) => {
    setRecent(list => list.map(item => item === recentAnswer ? {...item,seen:!item.seen} : item));
    answer(recentAnswer.movieId,recentAnswer.memberId,!recentAnswer.seen,recentAnswer.title);
  };
  return <div className="seen-content"><div className="seen-layout"><section className="card stack"><div className="section-title"><h2>The quick check</h2><span className="badge">{queue.length} remaining</span></div>
    <label className="progress-label">{completed} of {Math.max(initial.current,queue.length)} answers completed this visit<progress value={completed} max={Math.max(1,initial.current,queue.length)} /></label>
    <div aria-live="polite" aria-atomic="true">{next ? <MovieLink movie={visibleMovie!} className="answer-card" key={`${next.movie.id}-${next.member.id}`}><Poster movie={visibleMovie!} large /><div className="answer-copy"><p className="eyebrow">HAVE YOU SEEN...</p><h2 className="movie-title">{visibleMovie!.title}</h2><p className="meta">{visibleMovie!.year ?? 'Year unknown'}</p><p className="meta">{visibleMovie!.runtime ? `${visibleMovie!.runtime} min` : 'Runtime unknown'}</p><p className="meta">Director: {visibleMovie!.director ?? 'Unknown'}</p></div></MovieLink> : <Empty title="All caught up">You have answered every current Classics candidate.<RouteLink to="classics" icon={Library}>Explore Classics</RouteLink></Empty>}</div>
    <SourceScores ranking={visibleMovie?.ranking} scores={visibleMovie?.scores} />
    {visibleMovie?.overview && <div className="seen-plot"><p id="seen-plot-summary" className={`seen-plot-summary${plotExpanded ? "" : " seen-plot-collapsed"}`}>{visibleMovie.overview}</p><button type="button" className="button seen-plot-toggle" aria-expanded={plotExpanded} aria-controls="seen-plot-summary" onClick={() => setPlotExpanded(expanded => !expanded)}>{plotExpanded ? "Less" : "More"}</button></div>}
    {next && <div className="answer-actions"><Action className="button seen-yes" icon={Check} disabled={!writesEnabled} onClick={() => respond(true)}>Yes, seen it</Action><Action className="button seen-no" icon={X} disabled={!writesEnabled} onClick={() => respond(false)}>No, not yet</Action></div>}
    {failures.length > 0 && <div className="stack" role="alert"><p className="error-message">{failures.length} answers could not be confirmed. Retry to save your selected answers.</p>{failures.map(save => <div key={`${save.movieId}-${save.memberId}`}><p className="meta">{save.title}: {save.seen === null ? 'Unanswered' : save.seen ? 'Seen' : 'Not seen'} · Unsaved. {save.message}</p><Action icon={RefreshCw} disabled={!writesEnabled} onClick={() => retry?.(save)}>Retry saving {save.title}</Action></div>)}</div>}
    </section>
    <aside className="card stack"><p className="eyebrow">THIS VISIT</p><h2>Recent answers</h2><p className="meta">You can correct your recent answers below.</p>{!recent.length && <p className="meta">Your answers will appear here.</p>}
    <div className="recent-list">{[...recent].reverse().slice((currentRecentPage-1)*5,currentRecentPage*5).map((r,i) => <div className="recent-answer" key={`${r.movieId}-${r.memberId}-${i}`}><strong>{r.title}</strong><p className="meta">{r.seen ? 'Seen' : 'Not seen'}</p><Action icon={r.seen ? X : Check} disabled={!writesEnabled} onClick={() => correct(r)}>Change to {r.seen ? 'No' : 'Yes'}</Action></div>)}</div>{recent.length > 5 && <div className="button-set recent-pagination" role="group" aria-label="Recent answers pagination"><Action icon={ChevronLeft} disabled={currentRecentPage === 1} onClick={() => setRecentPage(currentRecentPage-1)}>Previous</Action><span className="meta">Page {currentRecentPage} of {recentPageCount}</span><Action icon={ChevronRight} disabled={currentRecentPage === recentPageCount} onClick={() => setRecentPage(currentRecentPage+1)}>Next</Action></div>}</aside></div></div>;
}
