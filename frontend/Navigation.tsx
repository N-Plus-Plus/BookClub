import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Action } from './components';

export const destinations = [
  {path: 'home',label: 'Home',image: 'home.png'}, {path: 'history',label: 'History',image: 'history.png'},
  {path: 'builder',label: 'Builder',image: 'builder.png'}, {path: 'classics',label: 'Classics',image: 'classsics.png'},
  {path: 'seen',label: 'Seen',image: 'seen.png'}, {path: 'metrics',label: 'Metrics',image: 'metrics.png'},
];

export function Navigation({page,expanded,onToggle}: {page: string; expanded: boolean; onToggle: () => void}) {
  return <><aside className="desktop-navigation" aria-label="BookClub navigation">
    <div className="navigation-toggle-row"><Action icon={expanded ? PanelLeftClose : PanelLeftOpen} variant="tertiary" onClick={onToggle} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'} title={expanded ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={expanded} aria-controls="desktop-destinations" />
    </div>
    <nav id="desktop-destinations" aria-label="Desktop primary navigation">{destinations.map(({path,label,image}) => <a key={path} href={`#/${path}`} aria-label={label} title={label} aria-current={page === path ? 'page' : undefined}><img className="destination-icon" src={`${import.meta.env.BASE_URL}buttons/${image}`} alt="" /><span className="navigation-label">{label}</span><span className="navigation-tooltip" aria-hidden="true">{label}</span></a>)}</nav>
  </aside><nav className="bottom-nav" aria-label="Primary navigation">{destinations.map(({path,label,image}) => <a key={path} href={`#/${path}`} aria-current={page === path ? 'page' : undefined}><img className="destination-icon" src={`${import.meta.env.BASE_URL}buttons/${image}`} alt="" /><span>{label}</span></a>)}</nav></>;
}
