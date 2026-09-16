BEGIN;

ALTER TABLE public.buyer_seller_reports
  ADD COLUMN category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('spam', 'harassment', 'fraud', 'inappropriate_content', 'other')),
  ADD COLUMN resolution_note text CHECK (char_length(resolution_note) <= 2000),
  ADD COLUMN reviewed_at timestamptz;

-- All mutations now pass through authenticated, validated server endpoints.
REVOKE INSERT, UPDATE, DELETE ON public.buyer_seller_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.buyer_seller_reports TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
