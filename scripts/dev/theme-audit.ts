/** Offline aggregate-only diagnostic. Never calls providers or writes a persistent database. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { emptyEnrichmentMovie, themeKeywordAudit, type MetricsEnrichment } from '../../shared/metrics-enrichment';
import { selectedAppearances } from '../../shared/metrics';
import type { Movie, Session } from '../../shared/types';

const [mode,path,...extra] = process.argv.slice(2);
if (!path || extra.length || !['--sqlite','--snapshot'].includes(mode)) throw new Error('Usage: corepack pnpm exec tsx scripts/dev/theme-audit.ts --sqlite <local.sqlite> | --snapshot <offline.sql>');
const db = new DatabaseSync(mode === '--sqlite' ? path : ':memory:',{readOnly:mode === '--sqlite'});
try {
  if (mode === '--snapshot') {
    db.exec('PRAGMA foreign_keys=OFF');
    db.exec(readFileSync(path,'utf8'));
  }
  const data: MetricsEnrichment = {movies:{}};
  for (const row of db.prepare("SELECT movie_id,provider,name FROM movie_provider_keywords WHERE provider IN ('tmdb','mdblist')").all()) {
    const movie = data.movies[String(row.movie_id)] ??= emptyEnrichmentMovie();
    movie.keywords.push({provider:String(row.provider),name:String(row.name)});
  }
  // Only canonical identities and actual active appearances are needed for this diagnostic.
  // Other Movie fields are unused by theme analytics; private titles are never reported.
  const movies = new Map<string,Movie>();
  const sessions = new Map<string,Session>();
  for (const row of db.prepare('SELECT sm.movie_id,sm.position,s.id,s.event_date,s.kind,s.host_member_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL ORDER BY s.id,sm.position').all()) {
    const id = String(row.movie_id);
    if (!movies.has(id)) movies.set(id,{id,title:'',year:null,original_title:null,release_date:null,runtime:null,overview:null,genres:[],assets:[],external_ids:[],scores:[],seen:[],classic:false,ranking:null});
    const sessionId = String(row.id);
    const session: Session = sessions.get(sessionId) ?? {id:sessionId,event_date:String(row.event_date),kind:row.kind === 'classics' ? 'classics' : 'hosted',host_member_id:row.host_member_id === null ? null : String(row.host_member_id),date_precision:'exact',cycle_id:null,cycle_slot:null,legacy_cycle_label:null,movies:[]};
    session.movies.push(movies.get(id)!);sessions.set(sessionId,session);
  }
  const rows = selectedAppearances({movies:[...movies.values()],sessions:[...sessions.values()],members:[],cycles:[]});
  console.log(JSON.stringify(themeKeywordAudit(data,rows),null,2));
} finally { db.close(); }
