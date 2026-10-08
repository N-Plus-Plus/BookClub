import { useRef, useState } from 'react';
import { CalendarPlus, ListChecks, ListPlus } from 'lucide-react';
import type { Catalog, Rotation, Viewer } from '../shared/types';
import { effectiveMember } from '../shared/rotation';
import { Action, RouteLink } from './components';
import { ClubIdentity } from './ClubIdentity';
import { BuilderSetPicker } from './BuilderSetPicker';

export function RotationCard({catalog,rotation,viewer,onUseBuilder}: {catalog: Catalog; rotation: Rotation | null; viewer: Viewer | null; onUpdated: (rotation: Rotation | null) => void; onUseBuilder: (movieIds: string[]) => void}) {
  const current = rotation ? effectiveMember(catalog.members,rotation) : undefined;
  const personal = current && viewer?.id === current.id;
  const [choosing,setChoosing] = useState(false);
  const pickerTrigger = useRef<HTMLButtonElement | null>(null);
  const closePicker = () => { setChoosing(false); pickerTrigger.current?.focus(); };
  return <div className={`turn-card-area ${personal ? 'turn-card-area-personal' : ''}`}><section className={`card stack turn-card ${personal ? 'turn-card-personal' : ''}`}>
    <div className="turn-row"><div className="stack turn-identity"><h2>{personal ? 'It is your turn' : 'Current turn'}</h2>
      {rotation ? rotation.nominal_slot === 5 ? <ClubIdentity identity={{kind:'classics'}} /> : current ? <ClubIdentity identity={{kind:'member',member:current}} /> : <p>Current member is unavailable.</p> : <p className="meta">Current turn has not been initialised.</p>}
    </div>{rotation && <div className="button-set turn-actions action-group-wrap">
      {personal && <><RouteLink to="builder" icon={ListPlus} variant="secondary">Plan in Builder</RouteLink><Action icon={ListChecks} onClick={e => { pickerTrigger.current = e.currentTarget; setChoosing(true); }}>Use from Builder</Action></>}
      {rotation.nominal_slot === 5 && <RouteLink to="classics" icon={ListPlus} variant="secondary">View Watch Order</RouteLink>}
      <RouteLink to="event" icon={CalendarPlus} variant="primary">Record an Event</RouteLink>
    </div>}</div>

  </section>{choosing && personal && viewer && <BuilderSetPicker catalog={catalog} viewer={viewer} onClose={closePicker} onChoose={movieIds => { closePicker(); onUseBuilder(movieIds); }} />}</div>;
}
