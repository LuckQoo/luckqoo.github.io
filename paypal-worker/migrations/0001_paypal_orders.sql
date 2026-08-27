CREATE TABLE IF NOT EXISTS paypal_orders (
  order_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('shop','donation')), custom_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0), currency TEXT NOT NULL, status TEXT NOT NULL,
  capture_id TEXT UNIQUE, create_request_id TEXT NOT NULL UNIQUE, raw_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_paypal_orders_status ON paypal_orders(status);
CREATE INDEX IF NOT EXISTS idx_paypal_orders_capture_id ON paypal_orders(capture_id);
CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('PROCESSING','PROCESSED','FAILED')),
  raw_json TEXT NOT NULL, error_message TEXT, received_at TEXT NOT NULL, processed_at TEXT
);
CREATE TABLE IF NOT EXISTS rate_limits (bucket_key TEXT PRIMARY KEY, request_count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
