import { ChartNoAxesColumn, Eye, History, Home, Library, ListPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Action } from './components';

export const destinations = [
  {path: 'home',label: 'Home',icon: Home}, {path: 'history',label: 'History',icon: History},
  {path: 'builder',label: 'Builder',icon: ListPlus}, {path: 'classics',label: 'Classics',icon: Library},
  {path: 'seen',label: 'Seen It?',icon: Eye}, {path: 'metrics',label: 'Metrics',icon: ChartNoAxesColumn},
];
const favImage = `${import.meta.env.BASE_URL}favicons/fav${Math.floor(Math.random() * 8)}.png`;

export function Navigation({page,expanded,onToggle}: {page: string; expanded: boolean; onToggle: () => void}) {
  return <><aside className="desktop-navigation" aria-label="BookClub navigation">
    <div className="navigation-toggle-row"><Action icon={expanded ? PanelLeftClose : PanelLeftOpen} variant="tertiary" onClick={onToggle} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'} title={expanded ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={expanded} aria-controls="desktop-destinations" />
      {expanded && <button type="button" className="navigation-fav" onClick={onToggle} aria-label="Collapse navigation" title="Collapse navigation" aria-expanded={expanded} aria-controls="desktop-destinations"><img src={favImage} alt="" /></button>}
    </div>
    <nav id="desktop-destinations" aria-label="Desktop primary navigation">{destinations.map(({path,label,icon: Icon}) => <a key={path} href={`#/${path}`} aria-label={label} title={label} aria-current={page === path ? 'page' : undefined}><Icon size={22} aria-hidden="true" /><span className="navigation-label">{label}</span><span className="navigation-tooltip" aria-hidden="true">{label}</span></a>)}</nav>
  </aside><nav className="bottom-nav" aria-label="Primary navigation">{destinations.map(({path,label,icon: Icon}) => <a key={path} href={`#/${path}`} aria-current={page === path ? 'page' : undefined}><Icon size={22} aria-hidden="true" /><span>{label}</span></a>)}</nav></>;
}
