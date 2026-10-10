import { useEffect, useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { AiPrediction, Catalog, Movie, MovieDetail } from '../shared/types';
import { catalogIndex } from '../shared/catalog-index';
import { api } from './api';
import { Action, MovieRow } from './components';
import { FilmPicker } from './FilmPicker';

export function AiPredictionsCard({catalog,writesEnabled,onMovie,onPredictionsChanged}: {onPredictionsChanged?:(rows:AiPrediction[])=>void;catalog:Catalog;writesEnabled:boolean;onMovie:(movie:MovieDetail)=>void}) {
  const members=catalog.members.filter(m=>m.active && m.sort_order>=1 && m.sort_order<=4);
  const [participant,setParticipant]=useState('');
  const [exportParticipant,setExportParticipant]=useState(members[0]?.id ?? '');
  const [predictions,setPredictions]=useState<AiPrediction[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const alive=useRef(true),inFlight=useRef(false);
  useEffect(()=>{alive.current=true;let cancelled=false;void api.predictions().then(rows=>{if(!cancelled)setPredictions(rows);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{alive.current=false;cancelled=true;};},[]);
  const run=async(work:()=>Promise<void>)=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{await work();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Action failed.');}finally{inFlight.current=false;if(alive.current)setBusy(false);}};
  const index=catalogIndex(catalog);
  const selected=predictions.filter(p=>p.member_id===participant && !index.historyMovieIds.has(p.movie_id)).map(p=>index.movieById.get(p.movie_id)).filter((m):m is Movie=>Boolean(m));
  const options=members.map(m=><option key={m.id} value={m.id}>{m.display_name}</option>);
  return <section className="card stack ai-predictions-card"><h2>AI predicted</h2>
    <label className="input-label">Participant<select className="field__input" value={participant} disabled={busy} onChange={e=>setParticipant(e.target.value)}><option value="">Select participant</option>{options}</select></label>
    {participant && <><FilmPicker key={participant} selected={selected} movies={catalog.movies} movieById={index.movieById} historyMovieIds={index.historyMovieIds} showManualAdd={false} disabled={busy || loading || !writesEnabled} onMovie={()=>{}} onSelected={()=>{}} onCandidateSelected={(candidate,film)=>void run(async()=>{
      if(!participant)return;
      const movie=candidate.kind==='local'?film as MovieDetail:await api.importMovie(candidate.movie.externalId);
      const rows=await api.addPrediction(participant,movie.id);
      if(alive.current){onMovie(movie);setPredictions(rows);onPredictionsChanged?.(rows);}
    })}/>
    <ul className="prediction-list">{selected.map(movie=><li key={movie.id}><MovieRow movie={movie}/><Action icon={Trash2} aria-label={`Remove ${movie.title} prediction`} title={`Remove ${movie.title}`} disabled={busy || !writesEnabled} onClick={()=>void run(async()=>{if(!participant)return;const rows=await api.removePrediction(participant,movie.id);if(alive.current){setPredictions(rows);onPredictionsChanged?.(rows);}})}/></li>)}</ul>
    {!selected.length && <p className="meta">No predictions for this participant.</p>}</>}
    <div className="stack prediction-export"><h3>Participant History export</h3><div className="button-set"><label className="input-label">Export participant<select className="field__input" value={exportParticipant} disabled={busy} onChange={e=>setExportParticipant(e.target.value)}>{options}</select></label><Action icon={Download} disabled={busy} onClick={()=>void run(async()=>{
      const result=await api.historyExport(exportParticipant);
      if(!alive.current)return;
      const url=URL.createObjectURL(new Blob([result.text],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    })}>Export</Action></div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
