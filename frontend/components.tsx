import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Eye, Film, RefreshCw, type LucideIcon } from 'lucide-react';
import { latestScores, requiredScores, scoreValue } from '../shared/ranking';
import { posterReference } from '../shared/artwork';
import { formatScore100, possessiveName } from './presentation';
import { ClubIdentity } from './ClubIdentity';
import type { Member, Movie, Ranking, Score, Session } from '../shared/types';

const ACTION_ICON_SIZE = 18;

export type ActionVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export function Action({ icon: Icon,children,intent,variant,...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon | string; intent?: string; variant?: ActionVariant }) {
  return <button type="button" className={children == null ? 'button button--icon' : 'button'} data-intent={intent ?? (variant === 'primary' ? 'constructive' : undefined)} data-variant={variant ?? (intent ? undefined : 'secondary')} {...props}>{typeof Icon === 'string' ? <img className="action-icon" src={`${import.meta.env.BASE_URL}buttons/${Icon}`} width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} alt="" /> : <Icon size={ACTION_ICON_SIZE} aria-hidden="true" />}{children}</button>;
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
export function posterSource(movie: Pick<Movie,'assets'>,large = false) {
  const asset = movie.assets.find(a => a.asset_type === 'poster');
  return asset ? posterReference(asset.reference,large) : undefined;
}
export function Poster({movie,large = false}: {movie: Pick<Movie,'title'|'assets'>; large?: boolean}) {
  const reference = posterSource(movie,large);
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
  return `${event.date_precision === 'cycle_rough' ? 'Cycle started ' : ''}${dateLabel(event.event_date)}`;
}
export function SessionCard({session,members,actions,dateHeading,variant}: {session: Session; members: Member[]; actions?: ReactNode; dateHeading?: string; variant?: 'history' | 'home'}) {
  const host = members.find(m => m.id === session.host_member_id);
  const home = variant === 'home';
  const identity = session.kind === 'classics' ? <ClubIdentity identity={{kind: 'classics'}} /> : host ? <ClubIdentity identity={{kind: 'member',member: host}} /> : <span>Hosted by a former member</span>;
  const heading = <><div className="eyebrow">{dateHeading ?? (home || variant === 'history' ? eventDateLabel(session) : <>{eventDateLabel(session)} · {session.movies.length} film{session.movies.length === 1 ? '' : 's'}</>)}</div>
    <h3>{session.kind === 'classics' ? 'Classics week' : host ? `${possessiveName(host.display_name)} ${home ? 'turn' : 'week'}` : home ? 'Former member’s turn' : 'Former member’s week'}</h3></>;
  return <article className={home ? 'card session-card home-session-card' : 'card session-card'}>{variant === 'history' ? <div className="history-event-header"><div className="history-event-heading">{heading}</div><div className="history-event-actions">{actions}<div className="history-event-identity">{identity}</div></div></div> : <>{actions}{home && <div className="home-session-identity">{identity}</div>}{heading}</>}{((!home && variant !== 'history') || session.legacy_cycle_label) && <div className="session-meta">
      {!home && variant !== 'history' && session.kind === 'classics' && <ClubIdentity identity={{kind: 'classics'}} />}
      {!home && variant !== 'history' && session.host_member_id && (members.find(m => m.id === session.host_member_id) ? <ClubIdentity identity={{kind: 'member',member: members.find(m => m.id === session.host_member_id)!}} /> : <span>Hosted by a former member</span>)}
      {session.legacy_cycle_label && <span className="badge">{session.legacy_cycle_label}</span>}</div>}
    <ol className="film-list">{session.movies.map((movie,i) => <li key={`${movie.id}-${i}`}>{variant === 'history' ? <MovieLink movie={movie} className="movie-row"><span className="position">#{i+1}</span><Poster movie={movie} /><div className="movie-copy"><span className="movie-title">{movie.title}</span><p className="meta">{movie.year ?? 'Year unknown'}{movie.runtime ? ` · ${movie.runtime} min` : ''}{movie.au_classification ? ` · ${movie.au_classification}` : ''}</p>{movie.director && <p className="meta history-film-director">{movie.director}</p>}</div></MovieLink> : <><span className="position">{home ? `#${i+1}` : i+1}</span><MovieRow movie={movie} /></>}</li>)}</ol>
    {session.planned_at && <p className="meta">Planned {new Date(session.planned_at).toLocaleString('en-AU')}</p>}
  </article>;
}
// Genuine source scores share compact labels and canonical presentation order.
export const sourceRatings = [
  ['imdb','rating','IMDb','IMDb Rating'], ['letterboxd','rating','LB','Letterboxd Rating'],
  ['metacritic','user','MC-U','Metacritic User Score'], ['rottentomatoes','audience','RT-A','Rotten Tomatoes Audience Score'],
  ['tmdb','rating','TMDB','TMDB Rating'], ['trakt','rating','Trakt','Trakt Rating'],
  ['rogerebert','rating','Ebert','Roger Ebert Rating'], ['metacritic','critic','MC','Metacritic Critic Score'], ['rottentomatoes','critic','RT-C','Rotten Tomatoes Critic Score'],
] as const;
export function SourceScores({ranking,scores = []}: {ranking?: Ranking | null; scores?: Score[]}) {
  const stored = latestScores(scores);
  const items = sourceRatings.flatMap(([provider,metric,label,description]) => {
    const source = stored.find(s => s.provider === provider && s.metric === metric);
    const rankingInput = requiredScores.some(key => key === `${provider}:${metric}`);
    const value = rankingInput && ranking ? ranking.sources.find(s => s.provider === provider && s.metric === metric)?.value : source ? scoreValue(source) : undefined;
    return value != null ? [{provider,metric,label,description,value}] : [];
  });
  const firstCritic = items.findIndex(item => item.provider === 'rogerebert' || item.metric === 'critic');
  const rowRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const boundary = row.querySelector<HTMLElement>('.source-scores-critic-boundary');
    const previous = boundary?.previousElementSibling;
    if (!boundary || !previous) return;
    const positionDivider = () => {
      const critic = boundary.getBoundingClientRect(), audience = previous.getBoundingClientRect();
      if (!critic.width || !audience.width) return;
      const padding = parseFloat(getComputedStyle(boundary).paddingLeft);
      const sameLine = audience.top < critic.bottom && audience.bottom > critic.top;
      const offset = sameLine ? (audience.right + critic.left + padding) / 2 - critic.left : padding / 2;
      boundary.style.setProperty('--critic-divider-offset', `${offset - .5}px`);
    };
    positionDivider();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(positionDivider);
    observer.observe(row);
    for (const item of row.children) observer.observe(item);
    return () => observer.disconnect();
  });
  const stacked = items.length > 6;
  return items.length ? <p ref={rowRef} className={`meta ranking-source-scores${stacked ? ' ranking-source-scores-stacked' : ''}`}>{items.map(({provider,metric,label,description,value},index) =>
    <span key={`${provider}:${metric}`} className={firstCritic > 0 && index === firstCritic ? 'source-scores-critic-boundary' : undefined} title={description} aria-label={`${description}: ${formatScore100(value)}`}><span>{label}</span>{' '}<span>{formatScore100(value)}</span></span>
  )}</p> : null;
}
export function RankingScore({movie,compact = false,variant}: {movie: Movie; compact?: boolean; variant?: 'home' | 'classics'}) {
  const r = movie.ranking!;
  return <div className="stack ranking-score">{!variant && <div className="rank-top">
    <span className="badge" data-intent={r.eligible ? 'constructive' : 'destructive'}>{!r.eligible ? 'Disqualified' : r.rankable ? 'Ranked' : 'Needs Data'}</span>
    <strong className="score numeric">{r.finalScore?.toFixed(2) ?? '—'}<small>residual score</small></strong></div>}
    <p className="meta">{r.seenCount} Seen · {r.unseenCount} No{variant !== 'home' && <> · {r.unknownCount} Unknown</>}</p>
    {(!compact || variant === 'classics') && <SourceScores ranking={r} scores={movie.scores} />}
    {!variant && <details><summary><Eye size={17} aria-hidden="true" />Score breakdown</summary><div className="breakdown">
      <p>Sum of squares <strong>{r.rawScore?.toFixed(2) ?? 'Incomplete'}</strong></p><p>Unseen multiplier <strong>{r.unseenMultiplier.toFixed(6)}</strong></p>
      {r.sources.map(s => <p key={`${s.provider}:${s.metric}`}>{s.provider} ({s.metric})<strong>{formatScore100(s.value)} / 100</strong></p>)}
      {r.warnings.map(w => <small key={w}>{w}</small>)}{!r.eligible && <p>Excluded from watch order: all active members Seen, or no active roster.</p>}
    </div></details>}</div>;
}
export function RankingCard({movie,rank,compact = false,variant,action}: {action?: ReactNode; movie: Movie; rank?: number; compact?: boolean; variant?: 'home' | 'classics'}) {
  const r = movie.ranking!;
  return <article className={variant === 'home' ? 'card rank-card home-rank-card' : variant === 'classics' ? 'ranking-row classics-ranking-row' : compact ? 'ranking-row' : 'card rank-card'}>{action}<div className="candidate-identity"><span className="rank-number">{rank ? (variant ? `#${rank}` : String(rank).padStart(2,'0')) : r.eligible ? '—' : 'DQ'}</span><MovieRow movie={movie}>{variant === 'classics' && movie.director && <p className="meta candidate-director">{movie.director}</p>}</MovieRow></div><RankingScore movie={movie} compact={compact} variant={variant} /></article>;
}
