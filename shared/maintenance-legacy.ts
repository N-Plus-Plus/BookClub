import type { JobOperation } from './maintenance-job';
import type { MaintenanceIntent, MaintenanceUnit } from './maintenance-plan';
/** Compact, bounded transport; the server validates every scope and identity. */
export interface LegacyMaintenanceImport {
  id:string;intent:MaintenanceIntent;operation:JobOperation;startedAt:string;phase:'films'|'collections';filmOnly:boolean;rosterStartedAt:string|null;
  units:[string,MaintenanceUnit['provider'],'imdb'|'tmdb',string,MaintenanceUnit['operations'],string[]][];
  collections:number[];
}
