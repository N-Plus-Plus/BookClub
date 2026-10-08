import { expect, it } from 'vitest';
import { requiredScores, rankMovie } from '../shared/ranking';
import { ratingDimensions, ratingDimension, sourceRatingKeys, detailRatingKeys, metricsRatingKeys } from '../shared/rating-dimensions';
import { metricsScoreDimensions } from '../shared/metrics';
import type { Score } from '../shared/types';

it('keeps the six ranking inputs authoritative and every display dimension uniquely identifiable',() => {
  expect(requiredScores).toEqual(['imdb:rating','rottentomatoes:audience','rottentomatoes:critic','letterboxd:rating','metacritic:critic','tmdb:rating']);
  const dimensions = Object.values(ratingDimensions);
  expect(dimensions.filter(d => d.rankingRequired).map(d => d.key).sort()).toEqual([...requiredScores].sort());
  expect(dimensions).toHaveLength(9);
  for (const dimension of dimensions) {
    expect(`${dimension.provider}:${dimension.metric}`).toBe(dimension.key);
    expect(ratingDimension(dimension.provider,dimension.metric)).toBe(dimension);
  }
  expect(ratingDimension('unknown','rating')).toBeUndefined();
  expect(new Set(sourceRatingKeys).size).toBe(9);
  expect(new Set(metricsRatingKeys).size).toBe(9);
  expect(detailRatingKeys.every(key => ratingDimensions[key].rankingRequired)).toBe(true);
  expect(metricsScoreDimensions.map(d => `${d.provider}:${d.metric}`)).toEqual(metricsRatingKeys);
});

it('keeps optional observations outside ranking and preserves nominal axes independently of raw scales',() => {
  const optional = (['metacritic:user','trakt:rating','rogerebert:rating'] as const).map(key => ratingDimensions[key]);
  const scores: Score[] = optional.map(d => ({provider:d.provider,metric:d.metric,raw_value:d.scale,raw_scale:d.scale,normalized_value:100,vote_count:null,fetched_at:'2026-01-01',retrieved_via:'mdblist'}));
  const ranking = rankMovie(scores,[],[]);
  expect(ranking.sources).toEqual([]);
  expect(ranking.missingRequiredScores).toEqual(requiredScores);
  expect(ranking.rawScore).toBeNull();
  expect(ratingDimensions['letterboxd:rating'].scale).toBe(5);
  expect(ratingDimensions['rogerebert:rating'].scale).toBe(4);
});
