import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { Catalog, Rotation } from '../shared/types';
import { effectiveMember, swapTargets, canSwapClassics, isClassicsTurn } from '../shared/rotation';
import { api } from './api';
import { Action } from './components';

export function RotationSwapCard({catalog,rotation,writesEnabled,onUpdated}: {catalog: Catalog; rotation: Rotation | null; writesEnabled: boolean; onUpdated: (rotation: Rotation | null) => void}) {
  const current = rotation ? effectiveMember(catalog.members,rotation) : undefined;
  const targets = rotation ? swapTargets(catalog.members,rotation,catalog.sessions) : [];
  const classicsEligible = rotation ? canSwapClassics(catalog.members,rotation,catalog.sessions) : false;
  const [targetId,setTargetId] = useState(''), [error,setError] = useState(''), [feedback,setFeedback] = useState(''), [busy,setBusy] = useState(false);
  const selected = targets.find(target => target.member.id === targetId)?.member;
  const classicsSelected = classicsEligible && targetId === 'classics';
  return <section className="card stack"><h2>Swap current turn</h2>{rotation && !isClassicsTurn(rotation) ? <form className="stack rotation-swap-form" onSubmit={e => {
      e.preventDefault(); if (!current || (!selected && !classicsSelected) || busy || !writesEnabled) return;
      const message = classicsSelected ? `Classics is current now; ${current.display_name.toUpperCase()} moves to the last position for this cycle.` : `${selected!.display_name.toUpperCase()} is current now; ${current.display_name.toUpperCase()} moves to their position for this cycle.`;
      setBusy(true); setError(''); setFeedback('');
      void api.swapRotation({...(classicsSelected ? {target_kind:'classics' as const} : {target_member_id:selected!.id}),version:rotation.version}).then(turn => { setTargetId(''); setFeedback(message); onUpdated(turn); }).catch(e => setError(e instanceof Error ? e.message : 'Swap failed.')).finally(() => setBusy(false));
    }}>
      {current && <p className="meta">Swap {current.display_name.toUpperCase()} with an eligible future turn this cycle. They become current now; {current.display_name.toUpperCase()} moves to their position for this cycle only.</p>}
      {targets.length || classicsEligible ? <><label className="input-label">Swap current turn<select required className="field__input" value={classicsSelected ? 'classics' : selected?.id ?? ''} disabled={busy || !writesEnabled} onChange={e => setTargetId(e.target.value)}><option value="">Choose a turn</option>{targets.map(({member}) => <option value={member.id} key={member.id}>{member.display_name.toUpperCase()}</option>)}{classicsEligible && <option value="classics">Classics</option>}</select></label><Action icon={ArrowLeftRight} type="submit" disabled={busy || (!selected && !classicsSelected) || !writesEnabled}>Swap turns</Action></> : <p className="meta">No eligible future turns this cycle.</p>}
      {feedback && <p role="status" className="meta">{feedback}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    </form> : <p className="meta">{rotation ? 'Classics is the current turn; no member turn to swap.' : 'Current turn has not been initialised.'}</p>}</section>;
}
