import { formatCount } from '../../shared/format';
import { useMemo } from 'react';
import { genreColour, type Appearance } from '../../shared/metrics';
import { stackedProfile, type MetricsEnrichment, type Fact } from '../../shared/metrics-enrichment';
import { Bar } from '../MetricsVisuals';
const percentage = (n: number) => `${n.toFixed(1)}%`;
type Scope = {label:string;rows:Appearance[]};
export function Stacks({scopes,data,dimension,categories}: {scopes:Scope[];data:MetricsEnrichment;dimension:'language'|'classification';categories:Fact[]}) {
  const profiles=useMemo(()=>scopes.map(scope=>stackedProfile(scope.rows,data,dimension)),[scopes,data,dimension]);
  return <div className="stack"><div className="metrics-stack-legend">{categories.map(c => <span key={c.id}><i aria-hidden="true" style={{background:`var(--${c.id === 'Unknown' ? 'asphalt' : genreColour(c.id)})`}} />{c.label}</span>)}</div>{scopes.map((scope,index) => {
    const profile = profiles[index];
    const counts = categories.map(c => ({...c,count:c.id === 'Other' ? [...profile.counts].filter(([id]) => id !== 'Unknown' && !categories.some(category => category.id === id && id !== 'Other')).reduce((sum,[,count]) => sum+count,0) : profile.counts.get(c.id) ?? 0}));
    // Classification Other is an actual bucket, whereas language Other collects the remainder.
    if (dimension === 'classification') counts.find(c => c.id === 'Other')!.count = profile.counts.get('Other') ?? 0;
    return <div className="stack metrics-stacked-profile" key={scope.label}><strong>{scope.label}</strong>{counts.filter(c => dimension === 'classification' || c.count).map(c => <Bar key={c.id} label={c.label} value={percentage(c.count/Math.max(1,profile.total)*100)} width={c.count/Math.max(1,...counts.map(c => c.count))*100} colour={c.id === 'Unknown' ? 'asphalt' : genreColour(c.id)} detail={`${formatCount(c.count)} appearances`} />)}{!profile.total && <p className="meta">No film appearances.</p>}<p className="meta">{dimension === 'language' ? 'Non-English original language' : 'MA15+ / R18+'}: {profile.headline === null ? 'No known data' : percentage(profile.headline)}{dimension === 'classification' ? ' · among known classifications.' : ''}</p></div>;
  })}</div>;
}
