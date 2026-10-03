CREATE TABLE member_auth (
 member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
 authorized_email TEXT NOT NULL UNIQUE CHECK(authorized_email = lower(trim(authorized_email))),
 google_sub TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 bound_at TEXT,
 last_login_at TEXT
);
CREATE TABLE auth_sessions (
 token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
 member_id TEXT NOT NULL REFERENCES member_auth(member_id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX auth_sessions_by_member ON auth_sessions(member_id);
