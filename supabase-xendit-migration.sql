-- Xendit migration for the current public schema snapshot.
-- Additive only: preserves legacy Midtrans columns and keeps the checkout flow compatible.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_url TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_invoice_id TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS raw_response JSONB;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_invoice_id
  ON public.payments(provider_invoice_id);

