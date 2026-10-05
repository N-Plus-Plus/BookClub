import { expect, it } from 'vitest';
import { effectiveRankingScores, liveScoreDimensions, missingLiveScoreDimensions, rankMovie, requiredScores } from '../shared/ranking';
import type { Score } from '../shared/types';
import { effectiveScoreSql } from '../worker/src/score-sql';
import { disposableD1 } from './d1';
const score=(i:number,via='mdblist',value=80):Score=>{const [provider,metric]=requiredScores[i].split(':');return {provider,metric,raw_value:value,raw_scale:100,normalized_value:null,vote_count:null,fetched_at:'2026-10-01T00:00:00Z',retrieved_via:via};};
const legacy=()=>requiredScores.map((_,i)=>({...score(i,'legacy-spreadsheet',60+i),source_ordinal:i+1}));
it.each([0,1,2,3,4,5,6])('%s live dimensions determine bootstrap eligibility and compact SQL equivalence',async n=>{
 const live=Array.from({length:n},(_,i)=>score(i,'mdblist',80+i)), inputs=[...legacy(),...live];
 const before=structuredClone(inputs),r=rankMovie(inputs,[],[]);
 expect(liveScoreDimensions(inputs)).toHaveLength(n);
 expect(r.sources).toHaveLength(n<3?6:n);
 expect(r.sources.filter(s=>s.retrieved_via==='legacy-spreadsheet')).toHaveLength(n<3?6-n:0);
 for(const s of live)expect(r.sources.find(v=>v.provider===s.provider&&v.metric===s.metric)?.value).toBe(s.raw_value);
 if(n>=3){expect(r.imputedScores).toHaveLength(6-n);expect(r.availableScoreAverage).toBe(80+(n-1)/2);expect(r.imputedScores.every(s=>s.value===r.availableScoreAverage)).toBe(true);}
 const local=disposableD1();
 try{
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('fixture','Fixture')");
 for(const s of inputs)local.sqlite.prepare('INSERT INTO source_scores(movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,source_ordinal) VALUES(?,?,?,?,?,?,?,?,?,?)').run('fixture',s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via!,s.source_ordinal??null);
 const compact=local.sqlite.prepare(effectiveScoreSql()).all().map(({movie_id,...s})=>s as unknown as Score);
 expect(rankMovie(compact,[],[])).toEqual(r);
 }finally{local.sqlite.close();}
 expect(inputs).toEqual(before);
});
it('counts distinct usable required live values and excludes demos, invalid values and checks',()=>{
 const inputs=[...legacy(),score(0),score(0,'omdb',90),score(0,'tmdb',85),score(1),score(2,'mdblist',101),score(3,'development-demo'),{...score(4),raw_scale:Infinity}, {...score(5),provider:'other'}];
 expect(liveScoreDimensions(inputs)).toHaveLength(2);
 expect(effectiveRankingScores(inputs).some(s=>s.retrieved_via==='legacy-spreadsheet')).toBe(true);
 expect(missingLiveScoreDimensions(legacy())).toHaveLength(6);
 expect(missingLiveScoreDimensions([score(0)])).not.toContain(requiredScores[0]);
 expect(liveScoreDimensions([])).toEqual([]); // Checks are deliberately not rating observations.
 expect(rankMovie([...inputs,score(2)],[],[]).sources).toHaveLength(3);
});
it('SQL preserves duplicates, service precedence, invalid scores and final shared tie selection',()=>{
 const local=disposableD1();try{
 local.sqlite.exec("INSERT INTO movies(id,title) VALUES('fixture','Fixture')");
 const inputs=[...legacy(),{...score(0,'mdblist',82),fetched_at:'2026-09-01T00:00:00Z'},score(0,'omdb',99),score(0,'mdblist',101),score(1),score(1),score(2,'mdblist',-1),...legacy().map(s=>({...s,source_ordinal:99,raw_value:70,legacy_preferred:1})),score(5,'tmdb',79),score(5,'mdblist',90)];
 for(const [i,s] of inputs.entries()){s.source_ref=`fixture:${i}`;local.sqlite.prepare('INSERT INTO source_scores(movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,source_ordinal,legacy_preferred,source_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('fixture',s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via!,s.source_ordinal??null,'legacy_preferred' in s ? Number(s.legacy_preferred):0,s.source_ref);}
 const compact=local.sqlite.prepare(effectiveScoreSql()).all().map(({movie_id,...s})=>s as unknown as Score);
 expect(rankMovie(compact,[],[])).toEqual(rankMovie(inputs,[],[]));
 expect(rankMovie(compact,[],[]).sources.find(s=>s.provider==='tmdb')?.value).toBe(79);
 }finally{local.sqlite.close();}
});

it('legacy ties remain deterministic below the cutoff',()=>{const inputs=[...legacy(),{...score(4,'legacy-spreadsheet',90),source_ordinal:99,legacy_preferred:1}];expect(effectiveRankingScores(inputs)).toEqual(effectiveRankingScores([...inputs].reverse()));expect(effectiveRankingScores(inputs).find(s=>s.provider==='metacritic')?.raw_value).toBe(90);});
