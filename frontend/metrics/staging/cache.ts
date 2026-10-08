import { useMetricsReports } from '../../metrics-cache';
/** The owning Metrics panel retains this optional map across tab unmounts, and replaces it on snapshot changes. */
export function useStagingReports(dependencies:readonly unknown[],retained:Map<string,unknown>|undefined,namespace:string) {
  const local=useMetricsReports(dependencies);
  return <T,>(key:string,calculate:()=>T):T=>{
    if(!retained)return local(key,calculate);
    const identity=`${namespace}:${key}`;
    if(!retained.has(identity))retained.set(identity,calculate());
    return retained.get(identity) as T;
  };
}
