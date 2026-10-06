import type { Catalog, MovieDetail } from '../shared/types';
import { ClassicsMaintenance } from './ClassicsMaintenance';
import { MetadataMaintenance } from './MetadataMaintenance';
import { EnrichmentMaintenance } from './EnrichmentMaintenance';
import { BulkMaintenanceLock } from './bulk-maintenance';

export function AdminScreen({catalog,writesEnabled,onMovie,onUpdated}: {
  catalog: Catalog; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated: () => Promise<void>;
}) {
  return <BulkMaintenanceLock><div className="stack">
    <ClassicsMaintenance catalog={catalog} writesEnabled={writesEnabled} onMovie={onMovie} onUpdated={onUpdated} />
    <MetadataMaintenance catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} />
    <EnrichmentMaintenance provider="tmdb" catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} />
    <EnrichmentMaintenance provider="mdblist" catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} />
  </div></BulkMaintenanceLock>;
}
