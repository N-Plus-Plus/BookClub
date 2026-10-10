/** Canonical provider-score scope; saved relationships disclose no private set context. */
export function scoreScopeSql(id: string, predictions = true) {
  return `EXISTS(SELECT 1 FROM classics WHERE movie_id=${id})
    OR EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=${id} AND s.deleted_at IS NULL)
    OR ${id} IN (SELECT DISTINCT bm.movie_id FROM builder_movies bm JOIN builder_sets b ON b.id=bm.builder_id)
    ${predictions ? `OR EXISTS(SELECT 1 FROM ai_predictions p WHERE p.movie_id=${id})` : ''}`;
}
