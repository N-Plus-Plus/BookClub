import type { Catalog } from '../shared/types';
import { maintenanceOperations, type MaintenanceCoverage } from '../shared/maintenance-plan';
import { api } from './api';
import { DurableMaintenanceControl } from './DurableMaintenanceControl';

export async function readMaintenanceCoverage():Promise<MaintenanceCoverage> {
  let after:string | null=null;
  const coverage:MaintenanceCoverage={checks:[],negativeScores:[],enrichment:[],evidence:[],unavailable:{tmdb:null,omdb:null,mdblist:null}},seen=new Set<string>();
  do {
    const page=await api.maintenanceCoverage(after);
    if(!page || !Array.isArray(page.checks) || !Array.isArray(page.enrichment) || !Array.isArray(page.negativeScores) || !page.unavailable || !Array.isArray(page.evidence) || page.evidenceSupported!==true || page.fieldsSupported!==true || !Array.isArray(page.fields)) throw new Error('Maintenance coverage is unavailable. Install migration 0023 and update the API Worker before using these controls.');
    coverage.scoreEligibleIds=[...(coverage.scoreEligibleIds ?? []),...(page.scoreEligibleIds ?? [])];coverage.evidenceSupported=page.evidenceSupported;coverage.evidence!.push(...(page.evidence ?? []));
    if(page.fields){coverage.fields ??= [];coverage.fields.push(...page.fields);}coverage.fieldsSupported=page.fieldsSupported;
    coverage.failures=[...(coverage.failures ?? []),...(page.failures ?? [])];coverage.checks.push(...page.checks);coverage.enrichment.push(...page.enrichment);coverage.negativeScores.push(...page.negativeScores);coverage.unavailable=page.unavailable;
    after=page.next;
    if(after && seen.has(after)) throw new Error('Maintenance coverage returned a repeated page. Reload before starting.');
    if(after) seen.add(after);
  } while(after);
  return coverage;
}

export function UnifiedMaintenance({writesEnabled,onUpdated,onEnrichmentChanged}:{catalog:Catalog;writesEnabled:boolean;onUpdated:()=>Promise<void>;onEnrichmentChanged?:()=>void}) {
  return <>{(['populate','refresh'] as const).map(intent=><section className="stack maintenance-section" key={intent} aria-labelledby={`${intent}-data-heading`}><div className="section-title"><h2 id={`${intent}-data-heading`}>{intent==='populate'?'Populate missing data':'Refresh all data'}</h2></div>{(['all',...maintenanceOperations] as const).map(operation=><DurableMaintenanceControl key={operation} intent={intent} operation={operation} writesEnabled={writesEnabled} onUpdated={onUpdated} onEnrichmentChanged={onEnrichmentChanged}/>)}</section>)}</>;
}
