-- Derived watch cache only; canonical films and other evidence are untouched.
DELETE FROM movie_provider_watch_offers WHERE country IS NULL OR country <> 'AU';
