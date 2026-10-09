/** Safe diagnostics only: never include raw errors, provider payloads or credential URLs. */
export type MaintenanceFailureCategory = 'record' | 'transient' | 'provider' | 'systemic' | 'ambiguous';
export interface MaintenanceFailure {
  category: MaintenanceFailureCategory;
  message: string;
  retryAfter?: number;
}
