// Column vocabulary only: each caller retains its own scope, joins and ordering.
const identityColumns = 'id,title,original_title';
const metadataColumns = (director: boolean | 'metadata_director') => `release_date,runtime,overview,${director === 'metadata_director' ? 'metadata_director AS director' : director ? 'director' : 'NULL AS director'},tmdb_metadata_checked_at,tmdb_artwork_checked_at`;
export const metadataMovieColumns = (director: boolean | 'metadata_director') => `${identityColumns},${metadataColumns(director)}`;
export const movieColumns = (director: boolean) => `${identityColumns},year,${metadataColumns(director)}`;
