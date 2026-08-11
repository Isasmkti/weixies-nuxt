-- Xendit migration for existing checkout and payment tables
-- Additive only: preserves historical data and existing order records.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_url TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_invoice_id TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS raw_response JSONB;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_invoice_id
  ON payments(provider_invoice_id);

ALTER TABLE payment_logs
  ADD COLUMN IF NOT EXISTS provider_status TEXT;

