import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Eye, Film, RefreshCw, type LucideIcon } from 'lucide-react';
import { posterReference } from '../shared/artwork';
import { formatScore100 } from './presentation';
import { ClubIdentity } from './ClubIdentity';
import type { Member, Movie, Session } from '../shared/types';

const ACTION_ICON_SIZE = 18;

export type ActionVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export function Action({ icon: Icon,children,intent,variant,...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; intent?: string; variant?: ActionVariant }) {
  return <button type="button" className={children == null ? 'button button--icon' : 'button'} data-intent={intent ?? (variant === 'primary' ? 'constructive' : undefined)} data-variant={variant ?? (intent ? undefined : 'secondary')} {...props}><Icon size={ACTION_ICON_SIZE} aria-hidden="true" />{children}</button>;
}
export function RouteLink({ to,icon: Icon,children,variant = 'secondary' }: {to: string; icon: LucideIcon; children: ReactNode; variant?: ActionVariant}) {
  return <a className="button" data-variant={variant} data-intent={variant === 'primary' ? 'constructive' : undefined} href={`#/${to}`}><Icon size={ACTION_ICON_SIZE} aria-hidden="true" />{children}</a>;
}
export function LoadingView({label = 'Loading the film journal…'}: {label?: string}) {
  return <div className="loading-placeholder stack" role="status"><span>{label}</span><div className="skeleton skeleton-heading" aria-hidden="true" /><div className="skeleton skeleton-panel" aria-hidden="true" /><div className="skeleton skeleton-panel" aria-hidden="true" /></div>;
}
export function Empty({title,children}: {title: string; children?: ReactNode}) {
  return <div className="empty-state"><Film size={26} aria-hidden="true" /><h3 className="empty-state__title">{title}</h3><div className="empty-state__message">{children}</div></div>;
}
export function Failure({message,retry}: {message: string; retry: () => void}) {
  return <div className="empty-state" data-state="error" role="alert"><h2 className="empty-state__title">Couldn’t load this view</h2><p>{message}</p><Action icon={RefreshCw} onClick={retry}>Retry</Action></div>;
}
export function Poster({movie,large = false}: {movie: Pick<Movie,'title'|'assets'>; large?: boolean}) {
  const asset = movie.assets.find(a => a.asset_type === 'poster');
  const reference = asset ? posterReference(asset.reference,large) : undefined;
  const [failedReference,setFailedReference] = useState<string>();
  return reference && failedReference !== reference ? <img className={`poster ${large ? 'poster-large' : ''}`} src={reference} alt={`${movie.title} poster`} loading="lazy" onError={() => setFailedReference(reference)} />
    : <div className={`poster poster-empty ${large ? 'poster-large' : ''}`} role="img" aria-label={`No poster available for ${movie.title}`}><Film size={large ? 48 : 25} aria-hidden="true" /><span>No poster</span></div>;
}
export function MovieLink({movie,children,className = ''}: {movie: Movie; children?: ReactNode; className?: string}) {
  return <a className={`movie-link ${className}`} href={`#/movie/${movie.id}`} aria-label={movie.title}>{children ?? <span className="movie-title">{movie.title}</span>}</a>;
}
export function MovieRow({movie,children}: {movie: Movie; children?: ReactNode}) {
  return <MovieLink movie={movie} className="movie-row"><Poster movie={movie} /><div className="movie-copy"><span className="movie-title">{movie.title}</span><p className="meta">{movie.year ?? 'Year unknown'}{movie.runtime ? ` · ${movie.runtime} min` : ''}</p>{children}</div></MovieLink>;
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-AU',{day: 'numeric',month: 'long',year: 'numeric'}).format(new Date(`${date}T12:00:00`));
}
export function eventDateLabel(event: Pick<Session,'event_date'|'date_precision'>) {
  if (event.date_precision === 'unknown') return 'Date unknown';
  return `${event.date_precision === 'cycle_rough' ? 'Cycle reference (event date unknown): ' : ''}${dateLabel(event.event_date)}`;
}
export function SessionCard({session,members,actions,dateHeading,variant}: {session: Session; members: Member[]; actions?: ReactNode; dateHeading?: string; variant?: 'history'}) {
  const host = members.find(m => m.id === session.host_member_id);
  return <article className="card session-card">{actions}<div className="eyebrow">{dateHeading ?? <>{eventDateLabel(session)} · {session.movies.length} film{session.movies.length === 1 ? '' : 's'}</>}</div>
    <h3>{variant === 'history' ? (session.kind === 'classics' ? 'Classics week' : host ? `${host.display_name}'s week` : 'Former member’s week') : (session.kind === 'classics' ? 'Classics Collection' : 'Book Club night')}</h3><div className="session-meta">
      {session.kind === 'classics' && <ClubIdentity identity={{kind: 'classics'}} />}
      {session.host_member_id && (members.find(m => m.id === session.host_member_id) ? <ClubIdentity identity={{kind: 'member',member: members.find(m => m.id === session.host_member_id)!}} /> : <span>Hosted by a former member</span>)}
      {session.legacy_cycle_label && <span className="badge">{session.legacy_cycle_label}</span>}</div>
    <ol className="film-list">{session.movies.map((movie,i) => <li key={`${movie.id}-${i}`}>{variant === 'history' ? <MovieLink movie={movie} className="movie-row"><span className="position">#{i+1}</span><Poster movie={movie} /><div className="movie-copy"><span className="movie-title">{movie.title}</span><p className="meta">{movie.year ?? 'Year unknown'}{movie.runtime ? ` · ${movie.runtime} min` : ''}</p></div></MovieLink> : <><span className="position">{i+1}</span><MovieRow movie={movie} /></>}</li>)}</ol>
    {session.planned_at && <p className="meta">Planned {new Date(session.planned_at).toLocaleString('en-AU')}</p>}
  </article>;
}
export function RankingScore({movie,compact = false}: {movie: Movie; compact?: boolean}) {
  const r = movie.ranking!;
  return <div className="stack ranking-score"><div className="rank-top">
    <span className="badge" data-intent={r.eligible ? 'constructive' : 'destructive'}>{!r.eligible ? 'Disqualified' : r.rankable ? 'Ranked' : 'Needs Data'}</span>
    <strong className="score numeric">{r.finalScore?.toFixed(2) ?? '—'}<small>residual score</small></strong></div>
    <p className="meta">{r.seenCount} Seen · {r.unseenCount} No · {r.unknownCount} Unknown</p>
    {!compact && <p className="meta">{r.sources.map(s => `${s.provider === 'imdb' ? 'IMDb' : s.metric === 'audience' ? 'RT audience' : 'RT critic'} ${formatScore100(s.value)}`).join(' · ')}</p>}
    {r.missingRequiredScores.length > 0 && <p className="meta">Missing: {r.missingRequiredScores.join(', ')}</p>}
    <details><summary><Eye size={17} aria-hidden="true" />Score breakdown</summary><div className="breakdown">
      <p>Sum of squares <strong>{r.rawScore?.toFixed(2) ?? 'Incomplete'}</strong></p><p>Unseen multiplier <strong>{r.unseenMultiplier.toFixed(6)}</strong></p>
      {r.sources.map(s => <p key={`${s.provider}:${s.metric}`}>{s.provider} ({s.metric})<strong>{formatScore100(s.value)} / 100</strong></p>)}
      {r.warnings.map(w => <small key={w}>{w}</small>)}{!r.eligible && <p>Excluded from watch order: all active members Seen, or no active roster.</p>}
    </div></details></div>;
}
export function RankingCard({movie,rank,compact = false}: {movie: Movie; rank?: number; compact?: boolean}) {
  const r = movie.ranking!;
  return <article className={compact ? 'ranking-row' : 'card rank-card'}><div className="candidate-identity"><span className="rank-number">{rank ? String(rank).padStart(2,'0') : r.eligible ? '—' : 'DQ'}</span><MovieRow movie={movie} /></div><RankingScore movie={movie} compact={compact} /></article>;
}
