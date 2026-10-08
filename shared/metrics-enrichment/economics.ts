import { median, uniqueAppearances, withCutoffTies, type Appearance } from '../metrics';
import { order, type MetricsEnrichment } from './facts';

export const positiveMoney = (value: number | null | undefined): number | null => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
export function filmEconomics(rows: Appearance[],data: MetricsEnrichment) {
  const unique = uniqueAppearances(rows);
  const identities = new Map<string,Set<string>>();
  for (const row of rows) {
    const hosts = identities.get(row.movie.id) ?? new Set<string>();
    hosts.add(row.session.kind === 'classics' ? 'CLSC' : row.session.host_member_id ?? 'Unknown');
    identities.set(row.movie.id,hosts);
  }
  const points = unique.flatMap(row => {
    const metadata = data.movies[row.movie.id]?.metadata, budget = positiveMoney(metadata?.budget), revenue = positiveMoney(metadata?.revenue);
    const hosts = [...identities.get(row.movie.id)!].sort(order);
    return budget !== null && revenue !== null ? [{movie:row.movie,budget,revenue,hosts}] : [];
  });
  const values = (key: 'budget' | 'revenue') => rows.flatMap(row => {const value = positiveMoney(data.movies[row.movie.id]?.metadata?.[key]);return value === null ? [] : [value];});
  const budgets = values('budget'), revenues = values('revenue');
  return {points,unique:unique.length,budget:{median:median(budgets),covered:budgets.length},revenue:{median:median(revenues),covered:revenues.length}};
}
export function revenueRatioRankings(rows: Appearance[],data: MetricsEnrichment) {
  const report = filmEconomics(rows,data);
  const values = report.points.map(point => ({...point,ratio:point.revenue/point.budget}));
  const order = (a:typeof values[number],b:typeof values[number]) => orderText(a.movie.title,b.movie.title) || (a.movie.year ?? 0)-(b.movie.year ?? 0) || orderText(a.movie.id,b.movie.id);
  const orderText = (a:string,b:string) => a < b ? -1 : a > b ? 1 : 0;
  return {covered:values.length,unique:report.unique,
    top:withCutoffTies([...values].sort((a,b) => b.ratio-a.ratio || order(a,b)),p => p.ratio),
    bottom:withCutoffTies([...values].sort((a,b) => a.ratio-b.ratio || order(a,b)),p => p.ratio)};
}
