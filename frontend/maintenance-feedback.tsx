import { formatCount } from '../shared/format';
import { formatRetryDuration } from './retry-duration';
import type { ProviderResult, RefreshResult } from '../shared/types';

export function bulkScoreSummary(results: RefreshResult[]) {
  const providers = results.flatMap(result => result.providers);
  return {
    processed: results.length,
    updated: results.filter(result => result.providers.some(provider => provider.status === 'success' && provider.count > 0)).length,
    noChange: results.filter(result => !result.providers.some(provider => provider.count > 0)).length,
    failedFilms: results.filter(result => result.providers.some(provider => provider.status === 'failed')).length,
    failures: providers.filter(provider => provider.status === 'failed').length,
    skipped: providers.filter(provider => provider.status === 'skipped').length,
  };
}

export function ProviderFeedback({providers}: {providers: (ProviderResult & {filmTitle?: string})[]}) {
  const notes = [...new Set(providers.map(provider => `${provider.filmTitle ? `${provider.filmTitle} · ` : ''}${provider.provider} · ${provider.status}: ${provider.message}${provider.count > 0 ? ` ${formatCount(provider.count)} scores captured.` : ''}${provider.retryAfter !== undefined ? ` Wait ${formatRetryDuration(provider.retryAfter)} before retrying.` : ''}`))];
  return <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul>;
}

export function BulkScoreFeedback({result}: {result: {results: RefreshResult[]; remaining: number; unidentified: number}}) {
  const summary = bulkScoreSummary(result.results);
  return <div role="status" className="stack"><strong>Bulk score enrichment result</strong><ul>
    <li>Films processed: {formatCount(summary.processed)} · With scores captured: {formatCount(summary.updated)}</li>
    <li>Films with no new scores: {formatCount(summary.noChange)} · Provider checks skipped: {formatCount(summary.skipped)}</li>
    <li>Provider failures: {formatCount(summary.failures)} · Films affected: {formatCount(summary.failedFilms)}</li>
    <li>Identifiable films remaining: {formatCount(result.remaining)} · Need identification: {formatCount(result.unidentified)}</li>
  </ul><ProviderFeedback providers={result.results.flatMap(item => item.providers).filter(provider => provider.status !== 'success' || provider.count === 0)} /></div>;
}
