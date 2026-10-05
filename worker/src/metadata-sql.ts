import { recognizedGenreKeys } from '../../shared/genres';
import { TMDB_METADATA_REFRESH_DAYS } from '../../shared/metadata';
export const validTmdbSql = (id:string, bounded = true) => `${bounded ? `length(${id}) BETWEEN 1 AND 10` : `length(${id})>=1`} AND substr(${id},1,1) BETWEEN '1' AND '9' AND ${id} NOT GLOB '*[^0-9]*'`;
export const validImdbSql = (id:string) => `substr(${id},1,2)='tt' AND length(${id}) BETWEEN 9 AND 12 AND substr(${id},3) NOT GLOB '*[^0-9]*'`;
// Aggregate relationships once. No per-movie genre/artwork subquery scans.
export function metadataSql(director:boolean, priority:boolean) {
  return `WITH RECURSIVE ${priority ? `genre_keys(movie_id,remaining,normal) AS (
    SELECT movie_id,lower(replace(replace(genre,char(304),'I'),char(8490),'K')),'' FROM movie_genres UNION ALL
    SELECT movie_id,substr(remaining,2),normal||CASE WHEN substr(remaining,1,1) GLOB '[a-z0-9]' THEN substr(remaining,1,1) ELSE '' END FROM genre_keys WHERE remaining<>''
  ), genres AS (SELECT DISTINCT movie_id FROM genre_keys WHERE remaining='' AND normal IN (${recognizedGenreKeys.map(k => `'${k}'`).join(',')})),` : ''}
  artwork AS (SELECT movie_id,max(asset_type='poster') AS poster,max(asset_type='backdrop') AS backdrop FROM movie_assets WHERE provider='tmdb' GROUP BY movie_id),
  metadata AS (SELECT m.*,${director ? 'm.director' : 'NULL'} AS metadata_director,e.external_id AS tmdb_id,
    coalesce(a.poster,0) AS poster,coalesce(a.backdrop,0) AS backdrop${priority ? ',g.movie_id IS NOT NULL AS has_genres' : ''}
    FROM movies m LEFT JOIN movie_external_ids e ON e.movie_id=m.id AND e.provider='tmdb'
    LEFT JOIN artwork a ON a.movie_id=m.id ${priority ? 'LEFT JOIN genres g ON g.movie_id=m.id' : ''}),
  eligible AS (SELECT *,coalesce((${validTmdbSql('tmdb_id')}),0) AS identified,
    (metadata_director IS NULL OR trim(metadata_director,char(9)||char(10)||char(11)||char(12)||char(13)||char(32)||char(160)||char(5760)||char(8192)||char(8193)||char(8194)||char(8195)||char(8196)||char(8197)||char(8198)||char(8199)||char(8200)||char(8201)||char(8202)||char(8232)||char(8233)||char(8239)||char(8287)||char(12288)||char(65279))=''
    OR tmdb_metadata_checked_at IS NULL OR tmdb_metadata_checked_at=''
    OR julianday(tmdb_metadata_checked_at)<=julianday(?)-${TMDB_METADATA_REFRESH_DAYS}
    OR ((tmdb_artwork_checked_at IS NULL OR tmdb_artwork_checked_at='') AND (poster=0 OR backdrop=0))) AS candidate
    FROM metadata)`;
}
export const metadataPrioritySql = `(CASE WHEN has_genres THEN 0 ELSE 10 END
  + (metadata_director IS NULL OR metadata_director='') + (original_title IS NULL OR original_title='')
  + (release_date IS NULL OR release_date='') + (runtime IS NULL OR runtime=0)
  + (overview IS NULL OR overview='') + (poster=0) + (backdrop=0))`;
