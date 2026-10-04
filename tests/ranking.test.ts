import { describe, expect, it } from 'vitest';
import { latestScores, missingAnswers, normalizeScore, rankMovie, sortClassics } from '../shared/ranking';
import type { Member, Movie, Score, SeenAnswer } from '../shared/types';
const members: Member[] = Array.from({length: 4},(_,i) => ({id: `m${i}`,display_name: `Member ${i+1}`,sort_order: i,active: 1}));
const score = (provider: string,metric: string,value: number,scale = 100,via = 'legacy-spreadsheet',date = '2026-09-01T00:00:00Z'): Score => ({provider,metric,raw_value: value,raw_scale: scale,normalized_value: null,vote_count: null,fetched_at: date,retrieved_via: via});
const scores = () => [score('imdb','rating',8,10),score('rottentomatoes','audience',90),score('rottentomatoes','critic',95)];
const answers = (yes: number,no = 4-yes): SeenAnswer[] => members.slice(0,yes+no).map((m,i) => ({member_id: m.id,seen: i < yes ? 1 : 0,updated_at: ''}));
const movie = (id: string,seed = 0,states = answers(0)): Movie => ({id,title: id,year: 2000,original_title: null,release_date: null,runtime: null,overview: null,genres: [],assets: [],external_ids: [],scores: scores(),seen: states,classic: true,ranking: rankMovie(scores(),states,members,seed)});
describe('score normalisation',() => {
  it('normalises all scales and zero',() => { expect(normalizeScore(8,10)).toBe(80); expect(normalizeScore(80,100)).toBe(80); expect(normalizeScore(4,5)).toBe(80); expect(normalizeScore(0,10)).toBe(0); });
  it.each([[1,0],[-1,10],[11,10],[NaN,10],[1,Infinity],[Infinity,10]])('rejects invalid %s/%s',(v,s) => expect(normalizeScore(v,s)).toBeNull());
});
describe('historical ranking',() => {
  it('uses exact sum of squares with row epsilon',() => { const r = rankMovie(scores(),answers(1),members,42); expect(r.rawScore).toBe(23525); expect(r.tieBreak).toBe(0.00042); expect(r.finalScore).toBe(23525*1.025**3+0.00042); });
  it.each([0,1,2,3,4])('uses %s explicit No multipliers',n => { const r=rankMovie(scores(),answers(0,n),members); expect(r.unseenMultiplier).toBe(1.025**n); expect(r.unseenCount).toBe(n); expect(r.unknownCount).toBe(4-n); });
  it('Unknown is neither Yes nor No',() => { const r=rankMovie(scores(),answers(0,0),members); expect(r.finalScore).toBe(23525); expect(r.eligible).toBe(true); });
  it('all active members Seen disqualifies with negative residual',() => { expect(rankMovie(scores(),answers(4),members,2)).toMatchObject({eligible: false,finalScore: -(23525+0.00002)}); expect(rankMovie(scores(),answers(3,0),members.slice(0,3)).eligible).toBe(false); expect(rankMovie(scores(),[],[]).eligible).toBe(false); });
  it.each([0,1,2])('missing required signal %s is not rankable',i => { const s=scores();s.splice(i,1);expect(rankMovie(s,[],members)).toMatchObject({rankable: false,finalScore: null}); });
  it.each(['metacritic','letterboxd','tmdb'])('%s never changes rank',p => expect(rankMovie([...scores(),score(p,'rating',100)],[],members)).toEqual(rankMovie(scores(),[],members)));
  it('invalid inputs remain missing',() => expect(rankMovie([score('imdb','rating',200),...scores().slice(1)],[],members).rankable).toBe(false));
  it('live service supersedes newer legacy snapshot; MDBList precedes OMDb',() => {
    const s=[score('imdb','rating',95,100,'legacy-spreadsheet','2026-10-01'),score('imdb','rating',80,100,'omdb','2026-10-02'),score('imdb','rating',70,100,'mdblist','2026-09-01')];
    expect(latestScores(s)[0].raw_value).toBe(70); expect(latestScores([...s].reverse())).toEqual(latestScores(s));
    expect(latestScores([...s,score('imdb','rating',75,100,'mdblist','2026-09-02')])[0].raw_value).toBe(75);
  });
  it('sorts equal source scores by stable seed and preserves input',() => { const films=[movie('a',2),movie('b',4)];expect(sortClassics(films).map(m => m.id)).toEqual(['b','a']);expect(films[0].id).toBe('a'); });
  it('ranked entries precede missing and disqualified',() => {const needs=movie('needs');needs.ranking=rankMovie([],[],members); expect(sortClassics([movie('dq',10,answers(4)),needs,movie('ok')]).map(m => m.id)).toEqual(['ok','needs','dq']);});
  it('queues only Unknown answers',() => expect(missingAnswers([movie('film',0,answers(1,1))],members).map(q=>q.member.id)).toEqual(['m2','m3']));
});
