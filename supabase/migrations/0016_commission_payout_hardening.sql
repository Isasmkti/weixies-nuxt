-- Commission, fulfillment, refund, and payout hardening
-- Date: 2026-08-20
--
-- This is a forward-only migration. Existing paid orders receive a seven-day
-- payout availability date, payout destinations are snapshotted per batch,
-- and payment/refund processing becomes idempotent and transaction-safe.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamp with time zone;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS available_for_payout_at timestamp with time zone;

ALTER TABLE public.seller_payouts
  ADD COLUMN IF NOT EXISTS gross_amount integer,
  ADD COLUMN IF NOT EXISTS adjustment_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name_snapshot text,
  ADD COLUMN IF NOT EXISTS bank_account_snapshot text;

UPDATE public.seller_payouts
SET gross_amount = amount
WHERE gross_amount IS NULL;

ALTER TABLE public.seller_payouts
  ALTER COLUMN gross_amount SET NOT NULL;

UPDATE public.order_items AS oi
SET payout_status = 'held',
    available_for_payout_at = COALESCE(o.paid_at, o.created_at, now()) + interval '7 days'
FROM public.orders AS o
WHERE o.id = oi.order_id
  AND o.status = 'paid'
  AND oi.seller_id IS NOT NULL
  AND oi.payout_status = 'pending';

UPDATE public.order_items AS oi
SET available_for_payout_at = COALESCE(o.paid_at, o.created_at, now()) + interval '7 days'
FROM public.orders AS o
WHERE o.id = oi.order_id
  AND o.status = 'paid'
  AND oi.seller_id IS NOT NULL
  AND oi.available_for_payout_at IS NULL
  AND oi.payout_status IN ('held', 'released');

UPDATE public.orders AS paid_order
SET fulfilled_at = COALESCE(paid_order.paid_at, paid_order.created_at, now())
WHERE paid_order.status = 'paid'
  AND paid_order.fulfilled_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_items.order_id = paid_order.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.order_items AS paid_item
    WHERE paid_item.order_id = paid_order.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_products AS ownership
        WHERE ownership.profile_id = paid_order.profile_id
          AND ownership.product_id = paid_item.product_id
          AND ownership.order_id = paid_order.id
      )
  );

CREATE INDEX IF NOT EXISTS order_items_payout_availability_idx
  ON public.order_items (seller_id, available_for_payout_at)
  WHERE payout_status = 'held';

-- The delivery code grants one durable ownership row per buyer/product. Keep
-- the earliest legacy row if retries previously created duplicates.
DELETE FROM public.user_products AS ownership
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY profile_id, product_id
        ORDER BY created_at NULLS LAST, id
      ) AS duplicate_number
    FROM public.user_products
  ) AS ranked
  WHERE ranked.duplicate_number > 1
) AS duplicates
WHERE ownership.id = duplicates.id;

CREATE UNIQUE INDEX IF NOT EXISTS user_products_profile_product_uidx
  ON public.user_products (profile_id, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_items_batch_item_uidx
  ON public.seller_payout_items (payout_id, order_item_id);

CREATE TABLE public.payment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  order_number text,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  provider_status text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX payment_logs_order_id_created_at_idx
  ON public.payment_logs (order_id, created_at DESC);
CREATE INDEX payment_logs_event_type_created_at_idx
  ON public.payment_logs (event_type, created_at DESC);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read payment logs"
  ON public.payment_logs FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage payment logs"
  ON public.payment_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE public.payment_refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'xendit',
  provider_refund_id text NOT NULL,
  provider_payment_id text,
  payment_id uuid REFERENCES public.payments(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_refunds_pkey PRIMARY KEY (id),
  CONSTRAINT payment_refunds_provider_id_key UNIQUE (provider, provider_refund_id)
);

CREATE INDEX payment_refunds_order_id_idx
  ON public.payment_refunds (order_id, created_at DESC);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read payment refunds"
  ON public.payment_refunds FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage payment refunds"
  ON public.payment_refunds FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE public.seller_balance_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  order_item_id bigint REFERENCES public.order_items(id),
  amount integer NOT NULL CHECK (amount <> 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  payout_id uuid REFERENCES public.seller_payouts(id),
  source_payout_id uuid REFERENCES public.seller_payouts(id),
  reference_no text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_at timestamp with time zone,
  CONSTRAINT seller_balance_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT seller_balance_adjustments_item_reason_key UNIQUE (order_item_id, reason)
);

CREATE INDEX seller_balance_adjustments_pending_idx
  ON public.seller_balance_adjustments (seller_id, created_at)
  WHERE status = 'pending';

ALTER TABLE public.seller_balance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own balance adjustments"
  ON public.seller_balance_adjustments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers
      WHERE sellers.id = seller_balance_adjustments.seller_id
        AND sellers.profile_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can read balance adjustments"
  ON public.seller_balance_adjustments FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage balance adjustments"
  ON public.seller_balance_adjustments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.sellers
  ADD CONSTRAINT sellers_commission_rate_range_check
  CHECK (commission_rate >= 0 AND commission_rate <= 1) NOT VALID;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_commission_nonnegative_check
  CHECK (commission_amount >= 0) NOT VALID,
  ADD CONSTRAINT order_items_seller_earning_nonnegative_check
  CHECK (seller_earning >= 0) NOT VALID,
  ADD CONSTRAINT order_items_seller_amounts_check
  CHECK (
    seller_id IS NULL
    OR commission_amount + seller_earning = price
  ) NOT VALID;

ALTER TABLE public.seller_payouts
  ADD CONSTRAINT seller_payouts_amount_positive_check
  CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT seller_payouts_gross_nonnegative_check
  CHECK (gross_amount >= 0) NOT VALID,
  ADD CONSTRAINT seller_payouts_amount_breakdown_check
  CHECK (amount = gross_amount + adjustment_amount) NOT VALID;

CREATE OR REPLACE FUNCTION public.finalize_paid_order(
  p_order_id uuid,
  p_profile_id uuid,
  p_paid_at timestamp with time zone DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders;
  v_product_ids bigint[];
  v_granted_count integer := 0;
  v_cart_items_removed integer := 0;
  v_paid_at timestamp with time zone := COALESCE(p_paid_at, now());
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.profile_id <> p_profile_id THEN
    RAISE EXCEPTION 'Order ownership does not match.' USING ERRCODE = '42501';
  END IF;
  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'A refunded order cannot be fulfilled again.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT product_id), ARRAY[]::bigint[])
  INTO v_product_ids
  FROM public.order_items
  WHERE order_id = p_order_id;

  IF cardinality(v_product_ids) = 0 THEN
    RAISE EXCEPTION 'Order has no products to fulfill.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.user_products (profile_id, product_id, order_id, created_at)
  SELECT p_profile_id, product_id, p_order_id, v_paid_at
  FROM unnest(v_product_ids) AS product_id
  ON CONFLICT (profile_id, product_id) DO NOTHING;
  GET DIAGNOSTICS v_granted_count = ROW_COUNT;

  DELETE FROM public.cart_items AS cart_item
  USING public.cart AS buyer_cart
  WHERE buyer_cart.id = cart_item.cart_id
    AND buyer_cart.profile_id = p_profile_id
    AND cart_item.product_id = ANY(v_product_ids);
  GET DIAGNOSTICS v_cart_items_removed = ROW_COUNT;

  UPDATE public.order_items
  SET payout_status = 'held',
      available_for_payout_at = v_paid_at + interval '7 days'
  WHERE order_id = p_order_id
    AND seller_id IS NOT NULL
    AND payout_status = 'pending';

  UPDATE public.orders
  SET status = 'paid',
      paid_at = COALESCE(paid_at, v_paid_at),
      fulfilled_at = COALESCE(fulfilled_at, now())
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'productIds', to_jsonb(v_product_ids),
    'grantedCount', v_granted_count,
    'cartItemsRemoved', v_cart_items_removed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_refund(
  p_order_id uuid,
  p_reference_no text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders;
  v_failed_payout_ids uuid[] := ARRAY[]::uuid[];
  v_adjustment_count integer := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status = 'refunded' THEN
    RETURN jsonb_build_object('alreadyRefunded', true, 'adjustmentCount', 0);
  END IF;
  IF v_order.status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid orders can be refunded.' USING ERRCODE = 'P0001';
  END IF;

  -- A pending transfer can still be cancelled safely. Fail the complete batch
  -- and return its other sale items/adjustments to the next payout cycle.
  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::uuid[])
  INTO v_failed_payout_ids
  FROM (
    SELECT payout.id
    FROM public.seller_payouts AS payout
    WHERE payout.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS payout_item
        JOIN public.order_items AS order_item ON order_item.id = payout_item.order_item_id
        WHERE payout_item.payout_id = payout.id
          AND order_item.order_id = p_order_id
      )
    ORDER BY payout.id
    FOR UPDATE OF payout
  ) AS candidate;

  UPDATE public.seller_payouts
  SET status = 'failed'
  WHERE id = ANY(v_failed_payout_ids);

  UPDATE public.order_items AS order_item
  SET payout_status = 'held'
  WHERE EXISTS (
    SELECT 1 FROM public.seller_payout_items AS payout_item
    WHERE payout_item.payout_id = ANY(v_failed_payout_ids)
      AND payout_item.order_item_id = order_item.id
  )
    AND order_item.order_id <> p_order_id
    AND order_item.payout_status <> 'refunded';

  UPDATE public.seller_balance_adjustments
  SET status = 'pending', payout_id = NULL, applied_at = NULL
  WHERE payout_id = ANY(v_failed_payout_ids);

  -- A transfer already processing or paid may be impossible to claw back.
  -- Carry the refunded earning as seller debt into a future payout instead.
  INSERT INTO public.seller_balance_adjustments (
    seller_id,
    order_item_id,
    amount,
    reason,
    reference_no,
    source_payout_id
  )
  SELECT
    order_item.seller_id,
    order_item.id,
    -order_item.seller_earning,
    'refund',
    NULLIF(btrim(p_reference_no), ''),
    source_payout.id
  FROM public.order_items AS order_item
  LEFT JOIN LATERAL (
    SELECT payout.id
    FROM public.seller_payout_items AS payout_item
    JOIN public.seller_payouts AS payout ON payout.id = payout_item.payout_id
    WHERE payout_item.order_item_id = order_item.id
      AND payout.status IN ('processing', 'paid')
    ORDER BY payout.created_at DESC
    LIMIT 1
  ) AS source_payout ON true
  WHERE order_item.order_id = p_order_id
    AND order_item.seller_id IS NOT NULL
    AND order_item.seller_earning > 0
    AND (
      order_item.payout_status = 'released'
      OR source_payout.id IS NOT NULL
    )
  ON CONFLICT (order_item_id, reason) DO NOTHING;
  GET DIAGNOSTICS v_adjustment_count = ROW_COUNT;

  UPDATE public.order_items
  SET payout_status = 'refunded'
  WHERE order_id = p_order_id
    AND seller_id IS NOT NULL;

  UPDATE public.orders
  SET status = 'refunded'
  WHERE id = p_order_id;

  DELETE FROM public.user_products
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'alreadyRefunded', false,
    'adjustmentCount', v_adjustment_count,
    'failedPayoutIds', to_jsonb(v_failed_payout_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_payout_candidates(
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone
)
RETURNS TABLE (
  seller_id uuid,
  store_name text,
  bank_name text,
  bank_account text,
  amount bigint,
  item_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start >= p_period_end THEN
    RAISE EXCEPTION 'A valid payout period is required.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH eligible_sales AS (
    SELECT
      oi.seller_id,
      SUM(oi.seller_earning)::bigint AS gross_amount,
      COUNT(*)::bigint AS item_count
    FROM public.order_items AS oi
    JOIN public.orders AS o ON o.id = oi.order_id
    WHERE o.status = 'paid'
      AND o.fulfilled_at IS NOT NULL
      AND oi.payout_status = 'held'
      AND oi.available_for_payout_at <= now()
      AND oi.seller_earning > 0
      AND COALESCE(o.paid_at, o.created_at) >= p_period_start
      AND COALESCE(o.paid_at, o.created_at) < p_period_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS existing_item
        JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
        WHERE existing_item.order_item_id = oi.id
          AND existing_payout.status <> 'failed'
      )
    GROUP BY oi.seller_id
  ), pending_adjustments AS (
    SELECT adjustment.seller_id, SUM(adjustment.amount)::bigint AS amount
    FROM public.seller_balance_adjustments AS adjustment
    WHERE adjustment.status = 'pending'
    GROUP BY adjustment.seller_id
  )
  SELECT
    seller.id,
    seller.store_name,
    seller.bank_name,
    seller.bank_account,
    sales.gross_amount + COALESCE(adjustment.amount, 0),
    sales.item_count
  FROM eligible_sales AS sales
  JOIN public.sellers AS seller ON seller.id = sales.seller_id
  LEFT JOIN pending_adjustments AS adjustment ON adjustment.seller_id = seller.id
  WHERE seller.status = 'approved'
    AND sales.gross_amount + COALESCE(adjustment.amount, 0) > 0
  ORDER BY seller.store_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_seller_payout_batch(
  p_seller_id uuid,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone
)
RETURNS SETOF public.seller_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seller public.sellers;
  v_item_ids bigint[];
  v_adjustment_ids uuid[];
  v_gross_amount bigint := 0;
  v_adjustment_amount bigint := 0;
  v_amount bigint := 0;
  v_payout public.seller_payouts;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_seller_id IS NULL OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_start >= p_period_end THEN
    RAISE EXCEPTION 'Seller and a valid payout period are required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_seller
  FROM public.sellers
  WHERE id = p_seller_id
  FOR UPDATE;

  IF v_seller.id IS NULL OR v_seller.status <> 'approved' THEN
    RAISE EXCEPTION 'An approved seller is required.' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(btrim(v_seller.bank_name), '') IS NULL OR NULLIF(btrim(v_seller.bank_account), '') IS NULL THEN
    RAISE EXCEPTION 'Seller payout bank details are required.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::bigint[])
  INTO v_item_ids
  FROM (
    SELECT oi.id
    FROM public.order_items AS oi
    JOIN public.orders AS o ON o.id = oi.order_id
    WHERE oi.seller_id = p_seller_id
      AND o.status = 'paid'
      AND o.fulfilled_at IS NOT NULL
      AND oi.payout_status = 'held'
      AND oi.available_for_payout_at <= now()
      AND oi.seller_earning > 0
      AND COALESCE(o.paid_at, o.created_at) >= p_period_start
      AND COALESCE(o.paid_at, o.created_at) < p_period_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS existing_item
        JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
        WHERE existing_item.order_item_id = oi.id
          AND existing_payout.status <> 'failed'
      )
    ORDER BY oi.id
    FOR UPDATE OF oi
  ) AS candidate;

  SELECT COALESCE(SUM(seller_earning), 0)::bigint
  INTO v_gross_amount
  FROM public.order_items
  WHERE id = ANY(v_item_ids);

  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::uuid[])
  INTO v_adjustment_ids
  FROM (
    SELECT id
    FROM public.seller_balance_adjustments
    WHERE seller_id = p_seller_id
      AND status = 'pending'
    ORDER BY created_at, id
    FOR UPDATE
  ) AS candidate;

  SELECT COALESCE(SUM(amount), 0)::bigint
  INTO v_adjustment_amount
  FROM public.seller_balance_adjustments
  WHERE id = ANY(v_adjustment_ids);

  v_amount := v_gross_amount + v_adjustment_amount;

  IF cardinality(v_item_ids) = 0 OR v_amount <= 0 THEN
    RAISE EXCEPTION 'No positive eligible balance was found for this payout.' USING ERRCODE = 'P0001';
  END IF;
  IF v_gross_amount > 2147483647 OR v_adjustment_amount NOT BETWEEN -2147483648 AND 2147483647 OR v_amount > 2147483647 THEN
    RAISE EXCEPTION 'Payout amount exceeds the supported integer range.' USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.seller_payouts (
    seller_id,
    amount,
    gross_amount,
    adjustment_amount,
    status,
    period_start,
    period_end,
    bank_name_snapshot,
    bank_account_snapshot
  ) VALUES (
    p_seller_id,
    v_amount::integer,
    v_gross_amount::integer,
    v_adjustment_amount::integer,
    'pending',
    p_period_start,
    p_period_end,
    btrim(v_seller.bank_name),
    btrim(v_seller.bank_account)
  )
  RETURNING * INTO v_payout;

  INSERT INTO public.seller_payout_items (payout_id, order_item_id)
  SELECT v_payout.id, unnest(v_item_ids);

  UPDATE public.seller_balance_adjustments
  SET status = 'applied', payout_id = v_payout.id, applied_at = now()
  WHERE id = ANY(v_adjustment_ids);

  RETURN NEXT v_payout;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_seller_payout_status(
  p_payout_id uuid,
  p_status text,
  p_reference_no text DEFAULT NULL
)
RETURNS SETOF public.seller_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payout public.seller_payouts;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('processing', 'paid', 'failed') THEN
    RAISE EXCEPTION 'Invalid payout status.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payout
  FROM public.seller_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF v_payout.id IS NULL THEN
    RAISE EXCEPTION 'Payout was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_payout.status IN ('paid', 'failed') THEN
    RAISE EXCEPTION 'Completed or failed payouts cannot be changed.' USING ERRCODE = 'P0001';
  END IF;
  IF v_payout.status = 'pending' AND p_status NOT IN ('processing', 'failed') THEN
    RAISE EXCEPTION 'A pending payout must enter processing before it can be paid.' USING ERRCODE = 'P0001';
  END IF;
  IF v_payout.status = 'processing' AND p_status NOT IN ('paid', 'failed') THEN
    RAISE EXCEPTION 'Invalid processing payout transition.' USING ERRCODE = 'P0001';
  END IF;
  IF p_status = 'paid' AND NULLIF(btrim(p_reference_no), '') IS NULL THEN
    RAISE EXCEPTION 'A payment reference is required.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.seller_payouts
  SET status = p_status,
      reference_no = CASE WHEN p_status = 'paid' THEN btrim(p_reference_no) ELSE reference_no END,
      paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE NULL END
  WHERE id = p_payout_id
  RETURNING * INTO v_payout;

  IF p_status = 'paid' THEN
    UPDATE public.order_items AS order_item
    SET payout_status = 'released'
    WHERE order_item.payout_status = 'held'
      AND EXISTS (
        SELECT 1 FROM public.seller_payout_items AS payout_item
        WHERE payout_item.payout_id = p_payout_id
          AND payout_item.order_item_id = order_item.id
      );
  ELSIF p_status = 'failed' THEN
    UPDATE public.order_items AS order_item
    SET payout_status = 'held'
    WHERE order_item.payout_status <> 'refunded'
      AND EXISTS (
        SELECT 1 FROM public.seller_payout_items AS payout_item
        WHERE payout_item.payout_id = p_payout_id
          AND payout_item.order_item_id = order_item.id
      );

    UPDATE public.seller_balance_adjustments
    SET status = 'pending', payout_id = NULL, applied_at = NULL
    WHERE payout_id = p_payout_id;

    -- If a refund arrived while this transfer was processing, its debt is no
    -- longer needed when the transfer ultimately fails. If that debt was
    -- already consumed by a later batch, add an equal positive correction.
    INSERT INTO public.seller_balance_adjustments (
      seller_id,
      order_item_id,
      amount,
      reason,
      reference_no,
      source_payout_id
    )
    SELECT
      adjustment.seller_id,
      adjustment.order_item_id,
      -adjustment.amount,
      'refund_reversal',
      adjustment.reference_no,
      p_payout_id
    FROM public.seller_balance_adjustments AS adjustment
    WHERE adjustment.source_payout_id = p_payout_id
      AND adjustment.reason = 'refund'
      AND adjustment.status = 'applied'
    ON CONFLICT (order_item_id, reason) DO NOTHING;

    UPDATE public.seller_balance_adjustments
    SET status = 'cancelled', applied_at = now()
    WHERE source_payout_id = p_payout_id
      AND reason = 'refund'
      AND status = 'pending';
  END IF;

  RETURN NEXT v_payout;
END;
$$;

DROP POLICY IF EXISTS "Platform admins can manage seller payouts" ON public.seller_payouts;
DROP POLICY IF EXISTS "Platform admins can manage seller payout items" ON public.seller_payout_items;

CREATE POLICY "Platform admins can read seller payouts"
  ON public.seller_payouts FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Platform admins can read seller payout items"
  ON public.seller_payout_items FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

REVOKE INSERT, UPDATE, DELETE ON public.seller_payouts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.seller_payout_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.seller_balance_adjustments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_refunds FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_logs FROM authenticated;

REVOKE ALL ON FUNCTION public.finalize_paid_order(uuid, uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_order_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_order(uuid, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_order_refund(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_seller_payout_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_seller_payout_status(uuid, text, text) TO authenticated;

COMMIT;
