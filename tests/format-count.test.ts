import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { formatCount, formatCountText } from '../shared/format';
import { formatTimelineNumber, formatWatchTime } from '../shared/metrics-summary';
import { ClassicsScreen } from '../frontend/ClassicsScreen';
import { metricsFilm } from './metrics-fixture';
import { rankMovie } from '../shared/ranking';

it.each([[0,'0'],[999,'999'],[1000,'1,000'],[1234567,'1,234,567']])('formats whole-number count %s for Australian readers', (value,expected) => {
  expect(formatCount(value as number)).toBe(expected);
  expect(formatTimelineNumber(value as number)).toBe(expected);
});

it('formats numeric quota headers while preserving unrecognised provider text', () => {
  expect(formatCountText('12345')).toBe('12,345');
  for (const value of ['Unknown','12.5','9007199254740993','']) expect(formatCountText(value)).toBe(value);
});

it('keeps the Unranked cap while exposing the full formatted count', () => {
  const members = [{id:'member',display_name:'Member',sort_order:1,active:1}];
  const movie = metricsFilm('unranked',{classic:true,scores:[],seen:[]});
  movie.ranking = rankMovie([],[],members);
  const html = renderToStaticMarkup(createElement(ClassicsScreen,{movies:Array(1234).fill(movie),viewer:null,writesEnabled:false,onMovie:()=>{}}));
  expect(html).toContain('Unranked: 1,234 films');
  expect(html).toContain('aria-hidden="true" class="count-indicator classics-count classics-count-needs-data">99+');
  expect(formatWatchTime(60001)).toBe('1000:01');
});
