import { formatScore100 } from './presentation';
import { useEffect, useRef, useState } from 'react';
import { History, Library, RefreshCw } from 'lucide-react';
import { latestScores, requiredScores } from '../shared/ranking';
import type { Member, MovieDetail, ProviderResult } from '../shared/types';
import { api } from './api';
import { Action, eventDateLabel, Empty, Failure, RankingScore, LoadingView, RouteLink } from './components';
import { ClubIdentity } from './ClubIdentity';
import { FilmIdentity } from './FilmIdentity';
import { ProviderFeedback } from './maintenance-feedback';

export function DetailScreen({id,members,writesEnabled,onMovie,isAdmin}: {isAdmin: boolean; id: string; members: Member[]; writesEnabled: boolean; onMovie: (m: MovieDetail) => void}) {
  const [movie,setMovie] = useState<MovieDetail | null>(null), [loadError,setLoadError] = useState('');
  const [operation,setOperation] = useState<'membership' | 'scores' | 'reload' | null>(null);
  const busy = operation !== null;
  const [retry,setRetry] = useState(0), [loading,setLoading] = useState(true);
  const inFlight = useRef(false);
  const [membership,setMembership] = useState<{target?: boolean; error?: string; message?: string}>({});
  const [scores,setScores] = useState<{error?: string; providers?: ProviderResult[]}>({});
  const [reload,setReload] = useState<{error?: string; message?: string}>({});
  const update = (m: MovieDetail) => { setMovie(m); onMovie(m); };
  const work = async (active: NonNullable<typeof operation>,task: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setOperation(active);
    try { await task(); } finally { inFlight.current = false; setOperation(null); }
  };
  const changeMembership = (target: boolean,trigger?: HTMLButtonElement) => void work('membership',async () => {
    const returnFocus = trigger && document.activeElement === trigger;
    if (!trigger) setMembership({});
    try {
      update(await api.classic(id,target)); setMembership({message:target ? 'Added to Classics.' : 'Removed from Classics.'});
      if (returnFocus && (document.activeElement === trigger || document.activeElement === document.body)) requestAnimationFrame(() => document.getElementById('classics-membership-action')?.focus());
    }
    catch (error) {
      setMembership({target,error:error instanceof Error ? error.message : 'Membership change failed.'});
      if (returnFocus && document.activeElement === document.body) requestAnimationFrame(() => trigger?.focus());
    }
  });
  const refreshScores = () => void work('scores',async () => {
    setScores({}); setReload({});
    try { const result = await api.refreshScores(id); update(result.movie); setScores({providers:result.providers}); }
    catch (error) { setScores({error:error instanceof Error ? error.message : 'Score refresh failed.'}); }
  });
  // Score refresh appends snapshots and may partly succeed before a lost response.
  // Check saved data instead of blindly retrying that mutation.
  const reloadSaved = () => void work('reload',async () => {
    setReload({});
    try { update(await api.detail(id)); setReload({message:'Saved film data reloaded. Review the scores before refreshing again.'}); }
    catch (error) { setReload({error:error instanceof Error ? error.message : 'Could not reload saved film data.'}); }
  });
  useEffect(() => { let active = true; setLoading(true); setLoadError(''); api.detail(id).then(m => { if (active) setMovie(m); }).catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; },[id,retry]);
  if (loading && !movie) return <LoadingView label="Loading film details…" />;
  if (!movie) return <Failure message={loadError} retry={() => setRetry(r => r+1)} />;
  return <div className="stack"><FilmIdentity movie={movie}><span className="badge">{movie.classic ? 'Classics candidate' : 'Outside Classics pool'}</span></FilmIdentity>
    <div className="detail-grid"><section className="card stack"><h2>Seen It?</h2><div className="detail-seen-summary">{[{value:0,title:"Haven't Seen It"},{value:1,title:'Seen It'}].map(group => <div className="detail-seen-column" key={group.value}><h3>{group.title}</h3><div className="detail-seen-members">{[...members].sort((a,b) => a.sort_order-b.sort_order || a.id.localeCompare(b.id)).filter(member => movie.seen.some(state => state.member_id === member.id && state.seen === group.value)).map(member => <ClubIdentity key={member.id} identity={{kind:'member',member}} />)}</div></div>)}</div></section>
    <div className="stack">{movie.ranking && <section className="stack"><h2>Classics score</h2><RankingScore movie={movie} /></section>}<section className="stack"><h2>Ratings</h2>{movie.scores.length ? latestScores(movie.scores).map((s,i) => <div className="source-record" key={`${s.provider}-${s.metric}-${i}`}><strong>{s.provider} · {s.metric}</strong>{requiredScores.some(key => key === `${s.provider}:${s.metric}`) && <span className="badge">Classics input</span>}<p>{s.raw_value} / {s.raw_scale ?? 'scale not supplied'}{s.normalized_value !== null ? ` · normalised ${formatScore100(s.normalized_value)}` : ''}</p><details><summary>Source & capture details</summary><p className="meta">{s.vote_count !== null ? `${s.vote_count.toLocaleString()} votes · ` : ''}Via {s.retrieved_via ?? 'unspecified'} · Captured {new Date(s.fetched_at).toLocaleString('en-AU')}</p></details></div>) : <p className="meta">No source scores stored.</p>}</section></div></div>
    <section className="card stack"><div className="section-title"><h2>Book Club appearances</h2><RouteLink to="history" icon={History}>History</RouteLink></div>{movie.appearances.map((a,i) => <p key={`${a.id}-${i}`}>{eventDateLabel(a)} · {a.kind === 'classics' ? 'Classics Collection' : 'Book Club night'} · film {a.position}</p>)}{!movie.appearances.length && <Empty title="Not watched at Book Club yet">This film has no recorded event appearances.</Empty>}</section>
    <details className="utility-disclosure"><summary>Classics membership</summary>    <section className="card stack"><div className="button-set"><Action id="classics-membership-action" icon={Library} disabled={busy || !writesEnabled} onClick={() => changeMembership(!movie.classic)}>{operation === 'membership' ? 'Updating membership…' : movie.classic ? 'Remove from Classics' : 'Add to Classics'}</Action></div>{movie.classics_membership && <p className="meta">Added {new Date(movie.classics_membership.added_at).toLocaleDateString('en-AU')} · {movie.classics_membership.source ?? 'Source unknown'}</p>}{membership.message && <p role="status">{membership.message}</p>}{membership.error && <div className="stack"><p role="alert" className="error-message">Classics membership change could not be confirmed. {membership.error}</p><Action icon={RefreshCw} disabled={busy || !writesEnabled} onClick={event => changeMembership(membership.target!,event.currentTarget)}>Retry {membership.target ? 'adding to' : 'removing from'} Classics</Action></div>}</section>
</details>
    {isAdmin && <details className="utility-disclosure"><summary>Admin · score maintenance</summary><section className="card stack"><Action icon={RefreshCw} disabled={busy || !writesEnabled || !movie.external_ids.some(e => ['imdb','tmdb'].includes(e.provider))} onClick={refreshScores}>{operation === 'scores' ? 'Working…' : 'Refresh scores'}</Action>{scores.providers && <div role="status"><strong>Score refresh result</strong><ProviderFeedback providers={scores.providers} /></div>}{scores.error && <div className="stack"><p role="alert" className="error-message">Score refresh result could not be confirmed. {scores.error} Some scores may have been saved. Check saved film data before refreshing again.</p><Action icon={RefreshCw} disabled={busy} onClick={reloadSaved}>Check saved film data</Action></div>}{operation === 'reload' && <p role="status">Reloading saved film data…</p>}{reload.error && <div className="stack"><p role="alert" className="error-message">{reload.error}</p><Action icon={RefreshCw} disabled={busy} onClick={reloadSaved}>Retry saved film data reload</Action></div>}{reload.message && <p role="status">{reload.message}</p>}</section></details>}
    <details className="utility-disclosure"><summary>Technical identifiers & artwork</summary>    <section className="card stack"><h2>External identifiers & artwork</h2>{movie.external_ids.map(e => <p key={e.provider}>{e.provider}: <span className="numeric">{e.external_id}</span></p>)}{!movie.external_ids.length && <p className="meta">No external IDs recorded.</p>}{movie.assets.map(a => <p className="meta" key={a.reference}>{a.provider} · {a.asset_type} · {a.preferred ? 'preferred' : 'alternate'} · {a.width && a.height ? `${a.width} × ${a.height}` : 'dimensions unknown'}</p>)}</section>
</details>
  </div>;
}
