import { useCallback, useRef, useState } from 'react';
import type { Catalog, FilmCandidate, Movie, TmdbPreview } from '../shared/types';
import { api } from './api';
import { resolveRoute } from './routes';

type Inspection = {source: string; target: string; candidate: FilmCandidate; preview?: TmdbPreview; pending?: Promise<TmdbPreview>};
export function useFilmInspection(page:string,catalog:Catalog|null,applyMovie:(movie:Movie)=>void) {
  const [inspection,setInspection] = useState<Inspection | null>(null);
  const inspectionRef = useRef<Inspection | null>(null);
  const [confirmedMovie,setConfirmedMovie] = useState<Movie | null>(null);
  const consumeConfirmedMovie = useCallback(() => setConfirmedMovie(null),[]);
  const [inspectionError,setInspectionError] = useState('');
  const [confirming,setConfirming] = useState(false);
  const confirmInFlight = useRef(false);
  const confirmedReturn = useRef<string | null>(null);
  const inspect = (candidate: FilmCandidate,preview?: TmdbPreview,pending?: Promise<TmdbPreview>) => {
    const target = candidate.kind === 'local' ? `movie/${candidate.movie.id}` : `preview/tmdb/${candidate.movie.externalId}`;
    const context = {source:page,target,candidate,preview,pending};
    inspectionRef.current = context; setInspection(context); setInspectionError(''); window.location.hash = `/${target}`;
  };
  const confirmFilm = async () => {
    const context = inspectionRef.current;
    if (!context || confirmInFlight.current) return;
    confirmInFlight.current = true; setConfirming(true); setInspectionError('');
    let accepted = false;
    try {
      const candidate = context.candidate;
      const movie = candidate.kind === 'local'
        ? catalog?.movies.find(movie => movie.id === candidate.movie.id) ?? await api.detail(candidate.movie.id)
        : await api.importMovie(candidate.movie.externalId);
      if (inspectionRef.current !== context) return;
      accepted = true; applyMovie(movie); confirmedReturn.current = context.source; setConfirmedMovie(movie); window.location.hash = `/${context.source}`;
    } catch (error) {
      if (inspectionRef.current === context) setInspectionError(error instanceof Error ? error.message : 'Could not add this film. Try again.');
    } finally { if (!accepted) { confirmInFlight.current = false; setConfirming(false); } }
  };

  const onRouteChange = (next:string,previous:string) => {
    const context=inspectionRef.current, nextRoute=resolveRoute(next);
      if (context && next !== context.target) { inspectionRef.current = null; setInspection(null); setInspectionError(''); if (next !== context.source) setConfirmedMovie(null); }
      if (!context && previous === 'seen' && nextRoute.kind === 'movie') {
        const context: Inspection = {source:'seen',target:next,candidate:{kind:'local',movie:{id:nextRoute.id,title:'',year:null,tmdbId:null,poster:null}}};
        inspectionRef.current = context; setInspection(context);
      }
      const acceptedReturn = confirmedReturn.current === next;
      if (confirmedReturn.current) { confirmInFlight.current = false; setConfirming(false); }
      confirmedReturn.current = null;
    return {focusHeading:!acceptedReturn,preserveEventPrefill:next === 'event' || next === context?.target};
  };
  const reset = useCallback(() => {
    confirmedReturn.current=null; inspectionRef.current=null; setInspection(null); setConfirmedMovie(null);
  },[]);
  return {inspection,confirmedMovie,consumeConfirmedMovie,inspectionError,confirming,inspect,confirmFilm,onRouteChange,reset};
}
