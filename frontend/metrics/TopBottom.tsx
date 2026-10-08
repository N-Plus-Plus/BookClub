import { formatCount } from '../../shared/format';
import type { Appearance, MetricsScoreCategory, PopularityMeasure, RankedAppearance, PopularAppearance } from '../../shared/metrics';
import { catalogIndex } from '../../shared/catalog-index';
import { dateLabel, FilmInformation, MovieLink, Poster } from '../components';
import { formatScore100 } from '../presentation';
import { ClubIdentity } from '../ClubIdentity';
import { Bar } from '../MetricsVisuals';
import { MetricsResults } from '../MetricsResults';
import { nonEnglishLanguageRankings, topFrequency, productionCountryRankings, metricsFactReader, revenueRatioRankings, talentRoles, type TalentRole, type fingerprint } from '../../shared/metrics-enrichment';
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

export function TopBottomMetrics({catalog,dashboard,topDimension,bottomDimension,setTopDimension,setBottomDimension,topRows,bottomRows,popularityMeasure,setPopularityMeasure}: Pick<CatalogMetricsProps,'catalog'|'rows'|'dashboard'|'topDimension'|'bottomDimension'|'setTopDimension'|'setBottomDimension'|'topRows'|'bottomRows'> & {popularityMeasure:PopularityMeasure;setPopularityMeasure:(measure:PopularityMeasure)=>void}) {
  const voteUnits = popularityMeasure === 'imdb' ? 'IMDb votes' : 'audience votes';
  const voteLabel = popularityMeasure === 'imdb' ? 'IMDb' : 'All audiences';
  const popularity = popularityMeasure === 'imdb' ? dashboard.popularity : dashboard.audiencePopularity;
  const popularityList = (direction:'popular'|'obscure',items:PopularAppearance[]) => <section className="stack">
    <div className="metrics-report-heading"><h2>Top 5 most {direction} · {voteLabel}</h2><div className="metrics-score-filters" role="group" aria-label={`Most ${direction} vote filter`}>{voteMeasures.map(d => <button className="tab-control" type="button" key={d.id} aria-pressed={popularityMeasure === d.id} onClick={() => setPopularityMeasure(d.id)}>{d.label}</button>)}</div></div>
    {items.length ? <ol className="metrics-list metrics-popularity-list">{items.map(row => <li key={row.movie.id}><MetricsFilmRow catalog={catalog} row={row} value={`${countLabel(row.votes)} ${voteUnits}`} /></li>)}</ol> : <p className="meta">No {popularityMeasure === 'imdb' ? 'IMDb' : 'audience'} vote data for this selection.</p>}
  </section>;
  const list = (direction:'Top'|'Bottom',id:MetricsScoreCategory,setDimension:(id:MetricsScoreCategory)=>void,rows:RankedAppearance[]) => <section className="stack" data-metric={direction === 'Top' ? 'U' : 'V'}>
    <div className="metrics-report-heading"><h2>Top 5 {direction === 'Top' ? 'highest' : 'lowest'} {id === 'critic' ? 'critic' : 'audience'} scores</h2><div className="metrics-score-filters" role="group" aria-label={`${direction} 5 score filter`}>{scoreCategories.map(d => <button className="tab-control" type="button" key={d.id} aria-pressed={id === d.id} onClick={() => setDimension(d.id)}>{d.label}</button>)}</div></div>
    {rows.length ? <ol className="metrics-list">{rows.map(row => <li key={`${row.session.id}:${row.position}`}><MetricsFilmRow catalog={catalog} row={row} value={`${formatScore100(row.selectedScore)} / 100`} /></li>)}</ol> : <p className="meta">No appearances with {id === 'critic' ? 'critic' : 'audience'} scores yet.</p>}
  </section>;
  const medianLabel = (value:number|null,units:string) => value === null ? `No ${units} for this selection` : `Median ${countLabel(value)} ${units}`;
  return <>
    <div className="metrics-rankings">{list('Top',topDimension,setTopDimension,topRows)}{list('Bottom',bottomDimension,setBottomDimension,bottomRows)}</div>
    <div className="stack" data-metric="W">
      <p className="meta">{medianLabel(dashboard.popularity.median,'IMDb votes')} · {medianLabel(dashboard.audiencePopularity.median,'total audience votes')}</p>
      <div className="metrics-paired">{popularityList('popular',popularity.popular)}{popularityList('obscure',popularity.obscure)}</div>
    </div>
  </>;
}

function FrequencyRows({report,label,unit='appearances',compare=false}: {report:ReturnType<typeof fingerprint>;label:string;unit?:'appearances'|'films';compare?:boolean}) {
  return report.values.length ? <MetricsResults label={label} items={report.values} render={v => <div className="metrics-frequency-row" key={v.id}><span>{v.label}</span><p className="meta">{formatCount(v.count)} {unit} · {v.percentage.toFixed(1)}%{compare && v.ratio !== null ? ` · ${v.ratio.toFixed(1)}x club` : ''}</p></div>} /> : <p className="meta">No qualifying evidence for this selection.</p>;
}
const reportedMoney = new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',maximumFractionDigits:0});
const ratioNumber = new Intl.NumberFormat('en-AU',{minimumFractionDigits:1,maximumFractionDigits:1});
export function formatRevenueRatio(ratio:number,lowest=false):string {
  if (!Number.isFinite(ratio) || ratio<=0) return 'Ratio unavailable';
  if (lowest && ratio<1) return Number.isFinite(1/ratio) ? `1 ÷ ${ratioNumber.format(1/ratio)}` : 'Ratio unavailable';
  return `${ratioNumber.format(ratio)}×`;
}
function RevenueRatios({report}: {report:ReturnType<typeof revenueRatioRankings>}) {
  return <div className="metrics-paired metrics-revenue-ratios" data-metric="L">{(['highest','lowest'] as const).map(direction => <section className="stack" key={direction}>
    <h3>Top 5 {direction} revenue / budget ratio</h3>
    {report.covered ? <ol className="metrics-ratio-list" role="list"><MetricsResults list label={`${direction} revenue ratios`} items={direction === 'highest' ? report.top : report.bottom} render={(p,index) => <li key={p.movie.id}><span className="metrics-ratio-rank" aria-hidden="true">{index+1}.</span><div className="metrics-ratio-data"><MovieLink movie={p.movie}><span className="movie-title">{p.movie.title}</span></MovieLink><p className="meta">{p.movie.year ?? 'Year unknown'} · {formatRevenueRatio(p.ratio,direction === 'lowest')}</p><dl className="metrics-reported-money meta"><div><dt>Reported budget USD</dt><dd>{reportedMoney.format(p.budget).replace(/^USD\s*/,'$')}</dd></div><div><dt>Reported revenue USD</dt><dd>{reportedMoney.format(p.revenue).replace(/^USD\s*/,'$')}</dd></div></dl></div></li>} /></ol> : <p className="meta">No qualifying films for this selection.</p>}
  </section>)}</div>;
}
export function TopFiveEnrichment({rows,all,data,isAll,cached,talentReport,role,setRole}: Pick<EnrichedReportProps,'rows'|'all'|'data'|'isAll'|'cached'|'talentReport'|'role'|'setRole'>) {
  const studios=cached('topStudios',()=>topFrequency(rows,all,metricsFactReader(data,'companies')));
  const countries=cached('topCountries',()=>productionCountryRankings(rows,data));
  const languages=cached('topNonEnglishLanguages',()=>nonEnglishLanguageRankings(rows,data));
  return <>
    <section className="stack metrics-talent" data-metric="G"><h3>Top 5 talent</h3><label className="input-label">Role<select className="field__input" value={role} onChange={e => setRole(e.target.value as TalentRole)}>{talentRoles.map(r => <option key={r}>{r}</option>)}</select></label><p className="meta">Share of appearances with {role.toLowerCase()} credit.</p><FrequencyRows report={talentReport} label="Talent" compare={!isAll} /></section>
    <section className="stack metrics-companies" data-metric="J"><h3>Top 5 studios</h3><FrequencyRows report={studios} label="Studios" /></section>
    <RevenueRatios report={cached('revenueRatios',()=>revenueRatioRankings(rows,data))} />
    <section className="stack metrics-countries" data-metric="H"><h3>Top 5 production countries</h3><FrequencyRows report={countries} label="Production countries" unit="films" /></section>
    <section className="stack metrics-non-english" data-metric="I"><h3>Top 5 non-English original languages</h3>{languages.values.length?<MetricsResults label="Non-English original languages" items={languages.values} render={(value,index)=><Bar key={value.id} label={value.label} value={`${formatCount(value.count)} ${value.count===1?'film':'films'}`} width={value.count/languages.maximum*100} colour={index%2===0?'jeans':'lavender'} />}/>:<p className="meta">No qualifying original-language evidence for this selection.</p>}</section>
  </>;
}
