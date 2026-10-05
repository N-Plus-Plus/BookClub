import { describe, expect, it, vi } from 'vitest';
import { posterReference } from '../shared/artwork';
import { maintainMetadata, type MetadataRun } from '../frontend/metadata-maintenance';
import type { MetadataEnrichment } from '../shared/types';

const batch = (remaining: number,status: 'success'|'failed' = 'success'): MetadataEnrichment => ({remaining,unidentified:391,
  results:[{movieId:String(remaining),title:'Fixture',provider:'tmdb',status,message:status === 'failed' ? 'TMDB cooling down.' : 'Updated.',...(status === 'failed' ? {retryAfter:60} : {})}]});
describe('persisted image delivery',()=>{
  it('uses small/large sizes without changing other references',()=>{
    const url='https://image.tmdb.org/t/p/w500/poster.jpg';
    expect(posterReference(url)).toBe('https://image.tmdb.org/t/p/w185/poster.jpg');
    expect(posterReference(url,true)).toBe('https://image.tmdb.org/t/p/w342/poster.jpg');
    for(const ref of ['https://other.invalid/w500/poster.jpg','/poster.jpg','https://image.tmdb.org.evil.invalid/t/p/w500/a.jpg','https://image.tmdb.org/not-image/w500/a.jpg','http://image.tmdb.org/t/p/w500/a.jpg']) expect(posterReference(ref)).toBe(ref);
  });
});
describe('explicit metadata run',()=>{
  const initial={remaining:3,unidentified:391};
  it('awaits each batch and progress refresh sequentially, finishing at zero',async()=>{
    let active=0,max=0,remaining=3;
    const request=vi.fn(async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return batch(--remaining);});
    const progress=vi.fn(async(run:MetadataRun)=>{expect(request).toHaveBeenCalledTimes(run.processed);await Promise.resolve();});
    const result=await maintainMetadata({initial,batch:request,progress,stopped:()=>false});
    expect(max).toBe(1);expect(result).toMatchObject({processed:3,updated:3,remaining:0,unidentified:391});expect(request).toHaveBeenCalledTimes(3);
  });
  it('stops on provider cooldown/failure, retaining partial completion',async()=>{
    const request=vi.fn().mockResolvedValueOnce(batch(2)).mockResolvedValueOnce(batch(2,'failed'));
    const result=await maintainMetadata({initial,batch:request,progress:async()=>{},stopped:()=>false});
    expect(request).toHaveBeenCalledTimes(2);expect(result).toMatchObject({processed:2,updated:1,remaining:2});expect(result.message).toContain('resume later');
  });
  it('stops between batches and a later run requests remaining work',async()=>{
    let stopped=false;const request=vi.fn().mockResolvedValueOnce(batch(2)).mockResolvedValueOnce(batch(1)).mockResolvedValueOnce(batch(0));
    const first=await maintainMetadata({initial,batch:request,progress:async()=>{stopped=true;},stopped:()=>stopped});
    expect(request).toHaveBeenCalledTimes(1);expect(first.updated).toBe(1);
    stopped=false;
    const second=await maintainMetadata({initial:first,batch:request,progress:async()=>{},stopped:()=>stopped});
    expect(second).toMatchObject({updated:2,processed:2,remaining:0});expect(request).toHaveBeenCalledTimes(3);
  });
  it('halts safely with no progress or an empty batch',async()=>{
    for(const response of [batch(3),{results:[],remaining:3,unidentified:391}]) {
      const request=vi.fn().mockResolvedValueOnce(batch(2)).mockResolvedValue({...response,remaining:2});
      const result=await maintainMetadata({initial,batch:request,progress:async()=>{},stopped:()=>false});
      expect(request).toHaveBeenCalledTimes(2);expect(result.message).toContain('no progress');
    }
  });
  it('preserves completed batches when a later request fails',async()=>{
    const request=vi.fn().mockResolvedValueOnce(batch(2)).mockRejectedValueOnce(Error('Unavailable'));
    const result=await maintainMetadata({initial,batch:request,progress:async()=>{},stopped:()=>false});
    expect(result).toMatchObject({processed:1,updated:1,remaining:2});expect(result.message).toContain('Resume later');
  });
});

it('discards TMDB batch detail across a large run while retaining aggregate counts',async()=>{
 vi.useFakeTimers();let remaining=980;
 const promise=maintainMetadata({initial:{remaining,unidentified:0},stopped:()=>false,batch:async()=>{remaining-=2;return {remaining,unidentified:0,results:[0,1].map(i=>({movieId:String(remaining+i),title:'Film',provider:'tmdb' as const,status:'success' as const,message:'Checked'}))};},
 progress:async run=>{expect(run).not.toHaveProperty('results');}});
 await vi.runAllTimersAsync();expect(await promise).toMatchObject({processed:980,updated:980,failed:0,remaining:0});vi.useRealTimers();
});
