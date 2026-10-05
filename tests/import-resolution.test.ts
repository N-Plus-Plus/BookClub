import { describe,it,expect,vi } from 'vitest';
import { analyseWorkbook, markdownReport } from '../scripts/import/workbook';
import { resolvePlan } from '../scripts/import/resolution';
import { resolveWithTmdb } from '../scripts/import/tmdb-resolution';
import { latestScores } from '../shared/ranking';
import { parseMdbList } from '../worker/src/providers/mdblist';
import { validateResolved,applyLocal } from '../scripts/import/apply';
import { disposableD1 } from './d1';
import { readFileSync } from 'node:fs';
import type { RawPlan,ResolvedPlan } from '../scripts/import/model';
import {config,workbook} from './import-fixture';
const raw=()=>analyseWorkbook(workbook(),config).plan as RawPlan;
const resolved=()=>resolvePlan(raw()).plan;
describe('legacy rating and diagnostic corrections',()=>{
 it('preserves percentage Letterboxd and excludes only explicit auxiliary N/A',()=>{
  const result=analyseWorkbook(workbook(),config);expect(result.plan.classics[0].scores.find(s=>s.provider==='letterboxd')).toMatchObject({raw_value:80,raw_scale:100,normalized_value:80});
  expect(result.summary.diagnostics.filter(d=>d.code==='RATING_UNAVAILABLE')).toHaveLength(2);expect(result.summary.diagnostics.some(d=>d.code==='INVALID_RATING')).toBe(false);
  expect(parseMdbList({ratings:[{source:'letterboxd',value:4}]})).toMatchObject([{raw_scale:5,normalized_value:80}]);
  const w=workbook();w.getWorksheet('Should Watch')!.getCell('P2').value='not a score';expect(analyseWorkbook(w,config).summary.diagnostics.find(d=>d.code==='INVALID_RATING')?.severity).toBe('warning');
 });
 it('aggregates expected Unknown, keeps scored Unknown and helper defects visible',()=>{
  const w=workbook(),c=w.getWorksheet('Should Watch')!;c.getCell('E2').value={formula:'unsafe()'};c.getCell('J2').value='bad';c.getCell('K2').value=5;
  const r=analyseWorkbook(w,config);expect(r.summary.diagnostics.filter(d=>d.code==='EXPECTED_UNKNOWN_SEEN')).toHaveLength(4);expect(r.summary.diagnostics.filter(d=>d.code==='EXPECTED_UNKNOWN_SEEN').every(d=>d.severity==='info')).toBe(true);
  for(const code of ['UNKNOWN_SEEN','MALFORMED_HELPER','SCORE_MISMATCH'])expect(r.summary.diagnostics.find(d=>d.code===code)?.severity).toBe('warning');
  expect(r.summary.diagnostics.find(d=>d.code==='UNCACHED_FORMULA')?.severity).toBe('info');expect(markdownReport(r)).toContain('EXPECTED_UNKNOWN_SEEN: 4');expect(markdownReport(r)).not.toContain('info] EXPECTED_UNKNOWN_SEEN');
 });
});
describe('offline linking and canonical duplicate semantics',()=>{
 it('merges IMDb and unique richer Tracker identity; keeps minimum seed and all provenance',()=>{
  const {plan,report}=resolvePlan(raw());const m=plan.movies.find(m=>m.title==='Fictional Lantern')!;expect(m.source_refs).toHaveLength(4);expect(report.after.linkedSourceRecords).toBe(3);
  const c=plan.classics.find(c=>c.movie_id===m.id)!;expect(c.rank_seed).toBe(2);expect(c.source_refs).toHaveLength(2);expect(c.seen.map(s=>s.seen)).toEqual([1,0,0,0]);
  expect(c.scores.filter(s=>s.provider==='rottentomatoes'&&s.metric==='audience')).toHaveLength(2);
  expect(latestScores(c.scores.map(s=>({...s,fetched_at:s.fetched_at!}))).find(s=>s.metric==='audience')!.raw_value).toBe(85);
  expect(plan.events[0].films.map(f=>f.movie_id)).toEqual([m.id,m.id]);expect(plan.issues.some(i=>i.severity==='blocker')).toBe(false);
 });
 it('links exact title/year without IDs, but refuses incompatible years and IDs',()=>{
  const p=raw();for(const r of p.source_records)r.imdb_id=null;for(const m of p.movies)m.external_ids=[];
  expect(resolvePlan(p).plan.classics).toHaveLength(2);
  p.source_records.find(r=>r.source_ref==='Should Watch:3')!.year=1990;
  const r=resolvePlan(p);expect(r.plan.classics).toHaveLength(3);expect(r.plan.issues.some(i=>i.code==='AMBIGUOUS_TITLE')).toBe(true);
  p.source_records.find(r=>r.source_ref==='Should Watch:3')!.year=2000;p.source_records.find(r=>r.source_ref==='Should Watch:2')!.imdb_id='tt0000001';p.source_records.find(r=>r.source_ref==='Should Watch:3')!.imdb_id='tt0000002';
  expect(resolvePlan(p).plan.issues.some(i=>i.code==='EXTERNAL_ID_CONFLICT')).toBe(true);
 });
 it('blocks contradictory Seen; accepts a private answer override with audit references',()=>{
  const p=raw();p.classics[1].seen.find(s=>s.member_id===config.memberIds[0])!.seen=0;
  expect(resolvePlan(p).plan.issues.some(i=>i.code==='SEEN_CONFLICT')).toBe(true);
  const r=resolvePlan(p,{version:1,assignments:[],seen:[{source_ref:'Should Watch:2',member_id:config.memberIds[0],seen:1}]});
  expect(r.plan.issues.some(i=>i.code==='SEEN_CONFLICT')).toBe(false);expect(r.plan.classics[0].seen[0].source_refs).toHaveLength(2);
 });
 it('allows private preferred observation without changing real timestamps or ordinal',()=>{
  const p=resolvePlan(raw(),{version:1,assignments:[{identity:'chosen',source_refs:['Should Watch:2','Should Watch:3'],preferred_score_ref:'Should Watch:2'}],seen:[]}).plan;
  expect(latestScores(p.classics[0].scores.map(s=>({...s,fetched_at:s.fetched_at!}))).find(s=>s.metric==='audience')!.raw_value).toBe(90);
  expect(new Set(p.classics[0].scores.map(s=>s.fetched_at)).size).toBe(1);
 });
 it('validates overrides and handles explicit separate versions',()=>{
  const p=raw();for(const r of p.source_records)r.imdb_id=null;for(const m of p.movies)m.external_ids=[];p.source_records.find(r=>r.source_ref==='Should Watch:3')!.year=1990;
  const assignments=[{identity:'version-a',source_refs:['Tracker:2:2','Tracker:3:2','Should Watch:2']},{identity:'version-b',source_refs:['Should Watch:3']}];
  expect(resolvePlan(p,{version:1,assignments,seen:[]}).plan.issues.some(i=>i.code==='AMBIGUOUS_TITLE')).toBe(false);
  expect(()=>resolvePlan(p,{version:1,assignments:[{identity:'bad',source_refs:['Should Watch:999']}]})).toThrow('unknown');
  const joined=resolvePlan(p,{version:1,assignments:[{identity:'same',source_refs:['Should Watch:2'],tmdb_id:'123'},{identity:'same',source_refs:['Should Watch:3']}]}).plan;
  expect(joined.classics).toHaveLength(2);expect(joined.movies.find(m=>m.source_refs.includes('Should Watch:3'))!.external_ids).toContainEqual({provider:'tmdb',external_id:'123'});
  expect(()=>resolvePlan(raw(),{version:1,assignments:[{identity:'a',source_refs:['Should Watch:2'],tmdb_id:'1'},{identity:'b',source_refs:['Should Watch:3'],tmdb_id:'2'}]})).toThrow();
  const q=raw();q.source_records.find(r=>r.source_ref==='Should Watch:3')!.imdb_id='tt0000002';expect(()=>resolvePlan(q,{version:1,assignments:[{identity:'bad',source_refs:['Should Watch:2','Should Watch:3']}]})).toThrow('different verified');
 });
 it('selects snapshots by service, actual instant, then legacy ordinal',()=>{
  const score={provider:'imdb',metric:'rating',raw_value:80,raw_scale:100,normalized_value:80,vote_count:null,retrieved_via:'legacy-spreadsheet',fetched_at:config.snapshotCapturedAt};
  expect(latestScores([{...score,source_ordinal:2},{...score,raw_value:90,source_ordinal:3}])[0].raw_value).toBe(90);
  expect(latestScores([{...score,source_ordinal:99},{...score,raw_value:70,fetched_at:'2001-01-01T00:00:00Z',retrieved_via:'mdblist'}])[0].raw_value).toBe(70);
  expect(latestScores([{...score,fetched_at:'2002-01-01T00:00:00.000Z',source_ordinal:2},{...score,fetched_at:'2002-01-01T00:00:00Z',source_ordinal:3}])[0].source_ordinal).toBe(3);
 });
 it('network identity can merge ambiguous title-only sources without forcing remakes',()=>{
  const p=raw();for(const r of p.source_records){r.imdb_id=null;r.year=null;}for(const m of p.movies)m.external_ids=[];
  const refs=p.source_records.filter(r=>r.title==='Fictional Lantern').map(r=>r.source_ref);expect(resolvePlan(p).plan.issues.some(i=>i.code==='AMBIGUOUS_TITLE')).toBe(true);
  const evidence=refs.map(ref=>({source_refs:[ref],tmdb_id:'123',title:'Fictional Lantern',year:2000}));const r=resolvePlan(p,undefined,evidence);expect(r.plan.issues.some(i=>i.code==='AMBIGUOUS_TITLE')).toBe(false);expect(r.plan.classics).toHaveLength(2);
  expect(resolvePlan(raw(),undefined,[{source_refs:['Should Watch:2'],tmdb_id:'123',title:'Fictional Lantern',year:1990}]).plan.issues.some(i=>i.code==='TMDB_YEAR_CONFLICT')).toBe(true);
 });
});
describe('owner canonical film years',()=>{
 it('retains archive evidence and separate release metadata without weakening IMDb conflicts',()=>{
  const p=raw(),before=structuredClone(p),refs=p.source_records.filter(r=>r.title==='Fictional Lantern').map(r=>r.source_ref);
  const overrides={version:1,assignments:[{identity:'owner-year',source_refs:refs,tmdb_id:'123',canonical_year:2000,year_reason:'Owner confirmed film year'}]};
  const evidence={source_refs:refs,tmdb_id:'123',title:'Fictional Lantern',year:2001,release_date:'2001-02-03',imdb_id:'tt0000001'};
  const result=resolvePlan(p,overrides,[evidence]);
  expect(result.plan.issues.some(i=>i.severity==='blocker')).toBe(false);
  expect(result.plan.movies.find(m=>m.source_refs.includes('Should Watch:2'))).toMatchObject({year:2000,tmdb_release_date:'2001-02-03'});
  expect(p).toEqual(before);
  expect(resolvePlan(p,overrides,[{...evidence,imdb_id:'tt0000009'}]).plan.issues.some(i=>i.code==='TMDB_IMDB_CONFLICT')).toBe(true);
  expect(()=>resolvePlan(p,{version:1,assignments:[{...overrides.assignments[0],year_reason:undefined}]})).toThrow('owner reason');
 });
});
describe('mocked bounded resumable TMDB identity resolution',()=>{
 it('directly verifies a private TMDB selection, adopts canonical title/year/IMDb and preserves source evidence',async()=>{
  const p=raw(),before=structuredClone(p),refs=p.source_records.filter(r=>r.title==='Fictional Lantern').map(r=>r.source_ref);
  for(const r of p.source_records.filter(r=>refs.includes(r.source_ref)))r.year=null;
  const original=structuredClone(p),overrides={version:1,assignments:[{identity:'tmdb-123',source_refs:refs,tmdb_id:'123'}]};
  const selected=resolvePlan(p,overrides).plan;
  expect(selected.movies.find(m=>m.source_refs.includes('Should Watch:2'))!.title).toBe('Fictional Lantern');
  const fetcher=vi.fn(async(_url:RequestInfo|URL)=>Response.json({id:123,title:'The Fictional Lantern: Restored',release_date:'2000-02-03',external_ids:{imdb_id:'tt0000001'}}));
  const network=await resolveWithTmdb({...selected,movies:selected.movies.filter(m=>m.source_refs.includes('Should Watch:2'))},{token:'synthetic-token',fetcher,maxRequests:1});
  expect(fetcher.mock.calls[0][0]).toContain('/movie/123?append_to_response=external_ids');
  const canonical=resolvePlan(p,overrides,network.evidence).plan;
  expect(canonical.movies.find(m=>m.source_refs.includes('Should Watch:2'))).toMatchObject({title:'The Fictional Lantern: Restored',year:2000,source_refs:[...refs].sort(),external_ids:[{provider:'imdb',external_id:'tt0000001'},{provider:'tmdb',external_id:'123'}]});
  expect(p).toEqual(original);expect(p.source_records.map(r=>r.title)).toEqual(before.source_records.map(r=>r.title));
  expect(canonical.classics[0].seen_observations).toEqual(selected.classics[0].seen_observations);expect(canonical.classics[0].scores).toEqual(selected.classics[0].scores);
  const cached=await resolveWithTmdb({...selected,movies:selected.movies.filter(m=>m.source_refs.includes('Should Watch:2'))},{fetcher,cache:network.cache,maxRequests:0});
  expect(cached.evidence).toEqual(network.evidence);expect(cached.state.cacheHits).toBe(1);expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('attaches a safe IMDb ID newly returned by direct TMDB details',async()=>{
  const p=raw(),overrides={version:1,assignments:[{identity:'tmdb-456',source_refs:['Should Watch:4'],tmdb_id:'456'}]},selected=resolvePlan(p,overrides).plan;
  const movie=selected.movies.find(m=>m.source_refs.includes('Should Watch:4'))!;
  const network=await resolveWithTmdb({...selected,movies:[movie]},{token:'synthetic-token',fetcher:async()=>Response.json({id:456,title:'Fictional Canonical Seed',release_date:'1999-01-01',external_ids:{imdb_id:'tt0000009'}})});
  expect(resolvePlan(p,overrides,network.evidence).plan.movies.find(m=>m.source_refs.includes('Should Watch:4'))).toMatchObject({title:'Fictional Canonical Seed',year:1999,external_ids:[{provider:'imdb',external_id:'tt0000009'},{provider:'tmdb',external_id:'456'}]});
 });
 it('keeps contradictory verified IMDb/year evidence blocking despite a private TMDB selection',async()=>{
  const p=raw(),before=structuredClone(p),refs=p.source_records.filter(r=>r.title==='Fictional Lantern').map(r=>r.source_ref);
  const overrides={version:1,assignments:[{identity:'tmdb-123',source_refs:refs,tmdb_id:'123'}]},selected=resolvePlan(p,overrides).plan;
  for(const [imdb_id,year,code] of [['tt0000009',2000,'TMDB_IMDB_CONFLICT'],['tt0000001',1990,'TMDB_YEAR_CONFLICT']] as const) {
   const network=await resolveWithTmdb({...selected,movies:selected.movies.filter(m=>m.source_refs.includes('Should Watch:2'))},{token:'synthetic-token',fetcher:async()=>Response.json({id:123,title:'Fictional contradictory identity',release_date:`${year}-01-01`,external_ids:{imdb_id}})});
   const blocked=resolvePlan(p,overrides,network.evidence).plan;
   expect(blocked.issues.some(i=>i.code===code&&i.severity==='blocker')).toBe(true);expect(()=>validateResolved(blocked,config)).toThrow('blockers');
   expect(blocked.movies.find(m=>m.source_refs.includes('Should Watch:2'))!.external_ids).toContainEqual({provider:'imdb',external_id:'tt0000001'});
  }
  expect(p).toEqual(before);
 });
 it('blocks contradictory evidence across linked refs, including Tracker refs without their own IMDb/year',()=>{
  const p=raw(),refs=p.source_records.filter(r=>r.title==='Fictional Lantern').map(r=>r.source_ref);
  const overrides={version:1,assignments:[{identity:'tmdb-123',source_refs:refs,tmdb_id:'123'}]};
  for(const evidence of [{source_refs:['Tracker:2:2'],tmdb_id:'123',title:'Fictional wrong identity',year:2000,imdb_id:'tt0000009'},
    {source_refs:['Tracker:2:2'],tmdb_id:'123',title:'Fictional wrong year',year:1990,imdb_id:'tt0000001'}]) {
   const blocked=resolvePlan(p,overrides,[evidence]).plan;
   expect(()=>validateResolved(blocked,config)).toThrow('blockers');
   expect(blocked.movies.find(m=>m.source_refs.includes('Should Watch:2'))).toMatchObject({title:'Fictional Lantern',year:2000});
  }
 });
 const movie=(id:string,title:string,year:number|null=null,imdb?:string):ResolvedPlan['movies'][number]=>({id,title,year,source_refs:[`Should Watch:${id}`],identity_status:'provisional',external_ids:imdb?[{provider:'imdb',external_id:imdb}]:[]});
 const plan=(movies:ResolvedPlan['movies'])=>({...resolved(),movies});
 it('uses external find and unique exact title/year; caches and resumes within cap',async()=>{
  const p=plan([movie('2','Fictional Moon',2000,'tt0000001'),movie('3','Fictional Sun',2001)]);
  const fetcher=vi.fn(async(url:RequestInfo|URL)=>String(url).includes('/find/')?Response.json({movie_results:[{id:1,title:'Fictional Moon',release_date:'2000-01-01'}]}):Response.json({page:1,total_pages:1,results:[{id:2,title:'Fictional Sun',release_date:'2001-01-01'}]}));
  const a=await resolveWithTmdb(p,{token:'secret-token',fetcher,maxRequests:1});expect(a.state.requests).toBe(1);expect(a.state.remaining).toBe(1);expect(a.evidence[0].tmdb_id).toBe('1');expect(fetcher.mock.calls[0][0]).toContain('external_source=imdb_id');
  const b=await resolveWithTmdb(p,{token:'secret-token',fetcher,maxRequests:1,cache:a.cache});expect(b.state.cacheHits).toBe(1);expect(b.state.remaining).toBe(0);expect(b.evidence).toHaveLength(2);expect(JSON.stringify(b)).not.toContain('secret-token');
  await resolveWithTmdb(p,{token:'secret-token',fetcher,cache:b.cache});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('never chooses among remakes or incomplete pagination; no-result stays provisional',async()=>{
  const p=plan([movie('2','Fictional Moon')]),fetcher=vi.fn(async()=>Response.json({page:1,total_pages:1,results:[{id:1,title:'Fictional Moon',release_date:'1980-01-01'},{id:2,title:'Fictional Moon',release_date:'2000-01-01'}]}));
  const r=await resolveWithTmdb(p,{token:'s',fetcher});expect(r.evidence).toHaveLength(0);expect(r.review[0].candidates).toHaveLength(2);
  const empty=await resolveWithTmdb(p,{token:'s',fetcher:async()=>Response.json({page:1,total_pages:0,results:[]})});expect(empty.review[0].reason).toContain('No exact');
  const paged=await resolveWithTmdb(p,{token:'s',fetcher:async()=>Response.json({page:1,total_pages:2,results:[{id:1,title:'Fictional Moon'}]})});expect(paged.evidence).toHaveLength(0);
 });
 it('handles 429, failure and malformed payload safely, retaining resumable state',async()=>{
  const p=plan([movie('2','Fictional Moon'),movie('3','Fictional Bay')]);
  for(const response of [new Response('secret-token',{status:429,headers:{'Retry-After':'30'}}),Response.json({results:'secret-token'}),new Response('secret-token',{status:503})]) {
   const fetcher=vi.fn(async()=>response),r=await resolveWithTmdb(p,{token:'secret-token',fetcher,now:()=>1000});expect(r.state.requests).toBe(1);expect(r.state.remaining).toBe(2);expect(JSON.stringify(r)).not.toContain('secret-token');
   await resolveWithTmdb(p,{token:'secret-token',fetcher,cache:r.cache,now:()=>1001});expect(fetcher).toHaveBeenCalledTimes(1); // Pause all requests during the persisted retry window.
  }
  const offline=await resolveWithTmdb(p,{fetcher:vi.fn()});expect(offline.state.requests).toBe(0);expect(offline.state.networkAvailable).toBe(false);
 });
});
  describe('local import apply',()=>{
 it('requires artwork migration 0009 before archive writes',async()=>{
  const local=disposableD1('0008_provider_cooldowns.sql');try {
   local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));
   await expect(applyLocal(local.db,validateResolved(resolved(),config),true)).rejects.toThrow('0009');
   expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBe(0);
  }finally{local.sqlite.close();}
 });
 it('requires cooldown migration 0008 before archive writes',async()=>{
  const local=disposableD1('0007_tmdb_metadata_checked.sql');try {
   local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));
   await expect(applyLocal(local.db,validateResolved(resolved(),config),true)).rejects.toThrow('0008');
   expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBe(0);
  }finally{local.sqlite.close();}
 });
 it('requires metadata migration 0007 before any archive writes',async()=>{
  const local=disposableD1('0006_history_integrity.sql');try {
   local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));
   await expect(applyLocal(local.db,validateResolved(resolved(),config),true)).rejects.toThrow('0007');
   expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBe(0);
  }finally{local.sqlite.close();}
 });
 it('requires migration 0006 invariants before synthetic import apply',async()=>{
  const local=disposableD1('0005_product_state.sql');try {
   local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));
   await expect(applyLocal(local.db,validateResolved(resolved(),config),true)).rejects.toThrow('0006');
   expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBe(0);
  }finally{local.sqlite.close();}
 });
 it('refuses an older preview schema before writing imported data',async()=>{
  const local=disposableD1('0004_import_provenance.sql');try {
   local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));
   await expect(applyLocal(local.db,validateResolved(resolved(),config),true)).rejects.toThrow('0008');
   expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()?.n).toBe(0);
   expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()?.n).toBe(0);
  }finally {local.sqlite.close();}
 });
 it('preflights read-only, applies atomically, reruns as no-op and rejects changed state',async()=>{
  const local=disposableD1();try{
   local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));const plan=validateResolved(resolved(),config);
   await applyLocal(local.db,plan);expect(local.sqlite.prepare('SELECT count(*) n FROM movies').get()!.n).toBe(0);
   const first=await applyLocal(local.db,plan,true);expect(first.applied).toBe(true);const refs=local.sqlite.prepare('SELECT * FROM movie_import_refs ORDER BY source_ref').all();
   const scores=local.sqlite.prepare('SELECT * FROM source_scores').all();expect(scores).toHaveLength(8);
   const again=await applyLocal(local.db,plan,true);expect(Object.values(again.preflight.counts).every(c=>c.create===0)).toBe(true);expect(local.sqlite.prepare('SELECT * FROM movie_import_refs ORDER BY source_ref').all()).toEqual(refs);
   expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()!.n).toBe(4);expect(local.sqlite.prepare('SELECT count(*) n FROM session_movies').get()!.n).toBe(5);expect(local.sqlite.prepare('SELECT count(*) n FROM member_auth').get()!.n).toBe(0);expect(local.sqlite.prepare('SELECT count(*) n FROM seed_runs').get()!.n).toBe(0);
   const changed=structuredClone(plan);changed.classics[0].scores[0].raw_value=50;changed.classics[0].scores[0].normalized_value=50;await expect(applyLocal(local.db,changed,true)).rejects.toThrow('conflict');expect(local.sqlite.prepare('SELECT * FROM source_scores').all()).toEqual(scores);
   local.sqlite.exec("UPDATE movie_import_refs SET movie_id=(SELECT id FROM movies WHERE title='Fictional Bay') WHERE source_ref='Should Watch:2'");await expect(applyLocal(local.db,plan,true)).rejects.toThrow('conflict');
  }finally{local.sqlite.close();}
 });
 it('refuses missing capture, blockers, mismatched members, schema and invalid order',async()=>{
  const p=resolved();expect(()=>validateResolved(p,{...config,snapshotCapturedAt:undefined})).toThrow('snapshotCapturedAt');
  const blocked=structuredClone(p);blocked.issues.push({code:'conflict',severity:'blocker',source_refs:[],detail:'test'});expect(()=>validateResolved(blocked,config)).toThrow('blockers');
  const bad=structuredClone(p);bad.events[0].films[0].position=3;expect(()=>validateResolved(bad,config)).toThrow('order');
  const local=disposableD1();try{await expect(applyLocal(local.db,p,true)).rejects.toThrow('member mismatch');local.sqlite.exec('DROP TABLE import_applied_entities');await expect(applyLocal(local.db,p,true)).rejects.toThrow('compatibility');}finally{local.sqlite.close();}
 });
 it('rolls back an event header if its ordered joins fail',async()=>{
  const local=disposableD1();try{local.sqlite.exec(readFileSync('worker/import-preview-members.sql','utf8'));local.sqlite.exec("CREATE TRIGGER fail_join BEFORE INSERT ON session_movies BEGIN SELECT RAISE(ABORT,'synthetic'); END");await expect(applyLocal(local.db,validateResolved(resolved(),config),true)).rejects.toThrow('batch failed');expect(local.sqlite.prepare('SELECT count(*) n FROM sessions').get()!.n).toBe(0);}finally{local.sqlite.close();}
 });
});
