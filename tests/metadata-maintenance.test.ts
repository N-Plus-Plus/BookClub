import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { MetadataMaintenance } from '../frontend/MetadataMaintenance';
import { Action } from '../frontend/components';
import { api } from '../frontend/api';
import { metadataQueue, metadataCandidate, metadataGaps } from '../shared/metadata';
import { maintainMetadata } from '../frontend/metadata-maintenance';
import type { Catalog, SelectedMetadataEnrichment } from '../shared/types';

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
vi.mock('../frontend/api', () => ({api: {enrichMetadataSelected: vi.fn()}}));
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise,resolve};
}
const catalog: Catalog = {members:[],sessions:[],cycles:[],movies:[{
  id:'fixture',title:'Fixture',original_title:null,year:null,release_date:null,runtime:null,overview:null,
  genres:[],assets:[],external_ids:[{provider:'tmdb',external_id:'1'}],scores:[],seen:[],classic:false,ranking:null,
}]};
const response = (ids: string[]): SelectedMetadataEnrichment => ({results:ids.map(movieId => ({movieId,title:'Fixture',provider:'tmdb',status:'success',message:'Updated.'}))});
function actions(node: ReactNode): {children: string; disabled?: boolean; onClick: () => void}[] {
  if (Array.isArray(node)) return node.flatMap(actions);
  if (!isValidElement<{children?: ReactNode}>(node)) return [];
  if (node.type === Action) return [node.props as {children: string; onClick: () => void}];
  return actions(node.props.children);
}
function screen(onUpdated: () => Promise<void>, data = catalog) {
  hooks.cursor = 0;
  return actions(MetadataMaintenance({catalog:data,onUpdated}));
}
beforeEach(() => { hooks.values=[]; hooks.cursor=0; hooks.cleanup=undefined; vi.resetAllMocks(); });


describe('fixed TMDB metadata queue', () => {
  it('selects once in gap priority and ID order using shared eligibility', () => {
    const movies = Array.from({length:6},(_,i)=>({...catalog.movies[0],id:String(6-i),genres:i%2 ? ['Drama'] : [],director:i===5 ? 'Director' : null,tmdb_metadata_checked_at:i===5 ? new Date().toISOString() : null,tmdb_artwork_checked_at:new Date().toISOString()}));
    const before = movies.map(m=>m.id);
    expect(metadataQueue(movies)).toEqual(movies.filter(metadataCandidate).sort((a,b)=>metadataGaps(b)-metadataGaps(a)||a.id.localeCompare(b.id)).map(m=>m.id));
    expect(metadataQueue(movies)).toEqual(['2','4','6','3','5']);
    expect(movies.map(m=>m.id)).toEqual(before);
  });
  it('freezes a 980-film queue once, sequences 490 pairs and retains bounded progress', async () => {
    vi.useFakeTimers();
    try {
      const movies = Array.from({length:980},(_,i)=>({...catalog.movies[0],id:`film-${String(i).padStart(4,'0')}`}));
      const select = vi.fn(metadataQueue), ids = select(movies);
      const batch = vi.fn(async(selected:string[])=>response(selected));
      const progress = vi.fn(async(run: Awaited<ReturnType<typeof maintainMetadata>>)=>{expect(run).not.toHaveProperty('results');});
      const pending = maintainMetadata({ids,unidentified:7,batch,progress,stopped:()=>false});
      ids.reverse(); movies.length=0;
      await vi.runAllTimersAsync();
      expect(await pending).toMatchObject({total:980,processed:980,updated:980,remaining:0,unidentified:7});
      expect(select).toHaveBeenCalledOnce(); expect(batch).toHaveBeenCalledTimes(490);
      expect(batch.mock.calls.flatMap(([ids])=>ids)).toEqual(Array.from({length:980},(_,i)=>`film-${String(i).padStart(4,'0')}`));
      expect(batch.mock.calls.every(([ids])=>ids.length===2)).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
describe('Fill missing metadata action', () => {
  const data = {...catalog,movies:Array.from({length:5},(_,i)=>({...catalog.movies[0],id:`f${i}`}))};
  it('refreshes once after completion and displays refreshed eligibility rather than run counts', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.enrichMetadataSelected).mockImplementation(async ids=>response(ids));
      const refresh=vi.fn(async()=>{});
      screen(refresh,data)[0].onClick(); await vi.runAllTimersAsync();
      expect(api.enrichMetadataSelected).toHaveBeenCalledTimes(3); expect(refresh).toHaveBeenCalledOnce();
      expect(hooks.values[2]).toMatchObject({total:5,processed:5,remaining:0,updated:5});
      hooks.cursor=0;
      const refreshed={...catalog,movies:[{...catalog.movies[0],director:'Director',tmdb_metadata_checked_at:new Date().toISOString(),tmdb_artwork_checked_at:new Date().toISOString()},{...catalog.movies[0],id:'unidentified',external_ids:[]}]};
      const tree=JSON.stringify(MetadataMaintenance({catalog:refreshed,onUpdated:refresh}));
      expect(tree).toContain('0'); expect(tree).toContain('films without a valid TMDB identity');
      expect(screen(refresh,refreshed)[0].disabled).toBe(true);
    } finally {vi.useRealTimers();}
  });
  it.each(['Stop','unmount'])('%s during an in-flight batch saves and refreshes once', async kind => {
    const pending=deferred<SelectedMetadataEnrichment>();
    vi.mocked(api.enrichMetadataSelected).mockReturnValue(pending.promise);
    const refresh=vi.fn(async()=>{}); screen(refresh,data)[0].onClick();
    if(kind==='Stop') screen(refresh,data).find(a=>a.children==='Stop after this batch')!.onClick(); else hooks.cleanup!();
    pending.resolve(response(['f0','f1']));
    await vi.waitFor(()=>expect(hooks.values[0]).toBe(false));
    expect(api.enrichMetadataSelected).toHaveBeenCalledOnce();expect(refresh).toHaveBeenCalledOnce();
    expect(hooks.values[2]).toMatchObject({updated:2,remaining:3,message:expect.stringContaining('Stopped.')});
  });
  it.each(['network','provider','empty'])('refreshes once after %s failure, retaining partial progress', async kind => {
    vi.useFakeTimers();
    try {
      const request=vi.mocked(api.enrichMetadataSelected); request.mockResolvedValueOnce(response(['f0','f1']));
      if(kind==='network') request.mockRejectedValueOnce(new Error('API unreachable'));
      else if(kind==='provider') request.mockResolvedValueOnce({results:[{movieId:'f2',title:'Film',provider:'tmdb',status:'failed',message:'Cooling down',retryAfter:60}]});
      else request.mockResolvedValueOnce({results:[]});
      const refresh=vi.fn(async()=>{}); screen(refresh,data)[0].onClick(); await vi.runAllTimersAsync();
      expect(request).toHaveBeenCalledTimes(2);expect(refresh).toHaveBeenCalledOnce();
      expect(hooks.values[2]).toMatchObject({updated:2,message:expect.any(String)});
      if(kind==='provider') expect(hooks.values[2]).toMatchObject({failed:1,failure:expect.stringContaining('60 seconds')});
    } finally {vi.useRealTimers();}
  });
  it('freshly checked queued films are skipped and do not stop the run',async()=>{
    const run=await maintainMetadata({ids:['one'],unidentified:0,stopped:()=>false,progress:async()=>{},batch:async()=>({results:[{movieId:'one',title:'One',provider:'tmdb',status:'skipped',message:'Checked'}]})});
    expect(run).toMatchObject({processed:1,updated:0,failed:0,remaining:0});
  });
});
