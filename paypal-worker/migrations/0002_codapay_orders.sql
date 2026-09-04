CREATE TABLE IF NOT EXISTS codapay_orders (
  txn_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  result_code INTEGER,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_codapay_orders_status ON codapay_orders(status);
