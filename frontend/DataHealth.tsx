import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api } from './api';
import { healthCategories, healthLocations, healthPriorities, type HealthFilm, type HealthPage } from '../shared/data-health';

export function DataHealth(){
  const [page,setPage]=useState<HealthPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState('all'),[priority,setPriority]=useState('actionable'),[location,setLocation]=useState('all');
  const [refresh,setRefresh]=useState(0);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{
    const request=new AbortController();controller.current=request;
    let active=true;
    void api.dataHealth(null,search,request.signal).then(result=>{if(active)setPage(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;request.abort();controller.current?.abort();};
  },[search,refresh]);
  const start=()=>{controller.current?.abort();setBusy(true);setError('');if(search!==query.trim()){setPage(null);setSearch(query.trim());}else setRefresh(n=>n+1);};
  const loadMore=async()=>{
    if(busy||!page?.next)return;
    const request=new AbortController();controller.current=request;setBusy(true);setError('');
    try{const result=await api.dataHealth(page.next,search,request.signal);if(!request.signal.aborted)setPage(old=>old?{...result,films:[...old.films,...result.films],scanned:old.scanned+result.scanned,partial:old.partial||result.partial}:result);}
    catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Could not load data health.');}
    finally{if(!request.signal.aborted)setBusy(false);}
  };
  const selectedIssues=(film:HealthFilm)=>film.issues.filter(issue=>(category==='all'||issue.category===category)&&(priority==='all'||(priority==='actionable'?(issue.priority==='blocking'||issue.priority==='actionable'):issue.priority===priority)));
  const films=(page?.films??[]).filter(film=>(location==='all'||film.locations.some(l=>l.kind===location))&&selectedIssues(film).length).sort((a,b)=>Number(selectedIssues(b).some(i=>i.priority==='blocking'))-Number(selectedIssues(a).some(i=>i.priority==='blocking'))||a.title.localeCompare(b.title));
  const issueCount=films.reduce((sum,film)=>sum+selectedIssues(film).length,0);
  return <section className="card stack data-health" aria-labelledby="data-health-heading">
    <h2 id="data-health-heading">Data health and exceptions</h2>
    <p className="meta">Read-only inspection of canonical films and stored provider evidence. No provider requests or repairs.</p>
    <form className="health-search" onSubmit={e=>{e.preventDefault();start();}}><label className="input-label">Find film by title<input className="field__input" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label><button className="button button--secondary" disabled={busy}>Search / refresh</button></form>
    <div className="health-filters">
      <label className="input-label">Exception category<select className="field__input" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{healthCategories.map(value=><option key={value} value={value}>{({identity:'Identity',metadata:'Metadata',artwork:'Artwork',ratings:'Ratings',coverage:'Provider coverage',consistency:'Consistency'})[value]}</option>)}</select></label>
      <label className="input-label">Priority<select className="field__input" value={priority} onChange={e=>setPriority(e.target.value)}><option value="actionable">Actionable incl. blocking</option><option value="all">All incl. confirmed absence</option>{healthPriorities.filter(value=>value!=='actionable').map(value=><option key={value} value={value}>{value==='confirmed'?'Confirmed unavailable':value==='review'?'Lower-priority review':'Feature blocking'}</option>)}</select></label>
      <label className="input-label">Film location<select className="field__input" value={location} onChange={e=>setLocation(e.target.value)}><option value="all">All locations</option>{healthLocations.map(value=><option key={value} value={value}>{({history:'Active History',ranked:'Ranked Classic',unranked:'Unranked Classic',dq:'Disqualified Classic',builder:'Private saved Builder',prediction:'AI Prediction',archived:'Archived History',catalogue:'Catalogue only'})[value]}</option>)}</select></label>
    </div>
    {page&&<p className="meta" role="status">{films.length} affected films · {issueCount} matching issues · {page.scanned} films inspected{page.next?' · More films remain':''}. Filters apply to inspected films; title search covers the catalogue.</p>}
    {page?.partial&&<p className="error-message">Partial diagnostic: this schema lacks some prediction or provider field evidence. Missing evidence is uncertain; update schema compatibility before relying on complete coverage.</p>}
    {busy&&<p className="meta" role="status">Loading data health…</p>}
    {error&&<p className="error-message" role="alert">{error}{page?' Already inspected results remain available.':''}</p>}
    {!busy&&!error&&page&&!films.length&&<p role="status">{priority==='actionable'&&category==='all'&&location==='all'?'No actionable exceptions in the inspected films.':'No exceptions match these filters.'}{page.next?' More films remain to inspect.':page.scanned?' Inspection complete.':' No films found.'}</p>}
    <div className="health-results">{films.map(film=><details className="health-film" key={film.id}><summary><span><a className="movie-link" href={`#/movie/${film.id}`}><span className="movie-title">{film.title}</span></a>{film.year&&<span className="meta"> · {film.year}</span>}<span className="meta health-row-context">{film.locations.map(l=>l.label).join(' / ')}</span></span><span className="meta">{selectedIssues(film).length} issues</span><ChevronDown size={18} aria-hidden="true"/></summary>
      <p className="meta">{film.external_ids.filter(i=>['imdb','tmdb'].includes(i.provider)).map(i=>`${i.provider.toUpperCase()}: ${i.external_id}`).join(' · ')||'No IMDb / TMDB identities'}</p>
      <ul className="health-issues">{selectedIssues(film).map(issue=><li key={issue.code} data-priority={issue.priority}><strong>{issue.label}</strong><span className="meta"> · {issue.priority==='confirmed'?'Confirmed unavailable':issue.priority}</span><p className="meta">{issue.explanation}</p>{(issue.provider||issue.checkedAt||issue.attemptedAt)&&<p className="meta">{[issue.provider,issue.identity,issue.checkedAt?'Last checked: '+issue.checkedAt:null,issue.attemptedAt?'Last attempted: '+issue.attemptedAt:null].filter(Boolean).join(' · ')}</p>}</li>)}</ul>
    </details>)}</div>
    {page?.next&&<button className="button button--secondary" disabled={busy} onClick={()=>void loadMore()}>Inspect next 80 films</button>}
    {!busy&&error&&<button className="button button--secondary" onClick={start}>Retry</button>}
  </section>;
}
