import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
const Context=createContext<{busy:boolean;acquire:()=>boolean;release:()=>void}>({busy:false,acquire:()=>true,release:()=>{}});
/** Synchronous acquisition prevents two clicks before React disables the buttons. */
export function BulkMaintenanceLock({children}: {children: ReactNode}) {
  const active=useRef(false), [busy,setBusy]=useState(false);
  return <Context.Provider value={{busy,acquire:()=>{if (active.current) return false; active.current=true;setBusy(true);return true;},release:()=>{active.current=false;setBusy(false);}}}>{children}</Context.Provider>;
}
export const useBulkMaintenanceLock=()=>useContext(Context);

/** Shared lifecycle only; batches, aggregation and checkpoints remain domain-owned. */
export function useBulkJobController() {
  const lock=useBulkMaintenanceLock(), active=useRef(false), stop=useRef(false);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [stopRequested,setStopRequested]=useState(false);
  useEffect(()=>()=>{stop.current=true;},[]);
  const requestStop=()=>{stop.current=true;setStopRequested(true);};
  const execute=async(work:()=>Promise<void>)=>{
    if (active.current || !lock.acquire()) return;
    active.current=true;stop.current=false;setStopRequested(false);setBusy(true);setError('');
    try {await work();}
    catch (error) {setError(error instanceof Error ? error.message : 'Maintenance failed. Completed updates are saved.');}
    finally {active.current=false;setBusy(false);lock.release();}
  };
  return {busy,error,setError,stop,stopRequested,requestStop,execute,locked:lock.busy};
}
export function MaintenanceProgress({processed,total,label,className,summary,beforeProgress,children}: {
  processed:number;total:number;label:string;className?:string;summary:ReactNode;beforeProgress?:ReactNode;children?:ReactNode;
}) {
  return <div className="stack" role="status"><p className="meta">{summary}</p>{beforeProgress}
    <progress className={className} max={Math.max(1,total)} value={processed} aria-label={label}/>{children}</div>;
}
