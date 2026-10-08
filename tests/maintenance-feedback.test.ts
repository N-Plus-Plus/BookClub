import { describe, expect, it } from 'vitest';
import type { MovieDetail, RefreshResult } from '../shared/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatRetryDuration } from '../frontend/retry-duration';
import { ProviderFeedback, bulkScoreSummary } from '../frontend/maintenance-feedback';

const movie = {id:'fixture'} as MovieDetail;
describe('Bulk score feedback', () => {
  it('distinguishes partial updates from failures and skipped checks', () => {
    const results: RefreshResult[] = [
      {movie,providers:[{provider:'mdblist',status:'success',count:2,message:'Captured'}, {provider:'omdb',status:'failed',count:0,message:'Cooling down',retryAfter:60}]},
      {movie,providers:[{provider:'mdblist',status:'skipped',count:0,message:'Unavailable',retryAfter:60}]},
    ];
    expect(bulkScoreSummary(results)).toEqual({processed:2,updated:1,noChange:1,failedFilms:1,failures:1,skipped:1});
  });
  it('does not call an empty successful response an update', () => {
    expect(bulkScoreSummary([{movie,providers:[{provider:'omdb',status:'success',count:0,message:'No usable ratings'}]}])).toEqual({processed:1,updated:0,noChange:1,failedFilms:0,failures:0,skipped:0});
  });
  it('keeps zero work distinct from missing or failed scores', () => {
    expect(bulkScoreSummary([])).toEqual({processed:0,updated:0,noChange:0,failedFilms:0,failures:0,skipped:0});
  });
});


describe('Retry duration presentation',() => {
  it.each([[1,'1 min'],[59,'1 min'],[60,'1 min'],[61,'2 min'],[3599,'1 hr'],[3600,'1 hr'],[3661,'1 hr 2 min'],[22698,'6 hr 19 min']])('formats %i seconds as %s',(seconds,expected) => {
    expect(formatRetryDuration(seconds)).toBe(expected);
  });
  it('preserves provider failure wording around the formatted wait',() => {
    expect(renderToStaticMarkup(createElement(ProviderFeedback,{providers:[{provider:'omdb',status:'failed',count:0,message:'Cooling down.',retryAfter:22698}]}))).toContain('omdb · failed: Cooling down. Wait 6 hr 19 min before retrying.');
  });
});
