import { useEffect, useState } from 'react';
import { Check, LogOut, Plus, RefreshCw } from 'lucide-react';
import type { Viewer } from '../shared/types';
import { api, ApiClientError } from './api';
import { Action } from './components';
export function AvatarScreen({viewer,onClaimed,onLogout,externalError}: {viewer: Viewer; onClaimed: (viewer: Viewer) => void; onLogout: () => void; externalError?: string}) {
  const [available,setAvailable] = useState<number[]>([]), [selected,setSelected] = useState<number | null>(null);
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [loaded,setLoaded] = useState(false);
  const refresh = async () => { try { setAvailable(await api.avatars()); setLoaded(true); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load avatars.'); } };
  useEffect(() => { void refresh(); },[]);
  const claim = async () => {
    if (selected === null || busy) return;
    setBusy(true); setError('');
    try { onClaimed(await api.claimAvatar(selected)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not claim avatar.'); if (e instanceof ApiClientError && e.status === 409) { setSelected(null); await refresh(); } }
    finally { setBusy(false); }
  };
  return <main className="bookclub-shell avatar-onboarding"><section className="card stack"><p className="eyebrow">WELCOME, {viewer.display_name.toUpperCase()}</p><h1>Choose your avatar</h1><p className="subtitle">Pick your place in the club. This is a one-time choice.</p>
    {!loaded && <p role="status">Loading available avatars…</p>}<div className="avatar-grid">{available.map(id => <button key={id} type="button" className="avatar-choice" aria-label={`Choose avatar ${id}`} aria-pressed={selected === id} disabled={busy} onClick={() => setSelected(id)}><img alt="" src={`${import.meta.env.BASE_URL}avatars/${id}.png`} />{selected === id ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}</button>)}</div>
    {loaded && !available.length && <p role="alert">No avatars available. Contact a club administrator.</p>}{(error || externalError) && <p className="error-message" role="alert">{error || externalError}</p>}
    <div className="button-set"><Action icon={Check} intent="constructive" disabled={busy || selected === null} onClick={() => void claim()}>{busy ? 'Choosing…' : 'Choose & continue'}</Action><Action icon={RefreshCw} disabled={busy} onClick={() => void refresh()}>Refresh choices</Action><Action icon={LogOut} disabled={busy} onClick={onLogout}>Logout</Action></div>
  </section></main>;
}
