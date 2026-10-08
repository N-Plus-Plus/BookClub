import { useMemo } from 'react';
import type { Catalog } from '../../shared/types';
import type { Appearance } from '../../shared/metrics';
import { receptionExtremes, classicsViewed } from '../../shared/metrics-staging/numerical';
import { formatCount } from '../../shared/format';
import { MovieLink } from '../components';
import { ClubIdentity } from '../ClubIdentity';
import { MetricsResults } from '../MetricsResults';
export function ReceptionRecords({rows}:{rows:Appearance[]}) {
  const reports=useMemo(()=>receptionExtremes(rows),[rows]);
  return <>{([{label:'Most aligned critics and audiences',report:reports.aligned},{label:'Most misaligned critics and audiences',report:reports.misaligned}]).map(({label,report})=><section className="stack metrics-reception-record" key={label}><h3>{label}</h3>{report?<><p className="meta">{formatCount(report.items.length)} tied films · {report.value.toFixed(1)} points absolute difference</p><MetricsResults label={label} items={report.items} pageSize={report.items.length>20?5:20} render={v=><p key={v.row.movie.id}><MovieLink movie={v.row.movie}>{v.row.movie.title}</MovieLink><span className="meta staging-block">Critics {v.critic.toFixed(1)} · Audiences {v.audience.toFixed(1)} / 100 · {v.gap.toFixed(1)} points{v.difference===0?' · Equal':v.difference>0?' · Audiences higher':' · Critics higher'}</span></p>}/></>:<p className="meta">No films with both composites.</p>}</section>)}</>;
}
export function ClassicsViewedRecords({catalog}:{catalog:Catalog}) {
  const reports=useMemo(()=>classicsViewed(catalog),[catalog]);
  return <>{([{label:'Most Classics viewed',report:reports.most},{label:'Least Classics viewed',report:reports.least}]).map(({label,report})=><section className="stack metrics-viewed-record" key={label}><h3>{label}</h3><p className="meta">All four human members · {formatCount(reports.pool)} fully answered canonical Classic candidates</p>{report?<><strong>{formatCount(report.value)} viewed · {formatCount(report.items.length)} tied members</strong>{report.items.map(v=><ClubIdentity key={v.member.id} identity={{kind:'member',member:v.member}}/>)}</>:<p className="meta">No fully answered Classics pool.</p>}</section>)}</>;
}
