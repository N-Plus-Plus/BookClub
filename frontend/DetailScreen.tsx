import { possessiveName } from './presentation';
import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import type { Member, MovieDetail } from '../shared/types';
import { api } from './api';
import { eventDateLabel, Empty, Failure, LoadingView, RouteLink, SourceScores } from './components';
import { ClubIdentity } from './ClubIdentity';
import { FilmIdentity } from './FilmIdentity';
import { DetailRankingScore } from './DetailRankingScore';

export function DetailScreen({id,members}: {id: string; members: Member[]}) {
  const [movie,setMovie] = useState<MovieDetail | null>(null), [loadError,setLoadError] = useState('');
  const [retry,setRetry] = useState(0), [loading,setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); setLoadError(''); api.detail(id).then(m => { if (active) setMovie(m); }).catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; },[id,retry]);
  if (loading && !movie) return <LoadingView label="Loading film details…" />;
  if (!movie) return <Failure message={loadError} retry={() => setRetry(r => r+1)} />;
  // Selected-film appearances are active History only. BookClub's established
  // club-wide Seen inference is presentation-only; persisted answers/ranking stay explicit.
  const screened = movie.appearances.length > 0;
  const showSeen = screened || movie.classic;
  const hostIds = new Set(movie.appearances.filter(appearance => appearance.kind === 'hosted').map(appearance => appearance.host_member_id));
  const hosts = members.filter(member => hostIds.has(member.id)).sort((a,b) => a.sort_order-b.sort_order || a.id.localeCompare(b.id)).map(member => member.display_name);
  const hostNames = hosts.length > 1 ? `${hosts.slice(0,-1).join(', ')} and ${hosts.at(-1)}` : hosts[0];
  const status = movie.classic ? 'Classics candidate' : hostNames ? `Brought by ${hostNames}` : null;
  return <div className="stack"><FilmIdentity movie={movie} variant="detail" beforeOverview={<SourceScores ranking={movie.ranking} scores={movie.scores} />}>{status && <span className="badge badge-wrap detail-classics-status">{status}</span>}</FilmIdentity>
    <div className={showSeen ? 'detail-grid' : 'detail-grid detail-grid-without-seen'}>{showSeen && <section className="card detail-seen-card" aria-label="Member Seen state"><div className="detail-seen-summary">{[{value:0,title:"Haven't"},{value:1,title:'Seen It'}].map(group => <div className={group.value === 1 ? 'detail-seen-column detail-seen-column-yes' : 'detail-seen-column'} key={group.value}><h3>{group.title}</h3><div className="detail-seen-members">{[...members].sort((a,b) => a.sort_order-b.sort_order || a.id.localeCompare(b.id)).filter(member => screened ? member.active === 1 && group.value === 1 : movie.seen.some(state => state.member_id === member.id && state.seen === group.value)).map(member => <ClubIdentity key={member.id} identity={{kind:'member',member}} />)}</div></div>)}</div></section>}
    {movie.classic === true && movie.ranking && <DetailRankingScore ranking={movie.ranking} />}</div>
    <section className="card stack"><div className="section-title"><h2>Book Club appearances</h2><RouteLink to="history" icon={History}>History</RouteLink></div>{movie.appearances.map((a,i) => <p key={`${a.id}-${i}`}>{eventDateLabel(a)} · {a.kind === 'classics' ? 'Classics week' : members.find(member => member.id === a.host_member_id) ? `${possessiveName(members.find(member => member.id === a.host_member_id)!.display_name)} week` : 'Former member’s week'} · film {a.position}</p>)}{!movie.appearances.length && <Empty title="Not watched at Book Club yet">This film has no recorded event appearances.</Empty>}</section>
  </div>;
}
