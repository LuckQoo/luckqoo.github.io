CREATE TABLE IF NOT EXISTS daily_usage (
  usage_key TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (usage_key, usage_date)
);
