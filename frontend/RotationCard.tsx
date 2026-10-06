import { useRef, useState } from 'react';
import { CalendarPlus, ListChecks, ListPlus, ArrowLeftRight } from 'lucide-react';
import type { Catalog, Rotation, Viewer } from '../shared/types';
import { effectiveMember, swapTargets } from '../shared/rotation';
import { api } from './api';
import { Action, RouteLink } from './components';
import { ClubIdentity } from './ClubIdentity';
import { BuilderSetPicker } from './BuilderSetPicker';

export function RotationCard({catalog,rotation,viewer,onUpdated,onUseBuilder}: {catalog: Catalog; rotation: Rotation | null; viewer: Viewer | null; onUpdated: (rotation: Rotation | null) => void; onUseBuilder: (movieIds: string[]) => void}) {
  const current = rotation ? effectiveMember(catalog.members,rotation) : undefined;
  const personal = current && viewer?.id === current.id;
  const targets = rotation ? swapTargets(catalog.members,rotation,catalog.sessions) : [];
  const [choosing,setChoosing] = useState(false);
  const pickerTrigger = useRef<HTMLButtonElement | null>(null);
  const closePicker = () => { setChoosing(false); pickerTrigger.current?.focus(); };
  const [targetId,setTargetId] = useState(''), [error,setError] = useState(''), [feedback,setFeedback] = useState(''), [busy,setBusy] = useState(false);
  const selected = targets.find(target => target.member.id === targetId)?.member;
  return <div className={`turn-card-area ${personal ? 'turn-card-area-personal' : ''}`}><section className={`card stack turn-card ${personal ? 'turn-card-personal' : ''}`}>
    <div className="turn-row"><div className="stack turn-identity"><h2>{personal ? 'It is your turn' : 'Current turn'}</h2>
      {rotation ? rotation.nominal_slot === 5 ? <ClubIdentity identity={{kind:'classics'}} /> : current ? <ClubIdentity identity={{kind:'member',member:current}} /> : <p>Current member is unavailable.</p> : <p className="meta">Current turn has not been initialised.</p>}
    </div>{rotation && <div className="button-set turn-actions">
      {personal && <><RouteLink to="builder" icon={ListPlus} variant="secondary">Plan in Builder</RouteLink><Action icon={ListChecks} onClick={e => { pickerTrigger.current = e.currentTarget; setChoosing(true); }}>Use from Builder</Action></>}
      {rotation.nominal_slot === 5 && <RouteLink to="classics" icon={ListPlus} variant="secondary">View Watch Order</RouteLink>}
      <RouteLink to="event" icon={CalendarPlus} variant="primary">Record an Event</RouteLink>
    </div>}</div>
    {viewer?.role === 'admin' && rotation && rotation.nominal_slot < 5 && <details className="utility-disclosure"><summary>Admin · swap current turn</summary><form className="stack" onSubmit={e => {
      e.preventDefault(); if (!current || !selected || busy) return;
      const message = `${selected.display_name.toUpperCase()} is current now; ${current.display_name.toUpperCase()} moves to their position for this cycle.`;
      setBusy(true); setError(''); setFeedback('');
      void api.swapRotation({target_member_id:selected.id,version:rotation.version}).then(turn => { setTargetId(''); setFeedback(message); onUpdated(turn); }).catch(e => setError(e instanceof Error ? e.message : 'Swap failed.')).finally(() => setBusy(false));
    }}>
      {current && <p className="meta">Swap {current.display_name.toUpperCase()} with another member who has not yet had their turn this cycle. They become current now; {current.display_name.toUpperCase()} moves to their position for this cycle only.</p>}
      {targets.length ? <><label className="input-label">Swap current turn<select required className="field__input" value={selected?.id ?? ''} disabled={busy} onChange={e => setTargetId(e.target.value)}><option value="">Choose a member</option>{targets.map(({member}) => <option value={member.id} key={member.id}>{member.display_name.toUpperCase()}</option>)}</select></label><Action icon={ArrowLeftRight} type="submit" disabled={busy || !selected}>Swap turns</Action></> : <p className="meta">No eligible future turns this cycle.</p>}
      {feedback && <p role="status" className="meta">{feedback}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    </form></details>}
  </section>{choosing && personal && viewer && <BuilderSetPicker catalog={catalog} viewer={viewer} onClose={closePicker} onChoose={movieIds => { closePicker(); onUseBuilder(movieIds); }} />}</div>;
}
