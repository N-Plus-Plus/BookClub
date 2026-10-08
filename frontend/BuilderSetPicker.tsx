import { formatCount } from '../shared/format';
import { NativeDialog } from './NativeDialog';
import { catalogIndex } from '../shared/catalog-index';
import { useEffect, useState } from 'react';
import { ListChecks, RefreshCw, X } from 'lucide-react';
import type { BuilderSet, Catalog, Viewer } from '../shared/types';
import { api } from './api';
import { Action } from './components';

export function BuilderSetPicker({catalog,viewer,onClose,onChoose}: {catalog: Catalog; viewer: Viewer; onClose: () => void; onChoose: (movieIds: string[]) => void}) {
  const [sets,setSets] = useState<BuilderSet[]>([]);
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void api.builders().then(result => { if (active) setSets(result.filter(set => set.owner_member_id === viewer.id)); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load your Builder sets.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[viewer.id,attempt]);
  const close = onClose;
  const choices = sets.map(set => ({set,films: set.movie_ids.map(id => catalogIndex(catalog).movieById.get(id))}));
  const usable = choices.length > 0;
  return <NativeDialog heading="Use from Builder" id="builder-picker-heading" closeLabel="Close Builder set picker" onClose={onClose} autoFocus>

      {loading ? <p role="status">Loading your sets…</p> : error ? <div className="stack"><p className="error-message" role="alert">{error}</p><Action icon={RefreshCw} onClick={() => setAttempt(value => value + 1)}>Try again</Action></div> : !usable ? <p className="meta">No saved Builder sets with available films. Add films in Builder first.</p> : <ul className="builder-set-choices">{choices.map(({set,films}) => <li className="stack" key={set.id}>
        <h3>{set.title?.trim() || 'Untitled set'}</h3><p className="meta">{formatCount(set.movie_ids.length)} {set.movie_ids.length === 1 ? 'film' : 'films'}</p>
        {films.length > 0 && <ol>{films.map((movie,index) => <li key={`${set.movie_ids[index]}-${index}`}>{movie?.title ?? 'Film unavailable'}</li>)}</ol>}
        {films.some(movie => !movie) && <p className="error-message" role="alert">This set contains unavailable film data.</p>}<Action icon={ListChecks} disabled={!films.length || films.some(movie => !movie)} onClick={() => { if (films.length && films.every(Boolean)) onChoose([...set.movie_ids]); }}>Use this set</Action>
      </li>)}</ul>}
      <div className="button-set"><Action icon={X} variant="tertiary" onClick={close}>Cancel</Action></div>
  </NativeDialog>;
}
