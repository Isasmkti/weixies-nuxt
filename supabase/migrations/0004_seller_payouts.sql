-- Multi-seller marketplace migration
-- Phase 4: seller payout system
-- Date: 2026-08-19
--
-- Payout records are created and managed by platform admins or trusted
-- server-side service-role code. Sellers have read-only access to their own
-- payout batches and the order items included in those batches.

CREATE TABLE public.seller_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'processing'::text,
      'paid'::text,
      'failed'::text
    ])),
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  paid_at timestamp with time zone,
  reference_no text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT seller_payouts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.seller_payout_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.seller_payouts(id),
  order_item_id bigint NOT NULL REFERENCES public.order_items(id),
  CONSTRAINT seller_payout_items_pkey PRIMARY KEY (id)
);

CREATE INDEX seller_payouts_seller_id_created_at_idx
  ON public.seller_payouts (seller_id, created_at DESC);
CREATE INDEX seller_payout_items_payout_id_idx
  ON public.seller_payout_items (payout_id);
CREATE INDEX seller_payout_items_order_item_id_idx
  ON public.seller_payout_items (order_item_id);

ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own payouts"
  ON public.seller_payouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = seller_payouts.seller_id
        AND sellers.profile_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view their own payout items"
  ON public.seller_payout_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.seller_payouts
      JOIN public.sellers ON sellers.id = seller_payouts.seller_id
      WHERE seller_payouts.id = seller_payout_items.payout_id
        AND sellers.profile_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can manage seller payouts"
  ON public.seller_payouts
  FOR ALL
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can manage seller payout items"
  ON public.seller_payout_items
  FOR ALL
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

-- The project uses the Supabase service role only in server-side code. This
-- explicit policy documents its trusted write access; the service role also
-- bypasses RLS in Supabase by design.
CREATE POLICY "Service role can manage seller payouts"
  ON public.seller_payouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage seller payout items"
  ON public.seller_payout_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
