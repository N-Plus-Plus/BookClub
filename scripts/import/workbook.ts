import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { rankMovie } from '../../shared/ranking.ts';
import type { Score, SeenAnswer, Member } from '../../shared/types.ts';

import { configSchema, type ImportConfig } from './config.ts';
export { configSchema, type ImportConfig } from './config.ts';
export type Diagnostic = {code: string; severity: 'info'|'warning'|'review'|'blocker'; sheet: string; row?: number; column?: number; detail: string};
type Film = {id: string; title: string; year: number | null; external_ids: {provider: string; external_id: string}[]; source_refs: string[]; provisional: boolean};
export function cellValue(cell: ExcelJS.Cell): unknown {
  // ExcelJS exposes the master value on every merged follower; followers are blank source cells.
  if (cell.isMerged && cell.master.address !== cell.address) return null;
  const value = cell.value;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return value.result;
    if ('text' in value) return value.text;
    if ('richText' in value) return value.richText.map(t => t.text).join('');
    return null;
  }
  return value;
}
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : String(value);
const titleKey = (title: string) => title.trim().toLocaleLowerCase('en');
const stableId = (source: string, key: string) => `legacy-${createHash('sha256').update(`${source}:${key}`).digest('hex').slice(0,24)}`;
function roughDate(value: unknown, date1904: boolean): string | null {
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString().slice(0,10);
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(Date.UTC(date1904 ? 1904 : 1899,date1904 ? 0 : 11,date1904 ? 1 : 30)+Math.floor(value)*86400000).toISOString().slice(0,10);
  if (typeof value !== 'string') return null;
  const raw = value.trim(), iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/), local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const result = iso ? raw : local ? `${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}` : null;
  if (!result) return null;
  const d = new Date(`${result}T00:00:00Z`); return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10) === result ? result : null;
}
function number(value: unknown, max: number): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value.trim()))) return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export function analyseWorkbook(workbook: ExcelJS.Workbook, rawConfig: unknown) {
  const config = configSchema.parse(rawConfig);
  const sheets = ['Tracker','Should Watch','Watch Order','Sheet2'].map(name => {
    const sheet = workbook.getWorksheet(name); if (!sheet) throw new Error(`Missing required sheet: ${name}`); return sheet;
  });
  const [tracker,candidates,watch,helper] = sheets;
  const diagnostics: Diagnostic[] = [];
  const report = (code: string,sheet: string,detail: string,row?: number,column?: number) => {
    const severity = ['EXTERNAL_ID_METADATA_CONFLICT'].includes(code) ? 'blocker' : ['DUPLICATE_TITLE','DUPLICATE_EXTERNAL_ID','INVALID_YEAR','INVALID_IMDB_URL','WATCH_ORDER_MISMATCH'].includes(code) ? 'review' : ['WHITESPACE_NORMALISED','UNCACHED_FORMULA','UNKNOWN_CAPTURE_TIMESTAMP','RATING_UNAVAILABLE','EXPECTED_UNKNOWN_SEEN'].includes(code) ? 'info' : 'warning';
    diagnostics.push({code,severity,sheet,row,column,detail});
  };
  // Validate positional layout without recording private host header names.
  if (!/title/i.test(text(cellValue(candidates.getCell('A1')))) || !/imdb/i.test(text(cellValue(candidates.getCell('B1'))))
    || !/audience/i.test(text(cellValue(candidates.getCell('C1')))) || !/tomato/i.test(text(cellValue(candidates.getCell('D1'))))) throw new Error('Unrecognised Should Watch layout.');
  if (!/classic/i.test(text(cellValue(tracker.getCell('F1')))) || !/not.*book.*club/i.test(text(cellValue(tracker.getCell('G1'))))) throw new Error('Unrecognised Tracker layout.');
  const movies: Film[] = [], cycles: {id: string; ordinal: number; rough_date: string; import_key: string; source_row: number}[] = [];
  const source_records: {source_ref: string; title: string; year: number|null; imdb_id: string|null}[] = [];
  const events: {id: string; cycle_id: string; event_date: string; date_precision: 'exact'|'cycle_rough'; kind: 'hosted'|'classics'; host_member_id: string | null; cycle_slot: number; import_key: string; films: {movie_id: string; position: number; source_row: number; source_column: number}[]}[] = [];
  const ancillary: {row: number; title: string}[] = [];
  const classics: {movie_id: string; rank_seed: number; source_row: number; needs_identification: boolean; scores: Score[]; seen: SeenAnswer[]; ranking: ReturnType<typeof rankMovie>}[] = [];
  const reconciliation: {status: 'confidently-linked'|'probable/manual-review'|'duplicate/conflict'|'unresolved'; movie_ids: string[]; reason: string; rows?: number[]}[] = [];
  const members: Member[] = config.memberIds.map((id,i) => ({id,display_name: `Host ${i+1}`,sort_order: i+1,active: 1}));
  const addFilm = (title: string,key: string,year: number | null = null,imdb?: string): Film => {
    source_records.push({source_ref: key,title,year,imdb_id: imdb ?? null});
    // Only verified, syntactically valid provider IDs link automatically. Titles never do.
    const known = imdb ? movies.find(m => m.external_ids.some(e => e.provider === 'imdb' && e.external_id === imdb)) : undefined;
    if (known) {
      if (year !== null && known.year !== null && known.year !== year) report('EXTERNAL_ID_METADATA_CONFLICT','Should Watch',`Same IMDb ID has conflicting years`,Number(key.split(':').at(-1)));
      known.source_refs.push(key); reconciliation.push({status: 'confidently-linked',movie_ids: [known.id],reason: 'Identical verified-format IMDb ID; source rows retained.'}); return known;
    }
    const film: Film = {id: stableId(config.importSource,key),title,year,external_ids: imdb ? [{provider: 'imdb',external_id: imdb}] : [],source_refs: [key],provisional: !imdb}; movies.push(film); return film;
  };
  const cleanTitle = (value: unknown,sheet: string,row: number,column: number) => {
    const raw = text(value); const clean = raw.trim();
    if (clean !== raw) report('WHITESPACE_NORMALISED',sheet,'Trimmed surrounding title whitespace.',row,column);
    if (clean.length > 300) throw new Error(`Title exceeds supported length at ${sheet} row ${row}.`);
    return clean;
  };
  let cycle: typeof cycles[number] | undefined;
  for (let row=2;row<=tracker.rowCount;row++) {
    const a = cellValue(tracker.getCell(row,1));
    if (a !== null && a !== undefined && text(a).trim() !== '') {
      const date = roughDate(a,Boolean(workbook.properties.date1904)); if (!date) throw new Error(`Invalid cycle date at Tracker row ${row}.`);
      cycle = {id: stableId(config.importSource,`Tracker:cycle:${row}`),ordinal: cycles.length+1,rough_date: date,import_key: `Tracker:cycle:${row}`,source_row: row}; cycles.push(cycle);
    }
    for (let col=2;col<=7;col++) {
      const title = cleanTitle(cellValue(tracker.getCell(row,col)),'Tracker',row,col); if (!title) continue;
      if (col === 7) { ancillary.push({row,title}); continue; }
      if (!cycle) throw new Error(`Film before first cycle at Tracker row ${row}.`);
      let event = events.find(e => e.cycle_id === cycle!.id && e.cycle_slot === col-1);
      if (!event) { const key = `Tracker:event:${cycle.source_row}:${col}`; event = {id: stableId(config.importSource,key),cycle_id: cycle.id,event_date: cycle.rough_date,date_precision: col === 2 ? 'exact' : 'cycle_rough',kind: col === 6 ? 'classics' : 'hosted',host_member_id: col === 6 ? null : config.memberIds[col-2],cycle_slot: col-1,import_key: key,films: []}; events.push(event); }
      const movie = addFilm(title,`Tracker:${row}:${col}`);
      event.films.push({movie_id: movie.id,position: event.films.length+1,source_row: row,source_column: col});
    }
  }
  if (!cycles.length) throw new Error('Tracker contains no recognised cycles.');
  const hasCached = (s: ExcelJS.Worksheet,row: number,col: number) => {
    const v = s.getCell(row,col).value;
    if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v) && !('result' in v)) report('UNCACHED_FORMULA',s.name,'Formula has no cached result; formulas are never executed.',row,col);
  };
  let scored = 0, titleOnly = 0;
  for (let row=2;row<=candidates.rowCount;row++) {
    const title = cleanTitle(cellValue(candidates.getCell(row,1)),'Should Watch',row,1); if (!title) continue;
    const yearValue = cellValue(candidates.getCell(row,14)), year = number(yearValue,2200);
    if (yearValue != null && text(yearValue).trim() && (year === null || !Number.isInteger(year) || year < 1870)) report('INVALID_YEAR','Should Watch','Year requires review.',row,14);
    const url = text(cellValue(candidates.getCell(row,13))).trim();
    let imdb: string | undefined;
    try { const parsed = new URL(url); if (/^(www\.)?imdb\.com$/i.test(parsed.hostname)) imdb = parsed.pathname.match(/^\/title\/(tt\d{7,10})(?:\/|$)/)?.[1]; } catch { /* Report malformed URLs below. */ }
    if (url && !imdb) report('INVALID_IMDB_URL','Should Watch','No verified-format IMDb title URL.',row,13);
    const movie = addFilm(title,`Should Watch:${row}`,year !== null && Number.isInteger(year) && year >= 1870 ? year : null,imdb);
    const scores: Score[] = [];
    for (const [col,provider,metric,scale] of [[2,'imdb','rating',100],[3,'rottentomatoes','audience',100],[4,'rottentomatoes','critic',100],[15,'metacritic','critic',100],[16,'letterboxd','rating',100]] as const) {
      hasCached(candidates,row,col); const value = cellValue(candidates.getCell(row,col)), rating = number(value,scale);
      if ((col === 15 || col === 16) && text(value).trim().toUpperCase() === 'N/A') { report('RATING_UNAVAILABLE','Should Watch',`${provider}:${metric} explicitly unavailable.`,row,col); continue; }
      if (rating !== null) scores.push({provider,metric,raw_value: rating,raw_scale: scale,normalized_value: rating,vote_count: null,fetched_at: config.snapshotCapturedAt ?? '',retrieved_via: 'legacy-spreadsheet'});
      else if (value != null && text(value).trim()) report('INVALID_RATING','Should Watch',`Invalid ${provider}:${metric} source rating.`,row,col);
    }
    const onlyTitle = Array.from({length: 15},(_,i) => cellValue(candidates.getCell(row,i+2))).every(v => v == null || text(v).trim() === '');
    const seen: SeenAnswer[] = [];
    for (let col=6;col<=9;col++) {
      const raw = text(cellValue(candidates.getCell(row,col))), answer = raw.trim().toLowerCase();
      if (raw !== raw.trim()) report('WHITESPACE_NORMALISED','Should Watch','Trimmed surrounding Seen whitespace.',row,col);
      if (answer === 'yes' || answer === 'no') seen.push({member_id: config.memberIds[col-6],seen: answer === 'yes' ? 1 : 0,updated_at: config.snapshotCapturedAt ?? ''});
      else { report(onlyTitle ? 'EXPECTED_UNKNOWN_SEEN' : 'UNKNOWN_SEEN','Should Watch',answer ? 'Unrecognised Seen answer preserved as Unknown.' : 'Missing answer preserved as Unknown.',row,col); }
    }
    const ranking = rankMovie(scores,seen,members,row);
    const helperTitle = text(cellValue(candidates.getCell(row,12))).trim();
    if (helperTitle && titleKey(helperTitle) !== titleKey(title)) report('HELPER_TITLE_MISMATCH','Should Watch','Helper title differs from candidate; source title preserved.',row,12);
    if (ranking.rankable) scored++;
    if (onlyTitle) titleOnly++; else if (!ranking.rankable) report('INCOMPLETE_SCORES','Should Watch',ranking.missingRequiredScores.join(', '),row);
    // Legacy J is COUNTIF(No), the exponent, despite its "Unseen Multi" heading.
    for (const [col,expected] of [[5,ranking.rawScore],[10,ranking.unseenCount],[11,ranking.finalScore]] as const) {
      hasCached(candidates,row,col); const v = cellValue(candidates.getCell(row,col)); if (v == null || text(v).trim() === '') continue;
      const stored = typeof v === 'number' ? v : /^-?\d+(\.\d+)?$/.test(text(v).trim()) ? Number(v) : NaN;
      if (!Number.isFinite(stored)) report('MALFORMED_HELPER','Should Watch','Helper cell is not a numeric cached value.',row,col);
      else if (expected !== null && Math.abs(stored-expected) > 0.001) report('SCORE_MISMATCH','Should Watch',`Stored ${stored}; recomputed ${expected}.`,row,col);
    }
    classics.push({movie_id: movie.id,rank_seed: row,source_row: row,needs_identification: !imdb,scores,seen,ranking});
  }
  const rowsByTitle = new Map<string,typeof classics>();
  for (const movie of movies) {
    const linked = classics.filter(c => c.movie_id === movie.id);
    if (linked.length > 1) {
      report('DUPLICATE_EXTERNAL_ID','Should Watch','ID-linked rows retain separate memberships/seeds. Review scores and Seen conflicts before apply.',linked[0].source_row);
      reconciliation.push({status: 'duplicate/conflict',movie_ids: [movie.id],rows: linked.map(c => c.source_row),reason: 'Same external ID with multiple membership rows. Select membership seed and reconcile snapshots/answers explicitly before apply.'});
    }
  }
  for (const c of classics) { const key = titleKey(movies.find(m => m.id === c.movie_id)!.title); rowsByTitle.set(key,[...rowsByTitle.get(key) ?? [],c]); }
  for (const group of rowsByTitle.values()) if (group.length > 1) {
    const conflicting = new Set(group.map(c => JSON.stringify(c.scores.map(s => [s.provider,s.metric,s.raw_value])))).size > 1;
    reconciliation.push({status: 'duplicate/conflict',movie_ids: group.map(c => c.movie_id),rows: group.map(c => c.source_row),reason: conflicting ? 'Duplicate title with conflicting captured ratings. No title-based merge.' : 'Duplicate title; no title-based merge.'});
    report('DUPLICATE_TITLE','Should Watch',conflicting ? 'Conflicting source scores require review.' : 'Duplicate title requires review.',group[0].source_row);
  }
  const movieGroups = new Map<string,Film[]>();
  for (const m of movies) { const k = titleKey(m.title); movieGroups.set(k,[...movieGroups.get(k) ?? [],m]); }
  for (const group of movieGroups.values()) {
    if (group.length > 1) reconciliation.push({status: 'probable/manual-review',movie_ids: group.map(m => m.id),reason: 'Exact normalised title overlap; year where available is only a suggestion. No automatic merge.'});
    else if (group[0].provisional) reconciliation.push({status: 'unresolved',movie_ids: [group[0].id],reason: 'Title-only identity requires review or explicit resolution.'});
  }
  const expectedWatch = [] as string[];
  // Find title column by header, avoiding cached scores/rank columns.
  let watchTitleColumn = /^#?1$/.test(text(cellValue(watch.getCell(1,1))).trim()) && watch.columnCount >= 2 ? 2 : 1;
  let watchStartRow = watchTitleColumn === 2 ? 1 : 2;
  for (let col=1;col<=watch.columnCount;col++) if (/^(title|film|movie)$/i.test(text(cellValue(watch.getCell(1,col))).trim())) watchTitleColumn = col;
  for (let row=watchStartRow;row<=watch.rowCount && expectedWatch.length<20;row++) {
    hasCached(watch,row,watchTitleColumn); const title = text(cellValue(watch.getCell(row,watchTitleColumn))).trim(); if (title) expectedWatch.push(title);
  }
  const computed = classics.filter(c => c.ranking.rankable && c.ranking.eligible).sort((a,b) => b.ranking.finalScore!-a.ranking.finalScore!).slice(0,20)
    .map(c => movies.find(m => m.id === c.movie_id)!.title);
  const differences = Array.from({length: Math.max(expectedWatch.length,computed.length)},(_,i) => ({rank: i+1,expected: expectedWatch[i] ?? null,computed: computed[i] ?? null})).filter(d => d.expected !== d.computed);
  if (differences.length) report('WATCH_ORDER_MISMATCH','Watch Order',`${differences.length} top-20 positions differ.`);
  if (new Set(expectedWatch.map(titleKey)).size !== expectedWatch.length) report('WATCH_ORDER_DUPLICATE','Watch Order','Duplicate titles in verification order.');
  const ties = classics.filter(c => c.ranking.rankable).filter((c,i,list) => list.some((other,j) => i!==j && c.ranking.finalScore === other.ranking.finalScore)).map(c => c.source_row);
  if (ties.length) report('RANK_TIE','Should Watch','Residual scores tie despite row seeds.');
  const trackerTitles = new Set(movies.filter(m => m.source_refs.some(ref => ref.startsWith('Tracker:'))).map(m => titleKey(m.title)));
  const helperTitles = [] as {row: number; title: string}[];
  for (let row=2;row<=helper.rowCount;row++) { const title = text(cellValue(helper.getCell(row,1))).trim(); if (title) helperTitles.push({row,title}); }
  const helperUnmatched = helperTitles.filter(h => !trackerTitles.has(titleKey(h.title)));
  const counts = {cycles: cycles.length,hostedEvents: events.filter(e => e.kind === 'hosted').length,hostedAppearances: events.filter(e => e.kind === 'hosted').reduce((n,e) => n+e.films.length,0),
    classicsEvents: events.filter(e => e.kind === 'classics').length,classicsAppearances: events.filter(e => e.kind === 'classics').reduce((n,e) => n+e.films.length,0),events: events.length,appearances: events.reduce((n,e) => n+e.films.length,0),scoredCandidates: scored,titleOnlyCandidates: titleOnly,candidates: classics.length,ancillaryTitles: ancillary.length,helperTitles: helperTitles.length};
  const expectedCounts = {cycles: 55,hostedEvents: 220,hostedAppearances: 406,classicsEvents: 30,classicsAppearances: 59,events: 250,appearances: 465,scoredCandidates: 373,titleOnlyCandidates: 254,candidates: 627};
  for (const [key,expected] of Object.entries(expectedCounts)) if (counts[key as keyof typeof counts] !== expected) report('SNAPSHOT_COUNT_DRIFT','workbook',`${key}: expected ${expected}; found ${counts[key as keyof typeof counts]}. Review snapshot growth or omissions.`);
  for (const c of cycles) if (events.filter(e => e.cycle_id === c.id && e.kind === 'hosted').length !== 4) report('INCOMPLETE_CYCLE','Tracker','Cycle does not have all four hosted slots.',c.source_row);
  if (!config.snapshotCapturedAt) report('UNKNOWN_CAPTURE_TIMESTAMP','Should Watch','Historical retrieval time is unknown. Plan preserves null; apply must choose an explicit bootstrap capture policy.');
  // Keep each legacy row's seed/scores/answers even when an external ID confidently links it.
  const plan = {version: 1,dryRun: true,import_source: config.importSource,members: config.memberIds,cycles,events,movies,source_records,snapshotCapturedAt: config.snapshotCapturedAt ?? null,diagnostics,rawWatchOrder: {exactMatch: expectedWatch.length > 0 && differences.length === 0,computed},
    classics: classics.map(({ranking: _ranking,...c}) => ({...c,scores: c.scores.map(s => ({...s,fetched_at: s.fetched_at || null,import_key: `Should Watch:${c.source_row}:${s.provider}:${s.metric}`})),seen: c.seen.map(s => ({...s,updated_at: s.updated_at || null}))})),reconciliation};
  const summary = {counts,diagnostics,reconciliation,watchOrder: {exactMatch: expectedWatch.length > 0 && differences.length === 0,expected: expectedWatch,computed,differences,tieRows: ties},ancillary,helper: {overlap: helperTitles.length-helperUnmatched.length,unmatched: helperUnmatched}};
  return {plan,summary};
}
export function markdownReport(result: ReturnType<typeof analyseWorkbook>) {
  const {summary} = result;
  const counts = summary.diagnostics.reduce<Record<string,number>>((a,d) => { a[d.code]=(a[d.code] ?? 0)+1; return a; },{});
  return `# Spreadsheet dry-run\n\nNo database writes or network lookups performed. Private local report.\n\n## Summary\n\n- Structural validation: parsed; ${counts.SNAPSHOT_COUNT_DRIFT ?? 0} count differences\n- Watch Order: ${summary.watchOrder.exactMatch ? 'Exact top-20 match' : 'Review differences'}\n- Blockers: ${summary.diagnostics.filter(d=>d.severity==='blocker').length}\n- Review items: ${summary.diagnostics.filter(d=>d.severity==='review').length}\n- Informational cleanup: ${summary.diagnostics.filter(d=>d.severity==='info').length}\n\n## Counts\n\n${Object.entries(summary.counts).map(([k,v]) => `- ${k}: ${v}`).join('\n')}\n\n## Diagnostic totals\n\n${Object.entries(counts).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\n## Review and warnings\n\n${summary.diagnostics.filter(d=>d.severity!=='info').map(d => `- [${d.severity}] ${d.code} — ${d.sheet}${d.row ? ` row ${d.row}` : ''}${d.column ? ` column ${d.column}` : ''}: ${d.detail}`).join('\n')}\n\nRow-level informational evidence and private identity suggestions remain in report.json. Historical helper mismatches can reflect corrected whitespace defects; they do not block canonical inputs.\n`;
}
