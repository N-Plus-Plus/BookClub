import { formatCount } from '../shared/format';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Action } from './components';

import { primaryDestinations } from './routes';

export function Navigation({page,expanded,onToggle,missingAnswersCount = 0}: {page: string; expanded: boolean; onToggle: () => void; missingAnswersCount?: number}) {
  return <><aside className="desktop-navigation" aria-label="BookClub navigation">
    <div className="navigation-toggle-row"><Action icon={expanded ? PanelLeftClose : PanelLeftOpen} variant="tertiary" onClick={onToggle} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'} title={expanded ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={expanded} aria-controls="desktop-destinations" />
    </div>
    <nav id="desktop-destinations" aria-label="Desktop primary navigation">{primaryDestinations.map(({path,label,image}) => <a key={path} href={`#/${path}`} aria-label={path === 'seen' && missingAnswersCount ? `${label}: ${formatCount(missingAnswersCount)} missing ${missingAnswersCount === 1 ? 'answer' : 'answers'}` : label} title={label} aria-current={page === path ? 'page' : undefined}><img className="destination-icon" src={`${import.meta.env.BASE_URL}buttons/${image}`} alt="" /><span className="navigation-label">{label}</span>{path === 'seen' && missingAnswersCount > 0 && <span className="count-indicator navigation-count" aria-hidden="true">{missingAnswersCount > 99 ? '99+' : formatCount(missingAnswersCount)}</span>}<span className="navigation-tooltip" aria-hidden="true">{label}</span></a>)}</nav>
  </aside><nav className="bottom-nav" aria-label="Primary navigation">{primaryDestinations.map(({path,label,image}) => <a key={path} href={`#/${path}`} aria-current={page === path ? 'page' : undefined}><img className="destination-icon" src={`${import.meta.env.BASE_URL}buttons/${image}`} alt="" /><span>{label}</span></a>)}</nav></>;
}
