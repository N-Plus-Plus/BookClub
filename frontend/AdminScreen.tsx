import type { Catalog, MovieDetail, Rotation } from '../shared/types';
import { RotationSwapCard } from './RotationSwapCard';
import { ClassicsMaintenance } from './ClassicsMaintenance';
import { MetadataMaintenance } from './MetadataMaintenance';
import { EnrichmentMaintenance } from './EnrichmentMaintenance';
import { BulkMaintenanceLock } from './bulk-maintenance';

export function AdminScreen({catalog,rotation = null,onRotationUpdated = () => {},writesEnabled,onMovie,onUpdated,onEnrichmentChanged}: {
  onEnrichmentChanged?:()=>void; catalog: Catalog; rotation?: Rotation | null; onRotationUpdated?: (rotation: Rotation | null) => void; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated: () => Promise<void>;
}) {
  return <BulkMaintenanceLock><div className="stack admin-screen">
    <RotationSwapCard catalog={catalog} rotation={rotation} writesEnabled={writesEnabled} onUpdated={onRotationUpdated} />
    <ClassicsMaintenance catalog={catalog} writesEnabled={writesEnabled} onMovie={onMovie} onUpdated={onUpdated} />
    <MetadataMaintenance catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} />
    <EnrichmentMaintenance onCacheChanged={onEnrichmentChanged} provider="tmdb" catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} />
    <EnrichmentMaintenance onCacheChanged={onEnrichmentChanged} provider="mdblist" catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} />
  </div></BulkMaintenanceLock>;
}
