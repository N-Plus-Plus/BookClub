import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Action } from './components';
import type { Member } from '../shared/types';
import { setDevMember } from './api';

export default function DevTools({members,onChanged}: {members: Member[];onChanged: () => Promise<void>}) {
  const [confirm,setConfirm] = useState(false), [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  async function refresh() {
    setBusy(true); setConfirm(false); setMessage('Starting refresh…');
    try {
      const response = await fetch('/__dev/refresh',{method:'POST',headers:{'X-BookClub-Confirm':'replace-local-only'}});
      if (!response.ok) throw new Error('Refresh helper unavailable or busy. Start pnpm dev:api and retry.');
      while (true) {
        await new Promise(done => setTimeout(done,1000));
        const poll = await fetch('/__dev/refresh');
        if (!poll.ok) throw new Error('Lost refresh status. Check the local API terminal before retrying.');
        const status = await poll.json() as {phase:string;message:string;result:{snapshotTime:string}}; setMessage(status.message);
        if (status.phase === 'error') throw new Error(status.message);
        if (status.phase === 'idle') throw new Error('The local helper restarted during refresh. Check the API terminal and local database before retrying.');
        if (status.phase === 'success') {setMessage(`Local database refreshed · snapshot ${new Date(status.result.snapshotTime).toLocaleString('en-AU')}`); await onChanged(); break;}
      }
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Refresh failed.');}
    finally {setBusy(false);}
  }
  return <details className="developer-tools utility-disclosure"><summary>Local development tools</summary><div className="stack">
    <label className="input-label">Develop as member<select className="field__input" disabled={busy} defaultValue={localStorage.getItem('bookclub.dev-member') ?? ''} onChange={event => {setDevMember(event.target.value); void onChanged();}}><option value="">Anonymous local bypass</option>{members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
    <p>Replace disposable LOCAL data with current production state. Production will not be modified. Private Builder plans are copied; sessions and Google identities are cleared.</p>
    {confirm ? <><p>Discard current local edits and replace the local database?</p><Action className="action-wrap" icon={RefreshCw} intent="destructive" onClick={() => void refresh()}>Confirm local replacement</Action><Action className="action-wrap" icon={X} onClick={() => setConfirm(false)}>Cancel</Action></> : <Action className="action-wrap" icon={RefreshCw} disabled={busy} onClick={() => setConfirm(true)}>Refresh Dev DB from Production</Action>}
    {message && <p role="status">{message}</p>}
  </div></details>;
}
