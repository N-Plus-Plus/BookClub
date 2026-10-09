import type { CollectionRosterBatch, CollectionRosterStatus } from '../shared/collection-roster';
export interface RosterCheckpoint {version:1;intent:'populate'|'refresh';startedAt:string;pending:number[];completed:number;requests:number}
export const rosterKey=(intent:RosterCheckpoint['intent'])=>`bookclub.collection-rosters.${intent}.v1`;
export function saveRosterCheckpoint(value:RosterCheckpoint | null,intent:RosterCheckpoint['intent']){
  try{if(value?.pending.length)localStorage.setItem(rosterKey(intent),JSON.stringify(value));else localStorage.removeItem(rosterKey(intent));}catch{/* Storage denial does not interrupt a check. */}
}
export function loadRosterCheckpoint(intent:RosterCheckpoint['intent']):RosterCheckpoint | null {
  try{
    const value=JSON.parse(localStorage.getItem(rosterKey(intent)) ?? 'null');
    if(!value)return null;
    if(value.version!==1 || value.intent!==intent || !Number.isFinite(Date.parse(value.startedAt)) || !Array.isArray(value.pending) || value.pending.length>100000 || !value.pending.length || value.pending.some((id:unknown)=>typeof id!=='number' || !Number.isSafeInteger(id) || id<=0 || id>2147483647) || new Set(value.pending).size!==value.pending.length || ![value.completed,value.requests].every(n=>Number.isSafeInteger(n)&&n>=0) || Object.keys(value).some(key=>!['version','intent','startedAt','pending','completed','requests'].includes(key)))throw new Error('Invalid checkpoint');
    return value;
  }catch{saveRosterCheckpoint(null,intent);return null;}
}
export function rosterPlan(status:CollectionRosterStatus,intent:RosterCheckpoint['intent']){
  const ids=status.collections.filter(c=>intent==='refresh' || !c.checked_at).map(c=>c.id);
  return {ids,collections:ids.length,batches:ids.length,requests:ids.length};
}
export function reconcileRosterCheckpoint(saved:RosterCheckpoint,status:CollectionRosterStatus):RosterCheckpoint {
  const eligible=new Map(status.collections.map(c=>[c.id,c]));
  const pending=saved.pending.filter(id=>{const c=eligible.get(id);return c && (!c.checked_at || saved.intent==='refresh' && c.checked_at<saved.startedAt);});
  return {...saved,pending,completed:saved.completed+saved.pending.length-pending.length};
}
/** Frozen collection queue, once per ID per run; failures retained for explicit resume. */
export async function runRosterMaintenance(options:{checkpoint:RosterCheckpoint;batch:(id:number,startedAt:string)=>Promise<CollectionRosterBatch>;stopped:()=>boolean;changed:()=>void;progress:(value:RosterCheckpoint,failures:number)=>void;checkpointChanged:(value:RosterCheckpoint)=>void;pause?:()=>Promise<void>}) {
  let current={...options.checkpoint,pending:[...options.checkpoint.pending]},failures=0;
  options.checkpointChanged(current);
  for(const id of [...current.pending]){
    if(options.stopped())break;
    const response=await options.batch(id,current.startedAt);
    if(!response || !Array.isArray(response.results) || response.results.length!==1 || response.results[0].id!==id || !['checked','skipped','failed'].includes(response.results[0].status) || !Number.isSafeInteger(response.requests) || response.requests<0 || response.requests>1)throw new Error('Incomplete collection response. Saved checks will be reconciled on resume.');
    if(response.cacheChanged)options.changed();
    const accepted=response.results[0].status!=='failed';if(!accepted)failures++;
    current={...current,requests:current.requests+response.requests,pending:accepted?current.pending.filter(n=>n!==id):current.pending,completed:current.completed+Number(accepted)};
    options.checkpointChanged(current);options.progress(current,failures);
    if(response.stopped)throw new Error(response.stopped);
    if(options.stopped())break;
    await (options.pause?.() ?? new Promise(resolve=>setTimeout(resolve,2000)));
  }
  if(failures)throw new Error(`${failures} collection checks failed. Resume to retry remaining collections.`);
  return current;
}
