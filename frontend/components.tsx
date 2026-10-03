import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Eye, Film, RefreshCw, type LucideIcon } from 'lucide-react';
import type { Member, Movie, Session } from '../shared/types';

export function Action({ icon: Icon,children,intent,...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; intent?: string }) {
  return <button type="button" className={children == null ? 'button button--icon' : 'button'} data-intent={intent} {...props}><Icon size={18} aria-hidden="true" />{children}</button>;
}
export function RouteLink({ to,icon: Icon,children }: {to: string; icon: LucideIcon; children: ReactNode}) {
  return <a className="button" href={`#/${to}`}><Icon size={18} aria-hidden="true" />{children}</a>;
}
export function Empty({title,children}: {title: string; children?: ReactNode}) {
  return <div className="empty-state"><Film size={26} aria-hidden="true" /><h3 className="empty-state__title">{title}</h3><div className="empty-state__message">{children}</div></div>;
}
export function Failure({message,retry}: {message: string; retry: () => void}) {
  return <div className="empty-state" data-state="error" role="alert"><h2 className="empty-state__title">Couldn’t load this view</h2><p>{message}</p><Action icon={RefreshCw} onClick={retry}>Retry</Action></div>;
}
export function Poster({movie,large = false}: {movie: Pick<Movie,'title'|'assets'>; large?: boolean}) {
  const asset = movie.assets.find(a => a.asset_type === 'poster');
  const [failed,setFailed] = useState(false);
  return asset && !failed ? <img className={`poster ${large ? 'poster-large' : ''}`} src={asset.reference} alt={`${movie.title} poster`} loading="lazy" onError={() => setFailed(true)} />
    : <div className={`poster poster-empty ${large ? 'poster-large' : ''}`} role="img" aria-label={`No poster available for ${movie.title}`}><Film size={large ? 48 : 25} aria-hidden="true" /><span>No poster</span></div>;
}
export function MovieLink({movie}: {movie: Movie}) {
  return <a className="movie-link" href={`#/movie/${movie.id}`}><Eye size={17} aria-hidden="true" /><span>{movie.title}</span></a>;
}
export function MovieRow({movie,children}: {movie: Movie; children?: ReactNode}) {
  return <div className="movie-row"><Poster movie={movie} /><div className="movie-copy"><MovieLink movie={movie} /><p className="meta">{movie.year ?? 'Year unknown'}{movie.runtime ? ` · ${movie.runtime} min` : ''}</p>{children}</div></div>;
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-AU',{day: 'numeric',month: 'long',year: 'numeric'}).format(new Date(`${date}T12:00:00`));
}
export function SessionCard({session,members}: {session: Session; members: Member[]}) {
  return <article className="card session-card"><div className="eyebrow">{dateLabel(session.event_date)} · {session.movies.length} film{session.movies.length === 1 ? '' : 's'}</div>
    <h3>{session.title || 'Book Club night'}</h3><div className="session-meta">
      {session.host_member_id && <span>Hosted by {members.find(m => m.id === session.host_member_id)?.display_name ?? 'a former member'}</span>}
      {session.legacy_cycle_label && <span className="badge">{session.legacy_cycle_label}</span>}</div>
    <ol className="film-list">{session.movies.map((movie,i) => <li key={`${movie.id}-${i}`}><span className="position">{i+1}</span><MovieRow movie={movie} /></li>)}</ol>
    {session.notes && <p className="meta">{session.notes}</p>}
  </article>;
}
export function RankingCard({movie,rank}: {movie: Movie; rank?: number}) {
  const r = movie.ranking!;
  return <article className="card rank-card"><div className="rank-top"><span className="rank-number">{rank ? String(rank).padStart(2,'0') : 'DQ'}</span>
    <span className="badge" data-intent={r.eligible ? 'constructive' : 'destructive'}>{r.eligible ? 'Eligible' : 'Disqualified'}</span>
    <strong className="score numeric">{r.finalScore.toFixed(1)}<small>provisional score</small></strong></div>
    <MovieRow movie={movie}><p className="meta">{r.seenCount} seen · {r.unseenCount} not seen · {r.unknownCount} unknown</p></MovieRow>
    <details><summary><Eye size={17} aria-hidden="true" />Score breakdown</summary><div className="breakdown">
      <p>Weighted base <strong>{r.weightedBaseScore.toFixed(2)}</strong></p><p>Seen adjustment <strong>{r.seenAdjustment.toFixed(2)}</strong></p>
      {r.sources.map(s => <p key={`${s.provider}:${s.metric}`}>{s.provider} ({s.metric}, weight {s.weight})<strong>{s.value.toFixed(1)} / 100</strong></p>)}
      {r.warnings.map(w => <small key={w}>{w}</small>)}{!r.eligible && <p>All four members have seen this film. It is excluded from watch order.</p>}
    </div></details></article>;
}
