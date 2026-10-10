import { type ReactNode, type RefObject } from 'react';
import { Info } from 'lucide-react';
import type { Viewer } from '../shared/types';
import type { ResolvedRoute } from './routes';
import { AccountMenu } from './AccountMenu';
import { Navigation } from './Navigation';

export function AppShell({showAi=false,aiBusy=false,onToggleAi,navigationExpanded,onToggleNavigation,missingAnswersCount,page,route,shellTitle,heading,viewer,authBusy,onLogout,demo,localDevelopment,subtitle,actions,children}: {
  showAi?:boolean; aiBusy?:boolean; onToggleAi?:()=>void;
  missingAnswersCount?:number; navigationExpanded:boolean; onToggleNavigation:()=>void;
  page:string; route:ResolvedRoute; shellTitle:string; heading:RefObject<HTMLHeadingElement|null>;
  viewer:Viewer|null; authBusy:boolean; onLogout:()=>void; demo:boolean; localDevelopment:boolean;
  subtitle?:string; actions:ReactNode; children:ReactNode;
}) {
  return <div className={`app-layout ${navigationExpanded ? 'navigation-expanded' : 'navigation-collapsed'}`}>
    {localDevelopment && demo && <p className="demo-label"><Info size={12} aria-hidden="true" />Local disposable database</p>}
    <Navigation missingAnswersCount={missingAnswersCount} page={page} expanded={navigationExpanded} onToggle={onToggleNavigation} />
    <div className="bookclub-shell"><header className="site-header"><a className="brand" href="#/home"><img className="brand-icon" src={`${import.meta.env.BASE_URL}newFav/fav1.png`} alt="" /><span>{page === 'home' ? 'Book Club' : shellTitle}<small>HAVE YOU UPDATED THE SPREADSH... WEB APP?</small></span></a><div className="viewer-controls">{viewer ? <AccountMenu showAi={showAi} aiBusy={aiBusy} onToggleAi={onToggleAi} viewer={viewer} busy={authBusy} onLogout={onLogout} /> : <span className="header-tag">{demo ? 'LOCAL DEMO' : 'FILM CLUB'}</span>}</div></header>
    <main id="main"><div className="page-heading"><div className="page-title-region"><h1 ref={heading} tabIndex={-1}>{route.image && <img className="destination-icon" src={`${import.meta.env.BASE_URL}buttons/${route.image}`} alt="" />}{route.heading}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{actions}</div>
    {children}
    <footer className="data-sources"><details><summary><Info size={18} aria-hidden="true" />Data sources & attribution</summary><p className="data-sources-content">Ratings are stored snapshots, not live values. MDBList and OMDb retrieve third-party ratings; BookClub has no direct IMDb, Rotten Tomatoes or Letterboxd API relationship.<br />This product uses the TMDB API but is not endorsed or certified by TMDB.<br /><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer"><img className="tmdb-logo" src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="The Movie Database" /></a><br />Australian watch availability: <a href="https://www.justwatch.com/au" target="_blank" rel="noreferrer">JustWatch</a> via TMDB; cached options may change.<br /><a href="https://mdblist.com/" target="_blank" rel="noreferrer">MDBList</a> · <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer">OMDb</a></p></details></footer>
    </main></div></div>;
}
