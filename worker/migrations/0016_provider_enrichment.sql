PRAGMA foreign_keys = ON;
CREATE TABLE movie_provider_metadata (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL,
 title TEXT, runtime REAL CHECK(runtime >= 0), original_language TEXT, budget REAL CHECK(budget >= 0),
 revenue REAL CHECK(revenue >= 0), popularity REAL CHECK(popularity >= 0), tagline TEXT, fetched_at TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider)
);
CREATE TABLE movie_provider_countries (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL,
 item_key TEXT NOT NULL, code TEXT NOT NULL, name TEXT, fetched_at TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_languages (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL,
 item_key TEXT NOT NULL, code TEXT NOT NULL, name TEXT, english_name TEXT, fetched_at TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_companies (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL,
 item_key TEXT NOT NULL, external_id TEXT NOT NULL, name TEXT NOT NULL, origin_country TEXT, fetched_at TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_credits (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL, item_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('cast','crew')), role TEXT NOT NULL, person_id TEXT NOT NULL,
 name TEXT NOT NULL, original_name TEXT, department TEXT, job TEXT, character TEXT, billing_order INTEGER,
 credit_id TEXT, ordinal INTEGER NOT NULL, fetched_at TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_content_ratings (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL, item_key TEXT NOT NULL,
 country TEXT NOT NULL, certification TEXT NOT NULL CHECK(length(certification)>0), release_type INTEGER,
 release_date TEXT, fetched_at TEXT NOT NULL, PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_keywords (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL, item_key TEXT NOT NULL,
 external_id TEXT, name TEXT NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_watch_offers (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL, item_key TEXT NOT NULL,
 collection TEXT NOT NULL, service_id TEXT NOT NULL, name TEXT NOT NULL, country TEXT, access_type TEXT,
 link TEXT, ordinal INTEGER NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY(movie_id,provider,item_key)
);
-- Claims retain conflicting evidence without transferring canonical ownership.
CREATE TABLE movie_provider_identity_claims (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL, item_key TEXT NOT NULL,
 identity_provider TEXT NOT NULL, external_id TEXT NOT NULL, fetched_at TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider,item_key)
);
CREATE TABLE movie_provider_enrichment_state (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, provider TEXT NOT NULL,
 identity_provider TEXT NOT NULL, external_id TEXT NOT NULL, content_hash TEXT NOT NULL,
 checked_at TEXT NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY(movie_id,provider)
);
CREATE INDEX provider_keywords_by_name ON movie_provider_keywords(provider,name,movie_id);
CREATE INDEX provider_credits_by_person ON movie_provider_credits(provider,person_id,role,movie_id);
CREATE INDEX provider_companies_by_identity ON movie_provider_companies(provider,external_id,movie_id);
CREATE INDEX provider_offers_by_service ON movie_provider_watch_offers(provider,collection,service_id,movie_id);
