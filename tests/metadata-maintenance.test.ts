import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { MetricsScreen } from '../frontend/MetricsScreen';
import { Action } from '../frontend/components';
import { api } from '../frontend/api';
import { maintainMetadata } from '../frontend/metadata-maintenance';
import type { Catalog, MetadataEnrichment, Viewer } from '../shared/types';

// Exercise the actual screen handlers with deterministic hook state and no browser.
const hooks = vi.hoisted(() => ({values: [] as unknown[], cursor: 0, cleanup: undefined as (() => void) | undefined}));
vi.mock('react', async importOriginal => ({...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = {current: initial};
    return hooks.values[index];
  },
  useEffect: (effect: () => () => void) => { hooks.cleanup ??= effect(); },
}));
vi.mock('../frontend/api', () => ({api: {enrichMetadata: vi.fn()}}));
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise,resolve};
}
const catalog: Catalog = {members:[],sessions:[],cycles:[],movies:[{
  id:'fixture',title:'Fixture',original_title:null,year:null,release_date:null,runtime:null,overview:null,
  genres:[],assets:[],external_ids:[{provider:'tmdb',external_id:'1'}],scores:[],seen:[],classic:false,ranking:null,
}]};
const viewer: Viewer = {id:'admin',display_name:'Admin',avatar:0,role:'admin',sort_order:1};
const response = (remaining: number, count = 10): MetadataEnrichment => ({remaining,unidentified:0,
  results:Array.from({length:count},(_,i) => ({movieId:`${remaining}:${i}`,title:'Fixture',provider:'tmdb',status:'success',message:'Updated.'}))});
function actions(node: ReactNode): {children: string; disabled?: boolean; onClick: () => void}[] {
  if (Array.isArray(node)) return node.flatMap(actions);
  if (!isValidElement<{children?: ReactNode}>(node)) return [];
  if (node.type === Action) return [node.props as {children: string; onClick: () => void}];
  return actions(node.props.children);
}
function screen(onUpdated: () => Promise<void>, role: Viewer['role'] = 'admin') {
  hooks.cursor = 0;
  return actions(MetricsScreen({catalog,viewer:{...viewer,role},onUpdated}));
}
beforeEach(() => { hooks.values=[]; hooks.cursor=0; hooks.cleanup=undefined; vi.clearAllMocks(); });

describe('Fill missing metadata action', () => {
  it('exposes one fill action for admins and none for members', () => {
    const controls=screen(async()=>{});
    expect(controls.map(a=>a.children)).toEqual(['Fill missing metadata']);
    expect(controls[0].disabled).toBe(false);
    expect(screen(async()=>{},'member')).toEqual([]);
  });
  it('continues after ten successes and refreshes before every next batch despite a stale catalogue', async () => {
    const request=vi.mocked(api.enrichMetadata);
    let refreshed=0;
    request.mockImplementation(async () => {
      expect(refreshed).toBe(request.mock.calls.length-1);
      return response([20,10,0][request.mock.calls.length-1]);
    });
    const done=deferred<void>();
    const refresh=vi.fn(async()=>{ refreshed++; if(refreshed===3) done.resolve(); });
    screen(refresh)[0].onClick();
    await done.promise;
    expect(request).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenCalledTimes(3);
    // This unchanged catalogue has only one candidate; responses are authoritative.
    expect(catalog.movies).toHaveLength(1);
    expect(hooks.values[3]).toMatchObject({processed:30,updated:30,remaining:0});
  });
  it('Stop during an in-flight batch saves/refreshes it and prevents another request', async () => {
    const pending=deferred<MetadataEnrichment>();
    vi.mocked(api.enrichMetadata).mockReturnValue(pending.promise);
    const refresh=vi.fn(async()=>{});
    screen(refresh)[0].onClick();
    const controls=screen(refresh);
    expect(controls.find(a=>a.children==='Fill missing metadata')?.disabled).toBe(true);
    controls.find(a=>a.children==='Stop after this batch')!.onClick();
    pending.resolve(response(20));
    await vi.waitFor(()=>expect(hooks.values[1]).toBe(false));
    expect(api.enrichMetadata).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(hooks.values[3]).toMatchObject({updated:10,remaining:20,message:expect.stringContaining('Stopped.')});
  });
  it('unmount during a batch prevents subsequent requests', async () => {
    const pending=deferred<MetadataEnrichment>();
    vi.mocked(api.enrichMetadata).mockReturnValue(pending.promise);
    screen(async()=>{})[0].onClick(); hooks.cleanup!(); pending.resolve(response(20));
    await vi.waitFor(()=>expect(hooks.values[1]).toBe(false));
    expect(api.enrichMetadata).toHaveBeenCalledTimes(1);
  });
  it('stops immediately on an empty first batch with work remaining', async () => {
    const request=vi.fn().mockResolvedValue(response(20,0));
    const result=await maintainMetadata({initial:{remaining:1,unidentified:0},batch:request,progress:async()=>{},stopped:()=>false});
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.message).toContain('no progress');
  });
});
