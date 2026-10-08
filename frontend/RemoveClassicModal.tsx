import { NativeDialog } from './NativeDialog';
import { useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Movie, MovieDetail } from '../shared/types';
import { api } from './api';
import { Action, Poster } from './components';
export function RemoveClassicModal({movie,onMovie,onClose}: {movie: Movie; onMovie: (movie: MovieDetail) => void; onClose: () => void}) {
  const inFlight = useRef(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { onMovie(await api.removeClassic(movie.id)); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove Classic. Try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const r = movie.ranking!;
  return <NativeDialog heading="Remove from Classics" id="remove-classic-heading" closeLabel="Close confirmation" onClose={onClose} busy={busy}>

    <div className="movie-row"><Poster movie={movie} /><div className="movie-copy"><h3 className="movie-title">{movie.title}</h3><p className="meta">{movie.year ?? 'Year unknown'}</p><p className="meta">{r.seenCount} Seen · {r.unseenCount} No · {r.unknownCount} Unknown</p></div></div>
    <p>Remove this film from Classics and clear its Seen / Not Seen answers. Active History appearances still prove Seen by everyone.</p>
    <p className="meta">The film, scores, metadata, external IDs, artwork and History remain.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="button-set"><Action icon={X} disabled={busy} onClick={onClose}>Cancel</Action><Action icon={Trash2} variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Removing…' : 'Remove from Classics'}</Action></div>
  </NativeDialog>;
}
