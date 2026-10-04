import { createHash } from 'node:crypto';
import { rankMovie } from '../../shared/ranking.ts';
import type { Score, SeenAnswer } from '../../shared/types.ts';
import { ImportError } from './io.ts';
import { parseModel, rawPlanSchema, overridesSchema, resolvedPlanSchema, type Overrides, type ResolvedPlan } from './model.ts';
export const titleKey=(title:string)=>title.trim().normalize('NFC').toLocaleLowerCase('en');
export const stableId=(source:string,key:string)=>`import-${createHash('sha256').update(`${source}:${key}`).digest('hex').slice(0,24)}`;
export interface IdentityEvidence { source_refs:string[]; tmdb_id:string; title:string; year:number|null; imdb_id?:string|null; release_date?:string }
export function resolvePlan(input:unknown,overrideInput:unknown={version:1,assignments:[],seen:[]},evidence:IdentityEvidence[]=[]) {
  const raw=parseModel(rawPlanSchema,input,'Raw plan'), overrides=parseModel(overridesSchema,overrideInput,'Overrides');
  const records=raw.source_records.map(r=>({...r}));
  for(const a of overrides.assignments) if(a.canonical_year!==undefined) {
    if(!a.tmdb_id||!a.year_reason)throw new ImportError('Canonical year requires an explicit TMDB identity and owner reason.');
    for(const r of records.filter(r=>a.source_refs.includes(r.source_ref)))r.year=a.canonical_year;
  }
  const byRef=new Map(records.map(r=>[r.source_ref,r]));
  if(byRef.size!==records.length) throw new ImportError('Raw plan validation failed: duplicate source refs.');
  const parent=new Map(records.map(r=>[r.source_ref,r.source_ref]));
  const root=(ref:string):string=>{const p=parent.get(ref)!; if(p!==ref) parent.set(ref,root(p));return parent.get(ref)!;};
  const issues:ResolvedPlan['issues']=[];
  const issue=(code:string,refs:string[],detail:string,severity:'blocker'|'review'='blocker')=>{if(!issues.some(i=>i.code===code&&JSON.stringify(i.source_refs)===JSON.stringify(refs))) issues.push({code,severity,source_refs:refs,detail});};
  const assignments=new Map<string,Overrides['assignments'][number]>();
  const identityTmdb=new Map<string,string>();
  for(const a of overrides.assignments) {
    if(a.tmdb_id){if(identityTmdb.has(a.identity)&&identityTmdb.get(a.identity)!==a.tmdb_id)throw new ImportError('One override identity label maps to contradictory TMDB IDs.');identityTmdb.set(a.identity,a.tmdb_id);}
    for(const ref of a.source_refs) { if(!byRef.has(ref)) throw new ImportError('Override refers to an unknown source record.'); if(assignments.has(ref)) throw new ImportError('Override assigns a source record more than once.'); assignments.set(ref,a); }
    if(a.preferred_score_ref && (!a.source_refs.includes(a.preferred_score_ref)||!a.preferred_score_ref.startsWith('Should Watch:'))) throw new ImportError('Preferred score ref must be a candidate source in its assignment.');
  }
  const manuallySeparate=(a:string,b:string)=>assignments.has(a)&&assignments.has(b)&&assignments.get(a)!.identity!==assignments.get(b)!.identity&&!(assignments.get(a)!.tmdb_id&&assignments.get(a)!.tmdb_id===assignments.get(b)!.tmdb_id);
  const merge=(a:string,b:string,strict=false)=>{
    if(manuallySeparate(a,b)) { if(strict) throw new ImportError('Overrides separate records with the same verified external identity.'); return; }
    const left=records.filter(r=>root(r.source_ref)===root(a)),right=records.filter(r=>root(r.source_ref)===root(b));
    const imdb=new Set([...left,...right].map(r=>r.imdb_id).filter(Boolean));
    if(imdb.size>1) { if(strict) throw new ImportError('Override or TMDB evidence would merge different verified IMDb IDs.'); issue('EXTERNAL_ID_CONFLICT',[a,b],'Contradictory IMDb IDs prevent exact identity linking.');return; }
    const ra=root(a), rb=root(b); if(ra!==rb) parent.set([ra,rb].sort()[1],[ra,rb].sort()[0]);
  };
  for(const r of records) for(const other of records) if(r.source_ref<other.source_ref && r.imdb_id && r.imdb_id===other.imdb_id) {
    if(r.year!==null&&other.year!==null&&r.year!==other.year) issue('METADATA_CONFLICT',[r.source_ref,other.source_ref],'Same IMDb ID has contradictory years.');
    if(titleKey(r.title)!==titleKey(other.title)) issue('TITLE_METADATA_REVIEW',[r.source_ref,other.source_ref],'Same IMDb ID has differing source titles; verify alias evidence.','review');
    merge(r.source_ref,other.source_ref,true);
  }
  const titleGroups=new Map<string,typeof records>();
  for(const r of records) {const key=titleKey(r.title);titleGroups.set(key,[...titleGroups.get(key)??[],r]);}
  for(const group of titleGroups.values()) {
    for(const r of group) for(const other of group) if(r.source_ref<other.source_ref&&r.year!==null&&r.year===other.year) merge(r.source_ref,other.source_ref);
    const richer=group.filter(r=>r.year!==null||r.imdb_id!==null), roots=new Set(richer.map(r=>root(r.source_ref)));
    if(roots.size===1) for(const r of group.filter(r=>r.year===null&&!r.imdb_id)) merge(r.source_ref,richer[0].source_ref);
  }
  // Explicit private identity labels can merge title-only records or separate remakes.
  const labels=new Map<string,string>();
  for(const a of overrides.assignments) for(const ref of a.source_refs) for(const label of [`manual:${a.identity}`,...(a.tmdb_id?[`tmdb:${a.tmdb_id}`]:[])]) {
    if(labels.has(label)) merge(ref,labels.get(label)!,true);else labels.set(label,ref);
  }
  const attachments=new Map<string,IdentityEvidence>();
  for(const originalEvidence of evidence) for(const ref of originalEvidence.source_refs) {
    const decision=assignments.get(ref);
    const e=decision?.canonical_year!==undefined&&decision.tmdb_id===originalEvidence.tmdb_id?{...originalEvidence,year:decision.canonical_year}:originalEvidence;
    const r=byRef.get(ref);if(!r) throw new ImportError('Network evidence refers to an unknown source record.');
    if(r.imdb_id&&e.imdb_id&&r.imdb_id!==e.imdb_id) {issue('TMDB_IMDB_CONFLICT',[ref],'TMDB evidence contradicts the verified source IMDb ID.');continue;}
    if(r.year!==null&&e.year!==null&&r.year!==e.year) {issue('TMDB_YEAR_CONFLICT',[ref],'TMDB evidence contradicts the source year.');continue;}
    const a=assignments.get(ref);if(a?.tmdb_id&&a.tmdb_id!==e.tmdb_id) throw new ImportError('Override TMDB ID contradicts verified network evidence.');
    attachments.set(ref,e);const label=`tmdb:${e.tmdb_id}`;if(labels.has(label)) merge(ref,labels.get(label)!,true);else labels.set(label,ref);
  }
  const clusters=new Map<string,typeof records>();for(const r of records) {const key=root(r.source_ref);clusters.set(key,[...clusters.get(key)??[],r]);}
  const movieByRef=new Map<string,string>(), movies:ResolvedPlan['movies']=[];
  for(const group of clusters.values()) {
    const refs=group.map(r=>r.source_ref).sort(), id=stableId(raw.import_source,refs[0]);
    const rich=[...group].sort((a,b)=>Number(Boolean(b.imdb_id))-Number(Boolean(a.imdb_id))||Number(b.year!==null)-Number(a.year!==null)||a.source_ref.localeCompare(b.source_ref))[0];
    const verified=group.flatMap(r=>attachments.get(r.source_ref)?[attachments.get(r.source_ref)!]:[]);
    const imdbIds=new Set([...group.map(r=>r.imdb_id),...verified.map(e=>e.imdb_id)].filter((v):v is string=>Boolean(v)));
    const years=new Set([...group.map(r=>r.year),...verified.map(e=>e.year)].filter((v):v is number=>v!==null));
    if(imdbIds.size>1) issue('TMDB_IMDB_CONFLICT',refs,'Canonical cluster contains contradictory verified IMDb evidence.');
    if(years.size>1&&verified.length) issue('TMDB_YEAR_CONFLICT',refs,'Canonical cluster contains contradictory verified year evidence.');
    // Verified TMDB titles supersede historical wording; source records stay untouched.
    const imdb=group.find(r=>r.imdb_id)?.imdb_id??(imdbIds.size===1?[...imdbIds][0]:undefined);
    const attached=imdbIds.size<=1&&years.size<=1?verified[0]:undefined;
    const tmdbIds=new Set(group.flatMap(r=>[assignments.get(r.source_ref)?.tmdb_id,attachments.get(r.source_ref)?.tmdb_id]).filter((v):v is string=>Boolean(v)));
    if(tmdbIds.size>1) throw new ImportError('One verified source identity maps to contradictory TMDB IDs.');
    const tmdb=[...tmdbIds][0];
    const preferred=new Set(group.map(r=>assignments.get(r.source_ref)?.preferred_score_ref).filter(Boolean));if(preferred.size>1)throw new ImportError('Canonical movie has contradictory preferred legacy observations.');
    const ambiguous=group.some(r=>{const peers=titleGroups.get(titleKey(r.title))!;return peers.some(p=>root(p.source_ref)!==root(r.source_ref) && !manuallySeparate(p.source_ref,r.source_ref) && !(attachments.has(r.source_ref)&&attachments.has(p.source_ref)&&attachments.get(r.source_ref)!.tmdb_id!==attachments.get(p.source_ref)!.tmdb_id) && (r.year===null&&!r.imdb_id || p.year===null&&!p.imdb_id));});
    if(ambiguous) issue('AMBIGUOUS_TITLE',refs,'Exact title has multiple plausible source identities; assign each source explicitly.');
    movies.push({id,title:attached?.title??rich.title,year:attached?.year??rich.year,...(attached?.release_date?{tmdb_release_date:attached.release_date}:{}),external_ids:[...(imdb?[{provider:'imdb' as const,external_id:imdb}]:[]),...(tmdb?[{provider:'tmdb' as const,external_id:tmdb}]:[])],source_refs:refs,identity_status:ambiguous?'ambiguous':imdb||tmdb||group.some(r=>assignments.has(r.source_ref))?'confirmed':'provisional'});
    for(const ref of refs) movieByRef.set(ref,id);
  }
  const seenOverrides=new Map<string,number>();for(const s of overrides.seen) {
    if(!byRef.has(s.source_ref)||!s.source_ref.startsWith('Should Watch:')||!raw.members.includes(s.member_id)) throw new ImportError('Seen override has an unknown candidate or member.');
    const key=`${movieByRef.get(s.source_ref)}:${s.member_id}`;if(seenOverrides.has(key)) throw new ImportError('Multiple Seen overrides target one canonical answer.');seenOverrides.set(key,s.seen);
  }
  const classics:ResolvedPlan['classics']=[];
  for(const movie of movies) {
    const rows=raw.classics.filter(c=>movie.source_refs.includes(`Should Watch:${c.source_row}`));if(!rows.length) continue;
    const scores=rows.flatMap(c=>c.scores.map(s=>({...s,fetched_at:raw.snapshotCapturedAt,source_ref:`Should Watch:${c.source_row}`,source_ordinal:c.source_row,legacy_preferred:Number(assignments.get(`Should Watch:${c.source_row}`)?.preferred_score_ref===`Should Watch:${c.source_row}`)})));
    const seen:ResolvedPlan['classics'][number]['seen']=[];
    for(const member of raw.members) {
      const observations=rows.flatMap(c=>c.seen.filter(s=>s.member_id===member).map(s=>({...s,source_ref:`Should Watch:${c.source_row}`}))), answers=new Set(observations.map(s=>s.seen));
      const override=seenOverrides.get(`${movie.id}:${member}`);
      if(answers.size>1&&override===undefined) issue('SEEN_CONFLICT',observations.map(s=>s.source_ref),'Contradictory explicit Seen answers require a private answer override.');
      if(observations.length||override!==undefined) seen.push({member_id:member,seen:override??observations[0].seen,updated_at:raw.snapshotCapturedAt,source_refs:observations.map(s=>s.source_ref)});
    }
    for(const s of scores) if(scores.some(o=>o.provider===s.provider&&o.metric===s.metric&&o.raw_value!==s.raw_value)) issue('LEGACY_SCORE_CONFLICT',rows.map(c=>`Should Watch:${c.source_row}`),'Distinct observations retained; later row wins at tied capture time unless preferred privately.','review');
    const seen_observations=rows.flatMap(c=>c.seen.map(s=>({source_ref:`Should Watch:${c.source_row}`,member_id:s.member_id,seen:s.seen,observed_at:raw.snapshotCapturedAt})));
    classics.push({movie_id:movie.id,rank_seed:Math.min(...rows.map(c=>c.rank_seed)),source_refs:rows.map(c=>`Should Watch:${c.source_row}`),scores,seen,seen_observations});
  }
  const oldMovie=new Map(raw.movies.map(m=>[m.id,m]));
  const events=raw.events.map(e=>({...e,films:e.films.map(f=>{const ref=`Tracker:${f.source_row}:${f.source_column}`;if(!oldMovie.get(f.movie_id)?.source_refs.includes(ref)||!movieByRef.has(ref)) throw new ImportError('Raw event reference validation failed.');return {...f,movie_id:movieByRef.get(ref)!};})}));
  const members=raw.members.map((id,i)=>({id,display_name:`Host ${i+1}`,sort_order:i+1,active:1}));
  const canonicalWatchOrder=classics.map(c=>({c,r:rankMovie(c.scores.map(s=>({...s,fetched_at:s.fetched_at??''})) as Score[],c.seen.map(s=>({...s,updated_at:s.updated_at??''})) as SeenAnswer[],members,c.rank_seed)})).filter(x=>x.r.rankable&&x.r.eligible).sort((a,b)=>b.r.finalScore!-a.r.finalScore!||a.c.movie_id.localeCompare(b.c.movie_id)).slice(0,20).map(x=>movies.find(m=>m.id===x.c.movie_id)!.title);
  for(const d of raw.diagnostics.filter(d=>d.severity==='blocker')) if(!issues.some(i=>i.code==='METADATA_CONFLICT')) issue(d.code,[],d.detail);
  const plan=parseModel(resolvedPlanSchema,{version:2,schemaMigration:'0004_import_provenance.sql',import_source:raw.import_source,members:raw.members,snapshotCapturedAt:raw.snapshotCapturedAt,movies,cycles:raw.cycles,events,classics,issues,rawWatchOrder:raw.rawWatchOrder,canonicalWatchOrder,sourceCandidateRows:raw.classics.length},'Resolved plan');
  const report={before:{sourceRecords:records.length,proposedMovies:raw.movies.length,reconciliation:raw.reconciliation.reduce<Record<string,number>>((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{})},after:{canonicalMovies:movies.length,linkedSourceRecords:records.length-movies.length,confirmed:movies.filter(m=>m.identity_status==='confirmed').length,provisional:movies.filter(m=>m.identity_status==='provisional').length,ambiguous:movies.filter(m=>m.identity_status==='ambiguous').length,manualReviewClusters:new Set(movies.filter(m=>m.identity_status==='ambiguous').map(m=>titleKey(m.title))).size,blockers:issues.filter(i=>i.severity==='blocker').length,review:issues.filter(i=>i.severity==='review').length,canonicalClassics:classics.length,duplicateCandidateRowsCollapsed:raw.classics.length-classics.length},historicalWatchOrder:raw.rawWatchOrder,canonicalWatchOrder,differences:Array.from({length:Math.max(canonicalWatchOrder.length,raw.rawWatchOrder.computed.length)},(_,i)=>({rank:i+1,historical:raw.rawWatchOrder.computed[i]??null,canonical:canonicalWatchOrder[i]??null})).filter(d=>d.historical!==d.canonical),differencePolicy:'Duplicate collapse and corrected canonical source inputs may change current order; historical validation is retained separately.',issues};
  return {plan,report};
}
