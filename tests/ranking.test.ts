import { describe, expect, it } from 'vitest';
import { latestScores, requiredScores, missingAnswers, normalizeScore, rankMovie, sortClassics } from '../shared/ranking';
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
  it('uses exact sum of squares with row epsilon',() => { const r = rankMovie(scores(),answers(1),members,42); expect(r.rawScore).toBe((23525+3*(265/3)**2)); expect(r.tieBreak).toBe(0.00042); expect(r.finalScore).toBe((23525+3*(265/3)**2)*1.025**3+0.00042); });
  it.each([0,1,2,3,4])('uses %s explicit No multipliers',n => { const r=rankMovie(scores(),answers(0,n),members); expect(r.unseenMultiplier).toBe(1.025**n); expect(r.unseenCount).toBe(n); expect(r.unknownCount).toBe(4-n); });
  it('Unknown is neither Yes nor No',() => { const r=rankMovie(scores(),answers(0,0),members); expect(r.finalScore).toBe((23525+3*(265/3)**2)); expect(r.eligible).toBe(true); expect(r.rankable).toBe(false); });
  it('all active members Seen disqualifies with negative residual',() => { expect(rankMovie(scores(),answers(4),members,2)).toMatchObject({eligible: false,finalScore: (23525+3*(265/3)**2)+0.00002,residualScore: -((23525+3*(265/3)**2)+0.00002)}); expect(rankMovie(scores(),answers(3,0),members.slice(0,3)).eligible).toBe(false); expect(rankMovie(scores(),[],[]).eligible).toBe(false); });
  it('recognises all six keys and squares six genuine normalised values',()=>{
    expect(requiredScores).toEqual(['imdb:rating','rottentomatoes:audience','rottentomatoes:critic','letterboxd:rating','metacritic:critic','tmdb:rating']);
    const inputs=[score('imdb','rating',9,10),score('rottentomatoes','audience',80),score('rottentomatoes','critic',70),score('letterboxd','rating',3,5),score('metacritic','critic',50),score('tmdb','rating',4,10)];
    const r=rankMovie(inputs,answers(1),members,42);
    expect(r.rawScore).toBe(27100);expect(r.sources).toHaveLength(6);expect(r.imputedScores).toEqual([]);
    expect(r.finalScore).toBe(27100*1.025**3+0.00042);
  });
  it.each([[90,80,70],[75],[90,80,70,60,50]])('imputes missing dimensions from only the genuine values: %s',(...values)=>{
    const inputs=values.map((value,i)=>{const [provider,metric]=requiredScores[i].split(':');return score(provider,metric,value);});
    const before=structuredClone(inputs),mean=values.reduce((sum,value)=>sum+value,0)/values.length;
    const r=rankMovie(inputs,answers(0),members);
    expect(r.rankable).toBe(true);expect(r.availableScoreAverage).toBe(mean);
    expect(r.imputedScores.map(s=>s.value)).toEqual(Array(6-values.length).fill(mean));
    expect(r.rawScore).toBe(values.reduce((sum,value)=>sum+value**2,0)+(6-values.length)*mean**2);
    expect(inputs).toEqual(before);expect(r.sources).toHaveLength(values.length);
    if(values.length===3) expect(r.rawScore).toBe(38600);
  });
  it('zero usable recognised scores cannot produce a mean or rank',()=>{
    const r=rankMovie([score('other','rating',90),score('imdb','rating',200)],answers(0),members);
    expect(r).toMatchObject({rankable:false,rawScore:null,finalScore:null,availableScoreAverage:null,sources:[],imputedScores:[]});
    expect(r.missingRequiredScores).toHaveLength(6);
  });
  it('TMDB direct snapshots retain precedence over MDBList, while other metrics prefer MDBList',()=>{
    for(const [provider,metric] of requiredScores.map(key=>key.split(':'))) {
      const inputs=[score(provider,metric,95,100,'legacy-spreadsheet','2026-10-01'),score(provider,metric,80,100,'omdb','2026-10-02'),score(provider,metric,70,100,'mdblist','2026-09-01')];
      expect(latestScores(inputs)[0].raw_value).toBe(70);
      if(provider==='tmdb')expect(latestScores([...inputs,score(provider,metric,60,100,'tmdb','2026-08-01')])[0].raw_value).toBe(60);
    }
  });
  it('live service supersedes newer legacy snapshot; MDBList precedes OMDb',() => {
    const s=[score('imdb','rating',95,100,'legacy-spreadsheet','2026-10-01'),score('imdb','rating',80,100,'omdb','2026-10-02'),score('imdb','rating',70,100,'mdblist','2026-09-01')];
    expect(latestScores(s)[0].raw_value).toBe(70); expect(latestScores([...s].reverse())).toEqual(latestScores(s));
    expect(latestScores([...s,score('imdb','rating',75,100,'mdblist','2026-09-02')])[0].raw_value).toBe(75);
  });
  it('sorts equal source scores by stable seed and preserves input',() => { const films=[movie('a',2),movie('b',4)];expect(sortClassics(films).map(m => m.id)).toEqual(['b','a']);expect(films[0].id).toBe('a'); });
  it('ranked entries precede missing and disqualified',() => {const needs=movie('needs');needs.ranking=rankMovie([],[],members); expect(sortClassics([movie('dq',10,answers(4)),needs,movie('ok')]).map(m => m.id)).toEqual(['ok','needs','dq']);});
  it('sorts Unranked without partial No boosts, retaining seed ties and unrated films last',() => {
    const high=movie('high',0,answers(0,0)), low=movie('low',0,answers(0,3));
    high.scores=[score('imdb','rating',81)];low.scores=[score('imdb','rating',80)];
    high.ranking=rankMovie(high.scores,high.seen,members);low.ranking=rankMovie(low.scores,low.seen,members);
    const tied=movie('tied',4,answers(0,2));tied.scores=high.scores;tied.ranking=rankMovie(tied.scores,tied.seen,members,4);
    const unrated=movie('unrated');unrated.ranking=rankMovie([],[],members);
    const films=[low,unrated,high,tied],before=structuredClone(films);
    expect(low.ranking.finalScore).toBeGreaterThan(high.ranking.finalScore!);
    expect(sortClassics(films).map(m=>m.id)).toEqual(['tied','high','low','unrated']);
    expect(films).toEqual(before);
  });
  it('queues only Unknown answers',() => expect(missingAnswers([movie('film',0,answers(1,1))],members,'m2').map(q=>q.member.id)).toEqual(['m2']));
});

it('requires all four explicit answers before ranking',()=>{ expect(rankMovie(scores(),answers(1,2),members).rankable).toBe(false); expect(rankMovie(scores(),answers(1,3),members).rankable).toBe(true); expect(rankMovie(scores(),answers(4),members).eligible).toBe(false); });
it('each viewer has an independent Classics queue',()=>{const films=[movie('film',0,answers(1,1)),{...movie('outside'),classic:false}]; expect(members.map(m=>missingAnswers(films,members,m.id).length)).toEqual([0,0,1,1]);});
