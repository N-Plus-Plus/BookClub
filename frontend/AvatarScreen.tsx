import { useEffect, useRef, useState } from 'react';
import { Check, LogOut } from 'lucide-react';
import type { Viewer } from '../shared/types';
import { api } from './api';
import { Action } from './components';
export function AvatarScreen({viewer,onClaimed,onLogout,externalError}: {viewer: Viewer; onClaimed: (viewer: Viewer) => void; onLogout: () => void; externalError?: string}) {
  const [available,setAvailable] = useState<number[]>([]), [selected,setSelected] = useState<number | null>(null);
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [loaded,setLoaded] = useState(false);
  const carousel = useRef<HTMLDivElement>(null);
  const centredChoice = () => {
    const rail = carousel.current;
    if (!rail) return null;
    const centre = rail.getBoundingClientRect().left + rail.clientWidth / 2;
    let nearest: {id: number; distance: number} | null = null;
    for (const item of rail.querySelectorAll<HTMLButtonElement>('[data-avatar]')) {
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - centre);
      if (!nearest || distance < nearest.distance) nearest = {id: Number(item.dataset.avatar),distance};
    }
    return nearest && nearest.distance <= 2 ? nearest.id : null;
  };
  const nominateCentre = () => setSelected(centredChoice());
  const centreChoice = (item: HTMLButtonElement) => {
    const rail = carousel.current;
    if (!rail || busy) return;
    setSelected(null);
    const rect = item.getBoundingClientRect();
    rail.scrollTo({left: rail.scrollLeft + rect.left + rect.width / 2 - rail.getBoundingClientRect().left - rail.clientWidth / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    nominateCentre();
  };
  useEffect(() => {
    const rail = carousel.current;
    if (!rail) return;
    const initial = rail.querySelectorAll<HTMLButtonElement>('[data-avatar]')[Math.min(2,available.length - 1)];
    if (initial) {
      const rect = initial.getBoundingClientRect();
      rail.scrollTo({left: rail.scrollLeft + rect.left + rect.width / 2 - rail.getBoundingClientRect().left - rail.clientWidth / 2,behavior: 'instant'});
    }
    nominateCentre();
    const observer = new ResizeObserver(nominateCentre);
    observer.observe(rail);
    return () => observer.disconnect();
  },[available]);
  useEffect(() => {
    const load = async () => { try { setAvailable(await api.avatars()); setLoaded(true); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load avatars.'); } };
    void load();
  },[]);
  const claim = async () => {
    const avatar = centredChoice();
    if (avatar === null || !available.includes(avatar) || busy) return;
    setBusy(true); setError('');
    try { onClaimed(await api.claimAvatar(avatar)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not claim avatar.'); }
    finally { setBusy(false); }
  };
  return <main className="bookclub-shell avatar-onboarding"><section className="card stack"><p className="eyebrow">WELCOME, {viewer.display_name.toUpperCase()}</p><h1>Choose your avatar</h1>
    {!loaded && <p role="status">Loading available avatars…</p>}<div ref={carousel} className="avatar-carousel" role="group" aria-label="Available avatars" onScroll={nominateCentre} onWheel={event => {
      if (busy) return;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.currentTarget.scrollBy({left: event.deltaY,behavior: 'auto'});
      }
    }} style={busy ? {overflowX: 'hidden'} : undefined}>{available.map(id => <button key={id} type="button" className="avatar-choice" data-avatar={id} aria-label={`Choose avatar ${id}`} aria-pressed={selected === id} disabled={busy} onClick={event => centreChoice(event.currentTarget)} onFocus={event => centreChoice(event.currentTarget)}><img alt="" src={`${import.meta.env.BASE_URL}avatars/${id}.png`} />{selected === id && <Check aria-hidden="true" />}</button>)}</div>
    {loaded && !available.length && <p role="alert">No avatars available. Contact a club administrator.</p>}{(error || externalError) && <p className="error-message" role="alert">{error || externalError}</p>}
    <div className="button-set button-set--end"><Action icon={LogOut} disabled={busy} onClick={onLogout}>Log out</Action><Action icon={Check} intent="constructive" disabled={busy || selected === null} onClick={() => void claim()}>{busy ? 'Choosing…' : 'Choose and continue'}</Action></div>
  </section></main>;
}
