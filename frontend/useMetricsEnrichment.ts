import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MetricsEnrichment } from '../shared/metrics-enrichment';
import { api } from './api';
import { MetricsEnrichmentResource } from './metrics-cache';
const noData: MetricsEnrichment = {movies:{}};
export function useMetricsEnrichment(shared?: MetricsEnrichmentResource) {
  const local = useRef<MetricsEnrichmentResource | null>(null);
  local.current ??= new MetricsEnrichmentResource();
  const resource=shared ?? local.current;
  const revision=useSyncExternalStore(resource.subscribe,resource.version,resource.version);
  const [state,setState]=useState<{resource:MetricsEnrichmentResource;data:MetricsEnrichment;status:'loading'|'ready'|'error'}>(()=>({resource,data:resource.peek() ?? noData,status:resource.peek() ? 'ready' : 'loading'}));
  useEffect(() => {
    let active = true;
    setState({resource,data:resource.peek() ?? noData,status:resource.peek() ? 'ready' : 'loading'});
    void resource.load(()=>api.metricsEnrichment()).then(result => {if(active && revision === resource.version())setState({resource,data:result,status:'ready'});},()=>{if(active && revision === resource.version())setState(previous=>({...previous,status:'error'}));});
    return () => {active = false;};
  },[revision,resource]);
  return {data:state.resource === resource ? state.data : noData,status:state.resource === resource ? state.status : 'loading',retry:()=>resource.invalidate()};
}
