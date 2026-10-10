import type { Catalog } from '../shared/types';
import { maintenanceOperations } from '../shared/maintenance-plan';
import { DurableMaintenanceControl } from './DurableMaintenanceControl';

export function UnifiedMaintenance({writesEnabled,onUpdated,onEnrichmentChanged}:{catalog:Catalog;writesEnabled:boolean;onUpdated:()=>Promise<void>;onEnrichmentChanged?:()=>void}) {
  return <>{(['populate','refresh'] as const).map(intent=><section className="stack maintenance-section" key={intent} aria-labelledby={`${intent}-data-heading`}><div className="section-title"><h2 id={`${intent}-data-heading`}>{intent==='populate'?'Populate missing data':'Refresh all data'}</h2></div>{(['all',...maintenanceOperations] as const).map(operation=><DurableMaintenanceControl key={operation} intent={intent} operation={operation} writesEnabled={writesEnabled} onUpdated={onUpdated} onEnrichmentChanged={onEnrichmentChanged}/>)}</section>)}</>;
}
