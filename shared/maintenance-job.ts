import type { MaintenanceIntent, MaintenanceOperation } from './maintenance-plan';
import type { MaintenanceFailureCategory } from './maintenance-failure';
export type JobOperation=MaintenanceOperation|'all'|'collection-rosters';
export type JobState='ready'|'running'|'paused'|'awaiting_cooldown'|'completed'|'completed_with_issues'|'failed'|'cancelled';
export interface MaintenanceJob {
  id:string;intent:MaintenanceIntent;operation:JobOperation;started_at:string;phase:'films'|'collections';state:JobState;
  created_at:string;updated_at:string;requests:number;diagnostic:string|null;
  provider?:string|null;
  counts:Record<'pending'|'running'|'successful'|'skipped'|'deferred'|'blocked'|'updated'|'no_change',number>;
  lease:{active:boolean;owner:string|null;expiresAt:number};
  issues:{key:string;movieId:string|null;collectionId:number|null;provider:string;operations:string[];category:MaintenanceFailureCategory|null;message:string|null;attempts:number;retryAt:string|null}[];
  issuesNext:string|null;
}
