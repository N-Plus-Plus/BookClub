import { useLayoutEffect, useMemo, useRef } from 'react';
import { classificationCategories, classificationDistribution, type MetricsEnrichment } from '../../shared/metrics-enrichment';
import type { Appearance } from '../../shared/metrics';

export function ClassificationChart({scopes,data}: {scopes:{label:string;rows:Appearance[]}[];data:MetricsEnrichment}) {
  const chart=useRef<HTMLElement>(null);
  const distributions=useMemo(()=>scopes.map(scope=>classificationDistribution(scope.rows,data)),[scopes,data]);
  useLayoutEffect(()=>{
    const labels=[...chart.current!.querySelectorAll<HTMLElement>('.metrics-segment-percentage')];
    const fit=()=>labels.forEach(label=>{label.dataset.fits=String(label.scrollWidth<=label.parentElement!.clientWidth);});
    fit();if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(fit);labels.forEach(label=>{observer.observe(label.parentElement!);observer.observe(label);});
    return ()=>observer.disconnect();
  },[distributions]);
  return <section ref={chart} className="stack metrics-classifications" data-metric="K"><h3>Australian classification</h3>
    <div className="metrics-stack-legend">{classificationCategories.map(category=><span key={category.id}><i aria-hidden="true" style={{background:`var(--${category.colour})`}} />{category.label}</span>)}</div>
    <div className="metrics-contributor-chart">{scopes.map((scope,index)=>{
      const distribution=distributions[index];
      return <div className="metrics-classification-row" key={scope.label}><strong>{scope.label}</strong>{distribution.total ? <div className="metrics-stack-bar" role="img" aria-label={`${scope.label}: ${distribution.segments.map(segment=>`${segment.label} ${segment.percentage.toFixed(1)}%`).join(', ')}`}>
        {distribution.segments.filter(segment=>segment.percentage>0).map(segment=><span key={segment.id} title={`${segment.label}: ${segment.percentage.toFixed(1)}%`} style={{width:`${segment.percentage}%`,background:`var(--${segment.colour})`,color:segment.colour==='asphalt'?'var(--paper)':'var(--surface-base)'}}>{segment.percentage>=5 && <span aria-hidden="true" className={`metrics-segment-percentage${segment.percentage<15?' metrics-segment-small':''}`}>{segment.percentage.toFixed(1)}%</span>}</span>)}
      </div>:<p className="meta">No film appearances.</p>}</div>;
    })}</div>
  </section>;
}
