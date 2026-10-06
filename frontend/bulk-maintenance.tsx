import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
const Context=createContext<{busy:boolean;acquire:()=>boolean;release:()=>void}>({busy:false,acquire:()=>true,release:()=>{}});
/** Synchronous acquisition prevents two clicks before React disables the buttons. */
export function BulkMaintenanceLock({children}: {children: ReactNode}) {
  const active=useRef(false), [busy,setBusy]=useState(false);
  return <Context.Provider value={{busy,acquire:()=>{if (active.current) return false; active.current=true;setBusy(true);return true;},release:()=>{active.current=false;setBusy(false);}}}>{children}</Context.Provider>;
}
export const useBulkMaintenanceLock=()=>useContext(Context);
