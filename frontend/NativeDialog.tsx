import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Action } from './components';
export function NativeDialog({heading,id,onClose,busy=false,className='',closeLabel='Close confirmation',autoFocus=false,children}: {
  heading:string;id:string;onClose:()=>void;busy?:boolean;className?:string;closeLabel?:string;autoFocus?:boolean;children:ReactNode;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current!, previous=document.activeElement;
    element.showModal();
    return ()=>{element.close();if (previous instanceof HTMLElement && previous.isConnected) previous.focus();};
  },[]);
  const close=()=>{if (!busy) onClose();};
  return <dialog ref={dialog} className={`builder-set-picker${className ? ` ${className}` : ''}`} aria-labelledby={id}
    onCancel={event=>{event.preventDefault();close();}}><div className="stack">
    <div className="section-title"><h2 id={id}>{heading}</h2><Action icon={X} autoFocus={autoFocus} aria-label={closeLabel} disabled={busy} onClick={close}/></div>
    {children}</div></dialog>;
}
