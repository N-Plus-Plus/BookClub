export interface MaintenanceCheckpoint { version: 1; remainingIds: string[]; completed: number }
type StorageAccess = Pick<Storage,'getItem' | 'setItem' | 'removeItem'>;
const browserStorage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
export function saveMaintenanceCheckpoint(key: string,checkpoint: MaintenanceCheckpoint | null,storage: StorageAccess | undefined = browserStorage()) {
  try {
    if (checkpoint?.remainingIds.length) storage?.setItem(key,JSON.stringify(checkpoint));
    else storage?.removeItem(key);
  } catch { /* Storage denial must not interrupt maintenance. */ }
}
export function loadMaintenanceCheckpoint(key: string,storage: StorageAccess | undefined = browserStorage()): MaintenanceCheckpoint | null {
  try {
    const raw=storage?.getItem(key); if (!raw) return null;
    const value=JSON.parse(raw);
    if (value?.version!==1 || !Array.isArray(value.remainingIds) || !value.remainingIds.length || value.remainingIds.length>100000
      || !value.remainingIds.every((id: unknown)=>typeof id==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(id))
      || new Set(value.remainingIds).size!==value.remainingIds.length || !Number.isSafeInteger(value.completed) || value.completed<0 || value.completed>100000
      || Object.keys(value).some(key=>!['version','remainingIds','completed'].includes(key))) {
      saveMaintenanceCheckpoint(key,null,storage); return null;
    }
    return {version:1,remainingIds:value.remainingIds,completed:value.completed};
  } catch { saveMaintenanceCheckpoint(key,null,storage); return null; }
}
