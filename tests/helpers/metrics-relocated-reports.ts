import { createElement, Fragment } from 'react';
import { CycleReport, SpreadReports, LeaningReport } from '../../frontend/metrics/staging/Core';
import { OverlapReport } from '../../frontend/metrics/staging/Overlap';
import { SharedStarsReport, PartnershipsReport, GenreRevenueReport, FlopsReport, ClassificationAcclaimReport, PlatformsReport, CollectionReports, AwardsReport, type EvidenceProps } from '../../frontend/metrics/staging/Evidence';
/** Isolated report composition for existing calculation/presentation fixtures. Destination coverage uses MetricsScreen. */
export function RelocatedReports(props:EvidenceProps) {
 return createElement(Fragment,null,
  createElement(CycleReport,props),createElement(SpreadReports,props),createElement(LeaningReport,props),
  createElement(OverlapReport,{...props,kind:'genres'}),createElement(OverlapReport,{...props,kind:'themes'}),
  ...[SharedStarsReport,PartnershipsReport,GenreRevenueReport,FlopsReport,ClassificationAcclaimReport,PlatformsReport,CollectionReports,AwardsReport].map((component,index)=>createElement(component,{...props,key:index})));
}
