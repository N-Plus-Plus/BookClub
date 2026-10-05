import { useEffect, useId, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import type { Viewer } from '../shared/types';
import { ClubIdentity } from './ClubIdentity';

export function AccountMenu({viewer,busy,onLogout}: {viewer: Viewer; busy: boolean; onLogout: () => void}) {
  const [open,setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dropdownId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',escape); };
  },[open]);
  return <div ref={container} className={`account-menu select ${open ? 'is-open' : ''}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="account-menu-trigger" aria-label={`${viewer.display_name} account`} aria-expanded={open} aria-controls={dropdownId} onClick={() => setOpen(value => !value)}>
      <ClubIdentity identity={{kind: 'member',member: viewer}} />
    </button>
    {open && <div id={dropdownId} className="select__menu account-menu-dropdown">
      <button type="button" className="select__option" disabled={busy} onClick={() => { setOpen(false); trigger.current?.focus(); onLogout(); }}><LogOut size={18} aria-hidden="true" />Logout</button>
    </div>}
  </div>;
}
