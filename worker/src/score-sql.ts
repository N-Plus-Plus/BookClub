import { scoreServiceOrder, tmdbScoreServiceOrder, liveScoreServices, requiredScores, legacyScoreLiveCutoff } from '../../shared/ranking';
// SQL reduces captures by the shared service order. Exact final ties still go
// through latestScores(), preserving its locale-aware JSON fallback without a
// second ranking rule or reliance on SQLite's different text collation.
export const usableScoreSql = (alias = 'ss') => `CASE WHEN ${alias}.raw_scale IS NOT NULL THEN ${alias}.raw_scale>0 AND ${alias}.raw_scale<=1.7976931348623157e308 AND ${alias}.raw_value>=0 AND ${alias}.raw_value<=${alias}.raw_scale ELSE ${alias}.normalized_value>=0 AND ${alias}.normalized_value<=100 END`;
const order = (services:string[]) => `CASE coalesce(retrieved_via,CASE WHEN provider='tmdb' THEN 'tmdb' ELSE 'unspecified' END) ${services.map((s,i) => `WHEN '${s}' THEN ${i}`).join(' ')} ELSE ${services.length} END`;
export const scoreColumns = 'movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at,source_ref,source_ordinal,legacy_preferred';
export const liveScoreSql = (alias = 'ss') => `coalesce(${alias}.retrieved_via,CASE WHEN ${alias}.provider='tmdb' THEN 'tmdb' ELSE 'unspecified' END) IN (${liveScoreServices.map(s => "'"+s+"'").join(',')})`;
export function effectiveScoreSql(scope = '') {
  return `WITH live_dimensions AS (SELECT movie_id,count(DISTINCT provider||':'||metric) AS dimensions
    FROM source_scores ss WHERE (${usableScoreSql()}) AND (${liveScoreSql()})
    AND provider||':'||metric IN (${requiredScores.map(s => "'"+s+"'").join(',')}) GROUP BY movie_id), preferred AS (SELECT ${scoreColumns},id,DENSE_RANK() OVER (
    PARTITION BY movie_id,provider,metric ORDER BY CASE WHEN provider='tmdb' THEN ${order(tmdbScoreServiceOrder)} ELSE ${order(scoreServiceOrder)} END,
    julianday(fetched_at) DESC,CASE WHEN retrieved_via='legacy-spreadsheet' THEN coalesce(legacy_preferred,0) ELSE 0 END DESC,
    CASE WHEN retrieved_via='legacy-spreadsheet' THEN coalesce(source_ordinal,0) ELSE 0 END DESC) AS preference
    FROM source_scores ss WHERE (${usableScoreSql()}) ${scope}
    AND (coalesce((SELECT dimensions FROM live_dimensions WHERE movie_id=ss.movie_id),0)<${legacyScoreLiveCutoff} OR (${liveScoreSql()}))
    AND (coalesce(ss.retrieved_via,'')<>'legacy-spreadsheet' OR (
      coalesce((SELECT dimensions FROM live_dimensions WHERE movie_id=ss.movie_id),0)<${legacyScoreLiveCutoff}
      AND NOT EXISTS(SELECT 1 FROM source_scores live WHERE live.movie_id=ss.movie_id AND live.provider=ss.provider AND live.metric=ss.metric AND (${usableScoreSql('live')}) AND (${liveScoreSql('live')})))))
    SELECT ${scoreColumns} FROM preferred WHERE preference=1 ORDER BY fetched_at,id`;
}
