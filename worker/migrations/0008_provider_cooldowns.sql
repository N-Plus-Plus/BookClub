CREATE TABLE provider_cooldowns (
  provider TEXT PRIMARY KEY,
  retry_after_until TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
