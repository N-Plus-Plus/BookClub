import type { Catalog, MovieDetail } from '../shared/types';
import { ClassicsMaintenance } from './ClassicsMaintenance';
import { MetadataMaintenance } from './MetadataMaintenance';

export function AdminScreen({catalog,writesEnabled,onMovie,onUpdated}: {
  catalog: Catalog; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated: () => Promise<void>;
}) {
  return <div className="stack">
    <ClassicsMaintenance catalog={catalog} writesEnabled={writesEnabled} onMovie={onMovie} onUpdated={onUpdated} />
    <MetadataMaintenance catalog={catalog} onUpdated={onUpdated} />
  </div>;
}
