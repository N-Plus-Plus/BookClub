import { useMemo } from 'react';
import type { Catalog } from '../../shared/types';
import type { Appearance } from '../../shared/metrics';
import { receptionExtremes, classicsViewed } from '../../shared/metrics-staging/numerical';
import { formatCount } from '../../shared/format';
import { MovieLink, Poster, FilmInformation } from '../components';
import { ClubIdentity } from '../ClubIdentity';
import { MetricsResults } from '../MetricsResults';
export function ReceptionRecords({rows}:{rows:Appearance[]}) {
  const reports=useMemo(()=>receptionExtremes(rows),[rows]);
  return <>{([{label:'Most aligned critics and audiences',report:reports.aligned},{label:'Most misaligned critics and audiences',report:reports.misaligned}]).map(({label,report})=><section className="stack metrics-reception-record" key={label}><h3>{label}</h3>{report?<><p className="meta">{formatCount(report.items.length)} tied films · {report.value.toFixed(1)} points absolute difference</p><MetricsResults label={label} items={report.items} pageSize={report.items.length>20?5:20} render={v=><MovieLink key={v.row.movie.id} movie={v.row.movie} className="movie-row metrics-reception-film"><Poster movie={v.row.movie} /><FilmInformation movie={v.row.movie}><span className="meta staging-block">Critics {v.critic.toFixed(1)} · Audiences {v.audience.toFixed(1)} / 100 · {v.gap.toFixed(1)} points{v.difference===0?' · Equal':v.difference>0?' · Audiences higher':' · Critics higher'}</span></FilmInformation></MovieLink>}/></>:<p className="meta">No films with both composites.</p>}</section>)}</>;
}
export function ClassicsViewedRecords({catalog}:{catalog:Catalog}) {
  const reports=useMemo(()=>classicsViewed(catalog),[catalog]);
  return <>{([{label:'Most Classics viewed',report:reports.most},{label:'Least Classics viewed',report:reports.least}]).map(({label,report})=><section className="stack metrics-viewed-record" key={label}><h3>{label}</h3>{report?<>{report.items.map(v=><div className="metrics-viewed-row" key={v.member.id}><ClubIdentity identity={{kind:'member',member:v.member}}/><strong>{formatCount(report.value)} viewed</strong></div>)}</>:<p className="meta">No fully answered Classics pool.</p>}</section>)}</>;
}
