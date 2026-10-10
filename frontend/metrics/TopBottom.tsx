import type { ReactNode } from 'react';
import { genreCombinations } from '../../shared/metrics-staging/overlap';
import { DiscoveryRankings } from './Discoveries';
import { formatCount } from '../../shared/format';
import type { Appearance, MetricsScoreCategory, PopularityMeasure, RankedAppearance, PopularAppearance } from '../../shared/metrics';
import { catalogIndex } from '../../shared/catalog-index';
import { dateLabel, FilmInformation, MovieLink, Poster } from '../components';
import { formatScore100 } from '../presentation';
import { ClubIdentity } from '../ClubIdentity';
import { Bar } from '../MetricsVisuals';
import { MetricsResults } from '../MetricsResults';
import { nonEnglishLanguageRankings, productionCountryRankings, revenueRatioRankings, talentRoles, type fingerprint } from '../../shared/metrics-enrichment';
import type { CatalogMetricsProps, EnrichedReportProps } from './report-types';
import type { Catalog } from '../../shared/types';

const scoreCategories = [{id:'critic',label:'Critics'},{id:'audience',label:'Audience'}] as const;
const voteMeasures = [{id:'imdb',label:'IMDb'},{id:'audience',label:'All audiences'}] as const;
const countLabel = (value: number) => Number.isInteger(value) ? formatCount(value) : value.toLocaleString('en-AU');

function MetricsFilmRow({catalog,row,value}: {catalog:Catalog;row:Appearance;value:string}) {
  const index = catalogIndex(catalog);
  const host = index.memberById.get(row.session.host_member_id ?? '');
  const cycle = index.cycleById.get(row.session.cycle_id ?? '');
  return <MovieLink movie={row.movie} className="metrics-film-item">
    <Poster movie={row.movie} />
    <FilmInformation movie={row.movie}>
      <p className="meta">{row.session.date_precision === 'exact' && !cycle?.import_source && !cycle?.import_key ? `${dateLabel(row.session.event_date)} · ` : ''}{cycle ? `Cycle ${cycle.ordinal} · ` : ''}Film {row.position}</p>
      <strong className="metrics-film-value">{value}</strong>
    </FilmInformation>
    <div className="metrics-film-host">{row.session.kind === 'classics' ? <ClubIdentity identity={{kind:'classics'}} /> : host ? <ClubIdentity identity={{kind:'member',member:host}} /> : <span className="meta">Host unknown</span>}</div>
  </MovieLink>;
}

export function TopBottomMetrics({catalog,dashboard,topDimension,bottomDimension,setTopDimension,setBottomDimension,topRows,bottomRows,popularMeasure,setPopularMeasure,obscureMeasure,setObscureMeasure}: Pick<CatalogMetricsProps,'catalog'|'rows'|'dashboard'|'topDimension'|'bottomDimension'|'setTopDimension'|'setBottomDimension'|'topRows'|'bottomRows'> & {popularMeasure:PopularityMeasure;obscureMeasure:PopularityMeasure;setPopularMeasure:(measure:PopularityMeasure)=>void;setObscureMeasure:(measure:PopularityMeasure)=>void}) {
  const popularityList = (direction:'popular'|'obscure',popularityMeasure:PopularityMeasure,setPopularityMeasure:(measure:PopularityMeasure)=>void) => {
    const voteUnits = popularityMeasure === 'imdb' ? 'IMDb votes' : 'audience votes';
    const voteLabel = popularityMeasure === 'imdb' ? 'IMDb' : 'All audiences';
    const popularity = popularityMeasure === 'imdb' ? dashboard.popularity : dashboard.audiencePopularity;
    const items:PopularAppearance[] = popularity[direction];
    return <section className="stack">
    <div className="metrics-report-heading"><h2>Top 5 most {direction} · {voteLabel}</h2><div className="metrics-score-filters" role="group" aria-label={`Most ${direction} vote filter`}>{voteMeasures.map(d => <button className="tab-control" type="button" key={d.id} aria-pressed={popularityMeasure === d.id} onClick={() => setPopularityMeasure(d.id)}>{d.label}</button>)}</div></div>
    {items.length ? <ol className="metrics-list metrics-popularity-list">{items.map(row => <li key={row.movie.id}><MetricsFilmRow catalog={catalog} row={row} value={`${countLabel(row.votes)} ${voteUnits}`} /></li>)}</ol> : <p className="meta">No {popularityMeasure === 'imdb' ? 'IMDb' : 'audience'} vote data for this selection.</p>}
  </section>;
  };
  const list = (direction:'Top'|'Bottom',id:MetricsScoreCategory,setDimension:(id:MetricsScoreCategory)=>void,rows:RankedAppearance[]) => <section className="stack" data-metric={direction === 'Top' ? 'U' : 'V'}>
    <div className="metrics-report-heading"><h2>Top 5 {direction === 'Top' ? 'highest' : 'lowest'} {id === 'critic' ? 'critic' : 'audience'} scores</h2><div className="metrics-score-filters" role="group" aria-label={`${direction} 5 score filter`}>{scoreCategories.map(d => <button className="tab-control" type="button" key={d.id} aria-pressed={id === d.id} onClick={() => setDimension(d.id)}>{d.label}</button>)}</div></div>
    {rows.length ? <ol className="metrics-list">{rows.map(row => <li key={`${row.session.id}:${row.position}`}><MetricsFilmRow catalog={catalog} row={row} value={`${formatScore100(row.selectedScore)} / 100`} /></li>)}</ol> : <p className="meta">No appearances with {id === 'critic' ? 'critic' : 'audience'} scores yet.</p>}
  </section>;
  const medianLabel = (value:number|null,units:string) => value === null ? `No ${units} for this selection` : `Median ${countLabel(value)} ${units}`;
  return <>
    <div className="metrics-rankings">{list('Top',topDimension,setTopDimension,topRows)}{list('Bottom',bottomDimension,setBottomDimension,bottomRows)}</div>
    <p className="meta metrics-popularity-footnote" data-metric="W">
      {medianLabel(dashboard.popularity.median,'IMDb votes')} · {medianLabel(dashboard.audiencePopularity.median,'total audience votes')}</p>
      {popularityList('popular',popularMeasure,setPopularMeasure)}{popularityList('obscure',obscureMeasure,setObscureMeasure)}
  </>;
}

function FrequencyRows({report,label,unit='appearances',compare=false}: {report:ReturnType<typeof fingerprint>;label:string;unit?:'appearances'|'films';compare?:boolean}) {
  return report.values.length ? <MetricsResults label={label} items={report.values} render={v => <div className="metrics-frequency-row" key={v.id}><span>{v.label}</span><p className="meta">{formatCount(v.count)} {unit} · {v.percentage.toFixed(1)}%{compare && v.ratio !== null ? ` · ${v.ratio.toFixed(1)}x club` : ''}</p></div>} /> : <p className="meta">No qualifying evidence for this selection.</p>;
}
function CountryRows({report}: {report:ReturnType<typeof productionCountryRankings>}) {
  const maximum=Math.max(0,...report.values.map(v=>v.count));
  return report.values.length ? <MetricsResults label="Production countries" items={report.values} render={(v,index)=><Bar key={v.id} label={v.label} value={`${formatCount(v.count)} ${v.count===1?'film':'films'}`} width={v.count/maximum*100} colour={index%2===0?'jeans':'lavender'} />} /> : <p className="meta">No qualifying evidence for this selection.</p>;
}
const reportedMoney = new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',maximumFractionDigits:0});
const ratioNumber = new Intl.NumberFormat('en-AU',{maximumFractionDigits:0,notation:'standard'});
export function formatRevenueRatio(ratio:number,_lowest=false):string {
  if (!Number.isFinite(ratio) || ratio<=0) return 'Ratio unavailable';
  if (ratio<1) return Number.isFinite(1/ratio) ? `Ratio: 1 : ${ratioNumber.format(Math.round(1/ratio))}` : 'Ratio unavailable';
  return `Ratio: ${ratioNumber.format(Math.round(ratio))} : 1`;
}
function RevenueRatios({report}: {report:ReturnType<typeof revenueRatioRankings>}) {
  return <div className="metrics-paired metrics-revenue-ratios" data-metric="L">{(['highest','lowest'] as const).map(direction => <section className="stack" key={direction}>
    <h3>Top 5 {direction} revenue / budget ratio</h3>
    {report.covered ? <ol className="metrics-ratio-list" role="list"><MetricsResults list label={`${direction} revenue ratios`} items={direction === 'highest' ? report.top : report.bottom} render={(p,index) => <li key={p.movie.id}><span className="metrics-ratio-rank" aria-hidden="true">{index+1}.</span><div className="metrics-ratio-data"><MovieLink movie={p.movie}><span className="movie-title">{p.movie.title}</span></MovieLink><p className="meta">{p.movie.year ?? 'Year unknown'} · {formatRevenueRatio(p.ratio,direction === 'lowest')}</p><dl className="metrics-reported-money meta"><div><dt>Reported budget USD</dt><dd>{reportedMoney.format(p.budget).replace(/^USD\s*/,'$')}</dd></div><div><dt>Reported revenue USD</dt><dd>{reportedMoney.format(p.revenue).replace(/^USD\s*/,'$')}</dd></div></dl></div></li>} /></ol> : <p className="meta">No qualifying films for this selection.</p>}
  </section>)}</div>;
}
export function TopFiveEnrichment({rows,data,isAll,cached,talentReport,role,setRole,partnerships}: Pick<EnrichedReportProps,'rows'|'data'|'isAll'|'cached'|'talentReport'|'role'|'setRole'> & {partnerships?:ReactNode}) {
  const countries=cached('topCountries',()=>productionCountryRankings(rows,data));
  const languages=cached('topNonEnglishLanguages',()=>nonEnglishLanguageRankings(rows,data));
  const combinations=cached('genreCombinations',()=>genreCombinations(rows));
  return <>
    <DiscoveryRankings rows={rows}/>
    <section className="stack metrics-talent" data-metric="G"><h3>Top 5 talent</h3><label className="input-label">Role<select className="field__input" value={role} onChange={e => setRole(e.target.value as EnrichedReportProps['role'])}>{[...talentRoles,'Studios'].map(r => <option key={r}>{r}</option>)}</select></label><p className="meta">{role === 'Studios' ? 'Share of appearances by production studio.' : `Share of appearances with ${role.toLowerCase()} credit.`}</p><FrequencyRows report={talentReport} label={role === 'Studios' ? 'Studios' : 'Talent'} compare={role !== 'Studios' && !isAll} /></section>
    {partnerships}
    <section className="stack metrics-genre-combinations" aria-label="Top 5 genre combinations" data-metric="genre-combinations"><h3>Top 5 genre combinations</h3><p className="meta">Unique genre subsets of two or more genres.</p><ol className="staging-ranking"><MetricsResults label="Genre combinations" list items={combinations} render={v=><li key={v.label}><span>{v.label}</span><strong>{formatCount(v.count)} films</strong></li>}/></ol>{!combinations.length&&<p className="meta">No qualifying evidence for this selection.</p>}</section>
    <section className="stack metrics-countries" data-metric="H"><h3>Top 5 production countries</h3><CountryRows report={countries} /></section>
    <section className="stack metrics-non-english" data-metric="I"><h3>Top 5 non-English original languages</h3>{languages.values.length?<MetricsResults label="Non-English original languages" items={languages.values} render={(value,index)=><Bar key={value.id} label={value.label} value={`${formatCount(value.count)} ${value.count===1?'film':'films'}`} width={value.count/languages.maximum*100} colour={index%2===0?'jeans':'lavender'} />}/>:<p className="meta">No qualifying original-language evidence for this selection.</p>}</section>
    <RevenueRatios report={cached('revenueRatios',()=>revenueRatioRankings(rows,data))} />

  </>;
}
