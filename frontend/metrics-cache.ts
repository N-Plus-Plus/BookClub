import { useRef } from 'react';
import type { MetricsEnrichment } from '../shared/metrics-enrichment';

/** One authenticated App lifetime; no storage, polling or cross-account cache. */
export class MetricsEnrichmentResource {
  private pending: Promise<MetricsEnrichment> | null = null;
  private data: MetricsEnrichment | null = null;
  private revision = 0;
  private listeners = new Set<()=>void>();
  version = () => this.revision;
  subscribe = (listener:()=>void) => {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  peek() { return this.data; }
  load(read: () => Promise<MetricsEnrichment>) {
    if (!this.pending) {
      const pending=read().then(async result=>{
        // Preparation stays behind the Metrics boundary; the read still starts immediately.
        const {prepareMetricsEnrichment}=await import('../shared/metrics-enrichment');
        const data=prepareMetricsEnrichment(result);
        if(this.pending === pending)this.data=data;
        return data;
      });
      this.pending=pending;
    }
    return this.pending;
  }
  invalidate() { this.pending = null;this.data=null;this.revision++;for(const listener of this.listeners)listener(); }
}

/** Retain visited reports without mounting hidden panels; discard on snapshot changes. */
export function useMetricsReports(dependencies: readonly unknown[]) {
  const state = useRef<{dependencies:readonly unknown[];values:Map<string,unknown>} | null>(null);
  if (!state.current || dependencies.some((value,index) => value !== state.current!.dependencies[index])) {
    state.current = {dependencies,values:new Map()};
  }
  const values=state.current.values;
  return <T,>(key:string,calculate:()=>T):T => {
    if (!values.has(key)) values.set(key,calculate());
    return values.get(key) as T;
  };
}
