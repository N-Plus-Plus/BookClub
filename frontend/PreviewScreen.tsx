import { useEffect, useState } from 'react';
import type { TmdbPreview } from '../shared/types';
import { api } from './api';
import { Failure, LoadingView } from './components';
import { FilmIdentity } from './FilmIdentity';

export function PreviewScreen({id,preview,pending}: {id: string; preview?: TmdbPreview; pending?: Promise<TmdbPreview>}) {
  const [movie,setMovie] = useState(preview);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    if (preview) return;
    let active = true; setError('');
    void (retry === 0 && pending ? pending : api.preview(id)).then(result => { if (active) setMovie(result); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load film preview.'); });
    return () => { active = false; };
  },[id,preview,pending,retry]);
  return movie ? <div className="stack"><FilmIdentity movie={movie} /></div> : error ? <Failure message={error} retry={() => setRetry(value => value+1)} /> : <LoadingView label="Loading film details…" />;
}
