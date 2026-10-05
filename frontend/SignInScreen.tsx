import { useEffect, useRef, useState } from 'react';
import { Clapperboard, RefreshCw } from 'lucide-react';
import { Action } from './components';

interface GoogleId {
  initialize(options: {client_id: string; callback: (result: {credential: string}) => void; auto_select: boolean}): void;
  renderButton(element: HTMLElement,options: {theme: string; size: string; width: number}): void;
  disableAutoSelect(): void;
}
declare global { interface Window { google?: {accounts: {id: GoogleId}} } }
let scriptReady: Promise<void> | undefined;
function loadGoogle() {
  if (window.google) return Promise.resolve();
  if (!scriptReady) scriptReady = new Promise<void>((resolve,reject) => {
    const script = document.createElement('script');
    // Fixed official GIS URL only; no user-controlled script or HTML execution.
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    const failed = () => { clearTimeout(timeout); script.remove(); scriptReady = undefined; reject(new Error('Google sign-in could not load. Check your connection and retry.')); };
    const timeout = setTimeout(failed,15000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = failed;
    document.head.appendChild(script);
  });
  return scriptReady;
}
export function SignInScreen({configured,error,busy,onCredential,onLocalLogin,onRetry}: {configured: boolean; error: string; busy: boolean; onCredential: (credential: string) => Promise<void>; onLocalLogin?: () => Promise<void>; onRetry: () => void}) {
  const button = useRef<HTMLDivElement>(null), callback = useRef(onCredential);
  callback.current = onCredential;
  const [scriptError,setScriptError] = useState(''), [retry,setRetry] = useState(0);
  const localLogin = import.meta.env.DEV && Boolean(onLocalLogin);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  useEffect(() => {
    if (localLogin || !configured || !clientId) return;
    let active = true; setScriptError('');
    void loadGoogle().then(() => {
      if (!active || !button.current || !window.google) return;
      window.google.accounts.id.initialize({client_id: clientId,auto_select: false,callback: result => { if (active) void callback.current(result.credential); }});
      window.google.accounts.id.renderButton(button.current,{theme: 'outline',size: 'large',width: button.current.clientWidth});
    }).catch(e => { if (active) setScriptError(e.message); });
    return () => { active = false; };
  },[localLogin,configured,clientId,retry]);
  return <div className="bookclub-shell"><header className="site-header"><div className="brand"><Clapperboard aria-hidden="true" /><span>BookClub<small>ONLY BOOBS ALLOWED PASSED THIS POINT</small></span></div></header>
    <main className="sign-in"><section className="card stack"><h1>Don't forget the bins.</h1><p>Sign in to view our shared film history, and sweet beautiful metrics.</p>
      {localLogin ? <button type="button" className="button local-sign-in" data-variant="primary" data-intent="constructive" disabled={busy} onClick={() => void onLocalLogin?.()}>Log in as Troy</button> : !configured || !clientId ? <p role="alert">Google sign-in is not configured. Contact the club administrator.</p> : <div className="google-sign-in" ref={button} aria-busy={busy} inert={busy} />}
      {busy && <p role="status">Signing in…</p>}{(error || scriptError) && <p className="error-message" role="alert">{error || scriptError}</p>}
      {scriptError && <Action icon={RefreshCw} onClick={() => setRetry(n => n+1)}>Retry Google sign-in</Action>}
      {error && <Action icon={RefreshCw} disabled={busy} onClick={onRetry}>Retry BookClub connection</Action>}
    </section></main></div>;
}
