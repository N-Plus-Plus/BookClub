import type { Ranking } from '../shared/types';

import { detailRatingKeys, ratingDimensions } from '../shared/rating-dimensions';
const score100 = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? `${Math.round(value)}/100` : '-';
const integer = (value: number | null) => value !== null && Number.isFinite(value) ? Math.round(value).toLocaleString('en-AU') : '—';

export function DetailRankingScore({ranking}: {ranking: Ranking}) {
  const inputs = detailRatingKeys.map(key => {
    const {provider,metric,fullLabel:label,providerName:name} = ratingDimensions[key];
    const source = ranking.sources.find(score => score.provider === provider && score.metric === metric);
    const imputed = ranking.imputedScores.find(score => score.provider === provider && score.metric === metric);
    return {provider,metric,label,name,source,value:source?.value ?? imputed?.value,imputed:!source && imputed !== undefined && Number.isFinite(imputed.value)};
  });
  return <section className="stack detail-classics-score"><h2>Classics score</h2>
    <ul className="detail-rating-summary">{inputs.map(input => <li key={`${input.provider}:${input.metric}`}><span>{input.label}: </span><strong className="numeric">{input.source ? score100(input.source.value) : input.imputed ? '- (average used)' : '-'}</strong></li>)}</ul>
    <details className="detail-score-breakdown"><summary>Score breakdown</summary><div className="stack">
      <section className="breakdown"><h3>Scores</h3>{inputs.map(input => <p key={`${input.provider}:${input.metric}`}><span>{input.name} ({input.source ? input.metric : 'missing'})</span><strong className="numeric">{score100(input.value)}</strong></p>)}</section>
      <section className="breakdown"><h3>Modifiers</h3><p><span>Unseen multiplier</span><strong className="numeric">{Number.isFinite(ranking.unseenMultiplier) ? `${ranking.unseenMultiplier.toFixed(2)}x` : '—'}</strong></p></section>
      <section className="breakdown"><h3>Crunchy math</h3><p><span>Sum of Squares of Scores (SoSoS)</span><strong className="numeric">{integer(ranking.rawScore)}</strong></p><p><span>SoSoS × Modifiers (residual score)</span><strong className="numeric">{integer(ranking.residualScore)}</strong></p></section>
    </div></details>
  </section>;
}
