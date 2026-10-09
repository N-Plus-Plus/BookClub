import { DurableMaintenanceControl } from './DurableMaintenanceControl';
export function CollectionRosterMaintenance({writesEnabled,onEnrichmentChanged}:{writesEnabled:boolean;onEnrichmentChanged?:()=>void}){
  return <section className="stack maintenance-section" aria-label="Collection roster maintenance"><h2>Collection membership</h2><p className="meta">TMDB rosters for collections with at least two distinct films in active History. One collection per request; no films are imported.</p>{(['populate','refresh'] as const).map(intent=><DurableMaintenanceControl key={intent} intent={intent} operation="collection-rosters" writesEnabled={writesEnabled} onEnrichmentChanged={onEnrichmentChanged}/>)}</section>;
}
