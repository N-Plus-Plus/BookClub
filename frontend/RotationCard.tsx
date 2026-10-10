import { useRef, useState } from 'react';
import { CalendarPlus, ListChecks, ListPlus } from 'lucide-react';
import type { AiPrediction, Catalog, Rotation, Viewer } from '../shared/types';
import { PredictionPresentation } from './PredictionPresentation';
import { catalogIndex } from '../shared/catalog-index';
import { effectiveMember, isClassicsTurn } from '../shared/rotation';
import { Action, RouteLink } from './components';
import { ClubIdentity } from './ClubIdentity';
import { BuilderSetPicker } from './BuilderSetPicker';

export function RotationCard({catalog,rotation,viewer,onUseBuilder,showAi=false,predictions=[]}: {showAi?:boolean;predictions?:AiPrediction[];catalog: Catalog; rotation: Rotation | null; viewer: Viewer | null; onUpdated: (rotation: Rotation | null) => void; onUseBuilder: (movieIds: string[]) => void}) {
  const current = rotation ? effectiveMember(catalog.members,rotation) : undefined;
  const personal = current && viewer?.id === current.id;
  const history=catalogIndex(catalog).historyMovieIds;
  const ids=new Set(predictions.filter(p=>p.member_id===current?.id && !history.has(p.movie_id)).map(p=>p.movie_id));
  const films=showAi && rotation && !isClassicsTurn(rotation)?catalog.movies.filter(m=>ids.has(m.id)).sort((a,b)=>a.id.localeCompare(b.id)):[];
  const [choosing,setChoosing] = useState(false);
  const pickerTrigger = useRef<HTMLButtonElement | null>(null);
  const closePicker = () => { setChoosing(false); pickerTrigger.current?.focus(); };
  return <div className={`turn-card-area ${personal ? 'turn-card-area-personal' : ''}`}><section className={`card stack turn-card ${personal ? 'turn-card-personal' : ''}`}>
    <div className={`turn-row${films.length?' turn-row-with-predictions':''}`}><div className="stack turn-identity"><h2>{personal ? 'It is your turn' : 'Current turn'}</h2>
      {rotation ? isClassicsTurn(rotation) ? <ClubIdentity identity={{kind:'classics'}} /> : current ? <ClubIdentity identity={{kind:'member',member:current}} /> : <p>Current member is unavailable.</p> : <p className="meta">Current turn has not been initialised.</p>}
    </div>{films.length>0 && <PredictionPresentation key={JSON.stringify([current?.id,films.map(m=>m.id)])} movies={films}/>} {rotation && <div className="button-set turn-actions">
      {personal && <><RouteLink to="builder" icon={ListPlus} variant="secondary">Plan in Builder</RouteLink><Action icon={ListChecks} onClick={e => { pickerTrigger.current = e.currentTarget; setChoosing(true); }}>Use from Builder</Action></>}
      {isClassicsTurn(rotation) && <RouteLink to="classics" icon={ListPlus} variant="secondary">View watch order</RouteLink>}
      <RouteLink to="event" icon={CalendarPlus} variant="primary">Event</RouteLink>
    </div>}</div>

  </section>{choosing && personal && viewer && <BuilderSetPicker catalog={catalog} viewer={viewer} onClose={closePicker} onChoose={movieIds => { closePicker(); onUseBuilder(movieIds); }} />}</div>;
}
