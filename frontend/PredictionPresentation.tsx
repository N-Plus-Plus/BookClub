import { useEffect, useState } from 'react';
import type { Movie } from '../shared/types';
import { Poster } from './components';

export function shufflePredictions<T>(films:readonly T[],random= Math.random):T[] {
  const result=[...films];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
/** Parent keys this presentation by participant and sorted membership, never by rotation version. */
export function PredictionPresentation({movies}: {movies:Movie[]}) {
  const [sequence]=useState(()=>shufflePredictions(movies.map(m=>m.id)));
  const [position,setPosition]=useState(0);
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [focused,setFocused]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!query)return;
    const update=()=>setReduced(query.matches);query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    if(sequence.length<2 || reduced || focused)return;
    const timer=setInterval(()=>setPosition(value=>(value+1)%sequence.length),6100);
    return()=>clearInterval(timer);
  },[sequence,reduced,focused]);
  const movie=movies.find(m=>m.id===sequence[position]);
  if(!movie)return null;
  return <section className="turn-predictions" aria-label="AI predictions"><h3>Will they bring...</h3>
    <a key={movie.id} className={`movie-link prediction-poster${sequence.length>1 && !reduced && !focused?' prediction-animated':''}`} href={`#/movie/${movie.id}`} aria-label={movie.title} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}><Poster movie={movie}/></a>
  </section>;
}
