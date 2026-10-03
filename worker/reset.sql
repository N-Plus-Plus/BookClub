-- Explicit opt-in reset, invoked ONLY with Wrangler --local by package scripts.
DELETE FROM session_movies;
DELETE FROM sessions;
DELETE FROM seen_states;
DELETE FROM classics;
DELETE FROM source_scores;
DELETE FROM movie_assets;
DELETE FROM movie_external_ids;
DELETE FROM movie_genres;
DELETE FROM movies;
DELETE FROM auth_sessions;
DELETE FROM member_auth;
DELETE FROM members;
DELETE FROM seed_runs;
