import { expect, it } from 'vitest';
import { catalogIndex } from '../shared/catalog-index';
import { metricsFixture } from './metrics-fixture';

it('indexes canonical films, members, cycles and active sessions without mutating the catalogue',() => {
  const catalog = metricsFixture();
  const active = catalog.sessions.find(session => !session.deleted_at)!;
  const film = active.movies[0];
  const deletedOnly = {...film,id:'deleted-only'};
  catalog.movies.push(deletedOnly);
  catalog.sessions.push({...active,id:'repeat',movies:[film,film]}, {...active,id:'deleted',deleted_at:'2026-01-01',movies:[deletedOnly]});
  const before = structuredClone(catalog);
  const index = catalogIndex(catalog);
  for (const movie of catalog.movies) expect(index.movieById.get(movie.id)).toBe(movie);
  for (const member of catalog.members) expect(index.memberById.get(member.id)).toBe(member);
  for (const cycle of catalog.cycles) expect(index.cycleById.get(cycle.id)).toBe(cycle);
  expect(index.sessionById.get(active.id)).toBe(active);
  expect(index.sessionById.has('deleted')).toBe(false);
  const expected = new Set(catalog.sessions.filter(session => !session.deleted_at).flatMap(session => session.movies.map(movie => movie.id)));
  expect(index.historyMovieIds).toEqual(expected);
  expect(index.historyMovieIds.has(film.id)).toBe(true);
  expect(index.historyMovieIds.has('deleted-only')).toBe(false);
  expect(index.movieById.get('unknown')).toBeUndefined();
  expect(catalog).toEqual(before);
});

it('reuses an index only for the same catalogue object and indexes replacement data',() => {
  const catalog = metricsFixture();
  const index = catalogIndex(catalog);
  expect(catalogIndex(catalog)).toBe(index);
  const added = {...catalog.movies[0],id:'added'};
  const replacement = {...catalog,movies:[...catalog.movies,added],sessions:[]};
  const next = catalogIndex(replacement);
  expect(next).not.toBe(index);
  expect(next.movieById.get('added')).toBe(added);
  expect(index.movieById.has('added')).toBe(false);
  expect(next.historyMovieIds.size).toBe(0);
});
