import { NativeDialog } from './NativeDialog';
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Catalog, FilmCandidate, MovieDetail, TmdbPreview } from '../shared/types';
import { api } from './api';
import { Action, Poster } from './components';
import { FilmPicker } from './FilmPicker';
import { catalogIndex } from '../shared/catalog-index';

function eligibility(movie: MovieDetail, catalog: Catalog) {
  if (movie.classic || catalogIndex(catalog).movieById.get(movie.id)?.classic) return 'Already listed!';
  const members = catalog.members.filter(m => m.active);
  if (movie.appearances.length || catalogIndex(catalog).historyMovieIds.has(movie.id) ||
      (members.length > 0 && members.every(member => movie.seen.some(answer => answer.member_id === member.id && answer.seen === 1)))) return "We've seen it!";
  return null;
}

export function AddClassicModal({catalog,onMovie,onClose}: {catalog: Catalog; onMovie: (movie: MovieDetail) => void; onClose: () => void}) {
  const inFlight = useRef(false);
  const [selection,setSelection] = useState<{candidate: FilmCandidate; film: MovieDetail | TmdbPreview} | null>(null);
  const [selecting,setSelecting] = useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const status = selection && 'id' in selection.film ? eligibility(selection.film,catalog) : null;
  const add = async () => {
    if (!selection || status || selecting || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const film = selection.candidate.kind === 'local' ? await api.detail(selection.candidate.movie.id) : await api.importMovie(selection.candidate.movie.externalId);
      const currentStatus = eligibility(film,catalog);
      if (currentStatus) { onMovie(film); setSelection({...selection,film}); return; }
      const saved = await api.classic(film.id,true);
      onMovie(saved); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add Classic. Try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <NativeDialog heading="Add Classic" id="add-classic-heading" closeLabel="Close Add Classic" onClose={onClose} busy={busy} className="add-classic-modal">
      <FilmPicker movieById={catalogIndex(catalog).movieById} historyMovieIds={catalogIndex(catalog).historyMovieIds} selected={[]} onSelected={() => {}} onMovie={() => {}} disabled={busy} onSelectionPending={setSelecting} onCandidateSelected={(candidate,film) => { setSelection({candidate,film}); setError(''); }} />
      {selection && <section className="stack" aria-label="Selected film" aria-live="polite"><div className="movie-row"><Poster movie={selection.film} /><div className="movie-copy"><h3 className="movie-title">{selection.film.title}</h3><p className="meta">{selection.film.year ?? 'Year unknown'} · {selection.film.runtime ? `${selection.film.runtime} min` : 'Runtime unknown'}</p><p className="meta">Director: {selection.film.director ?? 'Unknown'}</p></div></div>
        {selection.film.overview && <p className="detail-overview">{selection.film.overview}</p>}
        {status ? <p className="classic-eligibility" role="status">{status}</p> : <Action icon={Plus} variant="primary" disabled={busy || selecting} onClick={() => void add()}>{busy ? 'Adding…' : 'Add Classic'}</Action>}
      </section>}
      {error && <p className="error-message" role="alert">{error}</p>}
  </NativeDialog>;
}
