import { describe, expect, it } from 'vitest';
import { latestScores, missingAnswers, normalizeScore, rankMovie, sortClassics } from '../shared/ranking';
import type { Member, Movie, Score, SeenAnswer } from '../shared/types';

const members: Member[] = Array.from({length: 4},(_,i) => ({id: `m${i}`,display_name: `Member ${i+1}`,sort_order: i,active: 1}));
const score = (provider: string,value: number,scale = 10,date = '2026-09-01T00:00:00Z'): Score => ({provider,metric: 'rating',raw_value: value,raw_scale: scale,normalized_value: null,vote_count: null,fetched_at: date});
const answers = (seen: number,no = 4-seen): SeenAnswer[] => members.slice(0,seen+no).map((m,i) => ({member_id: m.id,seen: i < seen ? 1 : 0,updated_at: '2026-09-01T00:00:00Z'}));
const movie = (id: string,title: string,year: number,states = answers(0)): Movie => ({id,title,year,original_title: null,release_date: null,runtime: null,overview: null,genres: [],assets: [],external_ids: [],scores: [score('tmdb',8)],seen: states,classic: true,ranking: rankMovie([score('tmdb',8)],states,members)});

describe('score normalisation',() => {
  it('normalises different scales consistently',() => { expect(normalizeScore(8,10)).toBe(80); expect(normalizeScore(80,100)).toBe(80); expect(normalizeScore(4,5)).toBe(80); });
  it.each([[1,0],[-1,10],[11,10],[NaN,10],[1,Infinity],[Infinity,10]])('rejects invalid values %s/%s',(value,scale) => { expect(normalizeScore(value,scale)).toBeNull(); });
  it('accepts a legitimate zero rating',() => { expect(normalizeScore(0,10)).toBe(0); });
});
describe('provisional ranking',() => {
  it('applies the configured source weights',() => { const r = rankMovie([score('tmdb',6),score('imdb',9)],answers(0),members); expect(r.weightedBaseScore).toBe(80); expect(r.finalScore).toBe(88); });
  it('renormalises weights when sources are missing',() => { const r = rankMovie([score('imdb',9)],answers(1),members); expect(r.weightedBaseScore).toBe(90); expect(r.warnings).toContain('Some source scores are missing'); });
  it('warns about absent or invalid scores',() => { const r = rankMovie([score('tmdb',12)],[],members); expect(r.weightedBaseScore).toBe(0); expect(r.warnings).toContain('No usable source scores'); expect(r.unknownCount).toBe(4); });
  it.each([0,1,2,3])('handles %s members seen',(n) => { const r = rankMovie([score('tmdb',8)],answers(n),members); expect(r.eligible).toBe(true); expect(r.seenCount).toBe(n); expect(r.unseenCount).toBe(4-n); expect(r.seenAdjustment).toBe((4-n)*2); expect(r.finalScore).toBe(80+(4-n)*2); });
  it('always disqualifies all four seen',() => { const r = rankMovie([score('tmdb',10)],answers(4),members); expect(r.eligible).toBe(false); expect(r.seenAdjustment).toBe(0); });
  it('does not infer No from Unknown',() => { const r = rankMovie([score('tmdb',8)],answers(0,0),members); expect(r.unseenCount).toBe(0); expect(r.unknownCount).toBe(4); expect(r.finalScore).toBe(80); });
  it('ignores inactive member answers',() => { const r = rankMovie([],answers(0),members.map((m,i) => ({...m,active: i===3 ? 0 : 1}))); expect(r.unseenCount).toBe(3); });
  it('uses only latest snapshots, never historical scores twice',() => { const scores = [score('tmdb',6),score('tmdb',9,10,'2026-10-01T00:00:00Z')]; expect(latestScores(scores)).toHaveLength(1); expect(rankMovie(scores,[],members).weightedBaseScore).toBe(90); });
  it('handles explicit normalised data without a raw scale',() => { expect(rankMovie([{...score('critic',50),raw_scale: null,normalized_value: 50}],[],members).weightedBaseScore).toBe(50); });
  it('sorts deterministically by score, title, year, ID',() => {
    const films = [movie('b','Beta',2000),movie('a2','Alpha',2001),movie('a1','Alpha',2000),movie('a0','Alpha',2000)];
    expect(sortClassics(films).map(m => m.id)).toEqual(['a0','a1','a2','b']); expect(films[0].id).toBe('b');
  });
  it('places disqualified films outside the eligible order',() => { const dq = movie('dq','A',2000,answers(4)); dq.ranking!.finalScore = 1000; expect(sortClassics([dq,movie('ok','B',2001)])[0].id).toBe('ok'); });
  it('queues only unknown answers, in stable film and member order',() => { const queue = missingAnswers([movie('film','Film',2000,answers(1,1))],members); expect(queue.map(q => q.member.id)).toEqual(['m2','m3']); });
});
