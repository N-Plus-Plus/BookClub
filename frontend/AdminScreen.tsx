import type { Catalog, MovieDetail, Rotation } from '../shared/types';
import { RotationSwapCard } from './RotationSwapCard';
import { UnifiedMaintenance } from './UnifiedMaintenance';
import { CollectionRosterMaintenance } from './CollectionRosterMaintenance';
import { BulkMaintenanceLock } from './bulk-maintenance';

export function AdminScreen({catalog,rotation = null,onRotationUpdated = () => {},writesEnabled,onUpdated,onEnrichmentChanged}: {
  onEnrichmentChanged?:()=>void; catalog: Catalog; rotation?: Rotation | null; onRotationUpdated?: (rotation: Rotation | null) => void; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated: () => Promise<void>;
}) {
  return <BulkMaintenanceLock><div className="stack admin-screen">
    <RotationSwapCard catalog={catalog} rotation={rotation} writesEnabled={writesEnabled} onUpdated={onRotationUpdated} />
    <UnifiedMaintenance catalog={catalog} writesEnabled={writesEnabled} onUpdated={onUpdated} onEnrichmentChanged={onEnrichmentChanged} />
    <CollectionRosterMaintenance writesEnabled={writesEnabled} onEnrichmentChanged={onEnrichmentChanged}/>
  </div></BulkMaintenanceLock>;
}
