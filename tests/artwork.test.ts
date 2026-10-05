import { describe, expect, it } from 'vitest';
import { posterReference } from '../shared/artwork';

describe('persisted image delivery',()=>{
  it('uses small/large sizes without changing other references',()=>{
    const url='https://image.tmdb.org/t/p/w500/poster.jpg';
    expect(posterReference(url)).toBe('https://image.tmdb.org/t/p/w185/poster.jpg');
    expect(posterReference(url,true)).toBe('https://image.tmdb.org/t/p/w342/poster.jpg');
    for(const ref of ['https://other.invalid/w500/poster.jpg','/poster.jpg','https://image.tmdb.org.evil.invalid/t/p/w500/a.jpg','https://image.tmdb.org/not-image/w500/a.jpg','http://image.tmdb.org/t/p/w500/a.jpg']) expect(posterReference(ref)).toBe(ref);
  });
});
