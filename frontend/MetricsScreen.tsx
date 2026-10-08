import { TopBottomMetrics } from './metrics/TopBottom';
import { GenreFingerprint } from './metrics/Fingerprints';
import { GeneralMetrics } from './metrics/General';
import { RatingsProfile } from './metrics/Averages';
import { ExtremesMetrics } from './metrics/Extremes';
import { useMemo, useState, useId } from 'react';

import { Filter } from 'lucide-react';
import type { Catalog, Viewer } from '../shared/types';
import { metricsCatalog, rankedMetricsAppearances, calculateMetrics, matchesMetricsFilter, selectedAppearances, contributorMetrics, metricsDashboard, type MetricsScoreDimension, type MetricsFilter } from '../shared/metrics';

import { ClubIdentity } from './ClubIdentity';
import { EnrichedMetrics, useMetricsEnrichment } from './EnrichedMetrics';

import { metricsTabs, type MetricsTab } from './metrics-tabs';
import { MetricsEnrichmentResource, useMetricsReports } from './metrics-cache';

function revealTab(button: HTMLButtonElement) {
  const strip = button.parentElement;
  if (!strip) return;
  const bounds = strip.getBoundingClientRect(), target = button.getBoundingClientRect();
  if (target.left < bounds.left) strip.scrollLeft += target.left-bounds.left;
  else if (target.right > bounds.right) strip.scrollLeft += target.right-bounds.right;
}

export function MetricsScreen({catalog:sourceCatalog,resource}: {catalog: Catalog; viewer: Viewer | null; onUpdated: () => Promise<void>;resource?:MetricsEnrichmentResource}) {
  const catalog=useMemo(()=>metricsCatalog(sourceCatalog),[sourceCatalog]);
  const [category,setCategory] = useState<MetricsTab>('top-bottom');
  const tabId = useId();
  const [filter,updateFilter] = useState<MetricsFilter>({kind: 'all'});
  const setFilter=(next:MetricsFilter)=>updateFilter(previous=>previous.kind === next.kind && (previous.kind !== 'member' || next.kind === 'member' && previous.memberId === next.memberId) ? previous : next);
  const [topDimension,setTopDimension] = useState<MetricsScoreDimension>('imdb');
  const [bottomDimension,setBottomDimension] = useState<MetricsScoreDimension>('imdb');
  const all = useMemo(() => selectedAppearances(catalog),[catalog]);
  const identities=useMetricsReports([catalog,all]);
  const rows=identities(`rows:${filter.kind === 'member' ? filter.memberId : filter.kind}`,()=>filter.kind === 'all' ? all : all.filter(row=>matchesMetricsFilter(row.session,filter)));
  const cached=useMetricsReports([catalog,all,rows]);
  const contributions=category === 'general' || category === 'fingerprints' ? identities('contributions',()=>contributorMetrics(catalog,all)) : [];
  const metrics=cached('metrics',()=>calculateMetrics(catalog,filter,{},rows));
  const topRows=category === 'top-bottom' ? cached(`top:${topDimension}`,()=>rankedMetricsAppearances(rows,topDimension,true)) : [];
  const bottomRows=category === 'top-bottom' ? cached(`bottom:${bottomDimension}`,()=>rankedMetricsAppearances(rows,bottomDimension,false)) : [];
  const dashboard=cached('dashboard',()=>metricsDashboard(rows,all));
  const enrichment=useMetricsEnrichment(resource);

  return <div className="stack metrics-content"><div className="metrics-filters" role="group" aria-label="Metrics identity filter"><button type="button" aria-pressed={filter.kind === 'all'} onClick={() => setFilter({kind: 'all'})}><Filter size={16} aria-hidden="true" />ALL</button>{catalog.members.filter(m => m.sort_order >= 1 && m.sort_order <= 4).sort((a,b) => a.sort_order-b.sort_order).map(member => <button type="button" key={member.id} aria-pressed={filter.kind === 'member' && filter.memberId === member.id} onClick={() => setFilter({kind: 'member',memberId: member.id})}><Filter size={12} className="metrics-filter-icon" aria-hidden="true" /><ClubIdentity identity={{kind: 'member',member}} /></button>)}<button type="button" aria-pressed={filter.kind === 'classics'} onClick={() => setFilter({kind: 'classics'})}><Filter size={12} className="metrics-filter-icon" aria-hidden="true" /><ClubIdentity identity={{kind: 'classics'}} /></button></div><div className="metrics-category-tabs" role="tablist" aria-label="Metrics categories">{metricsTabs.map((tab,index) => <button className="tab-control" type="button" key={tab.id} id={`${tabId}-tab-${tab.id}`} role="tab" aria-selected={category === tab.id} aria-controls={`${tabId}-panel`} tabIndex={category === tab.id ? 0 : -1} onClick={event => {setCategory(tab.id);revealTab(event.currentTarget);}} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index+1)%metricsTabs.length : event.key === 'ArrowLeft' ? (index+metricsTabs.length-1)%metricsTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? metricsTabs.length-1 : null;
      if (next === null) return;
      event.preventDefault(); setCategory(metricsTabs[next].id);
      const button = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
      button?.focus({preventScroll:true});
      if (button) revealTab(button);
    }}>{tab.label}</button>)}</div><div className="stack metrics-panel" role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-tab-${category}`} tabIndex={0}>
    {category === 'top-bottom' && <TopBottomMetrics catalog={catalog} rows={rows} dashboard={dashboard} topDimension={topDimension} bottomDimension={bottomDimension} setTopDimension={setTopDimension} setBottomDimension={setBottomDimension} topRows={topRows} bottomRows={bottomRows} />}
    {category === 'fingerprints' && <GenreFingerprint filter={filter} dashboard={dashboard} contributions={contributions} />}
    {category === 'general' && <GeneralMetrics dashboard={dashboard} metrics={metrics} contributions={contributions} />}
    {category === 'averages' && <RatingsProfile dashboard={dashboard} />}
    {category === 'extremes' && <ExtremesMetrics rows={rows} dashboard={dashboard} enrichment={enrichment} />}
    <EnrichedMetrics category={category} catalog={catalog} all={all} rows={rows} filter={filter} {...enrichment} />
    </div>
  </div>;
}
