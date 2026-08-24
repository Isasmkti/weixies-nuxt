-- Commission distribution reconciliation
-- Date: 2026-08-24
--
-- Keeps an auditable commission-rate snapshot on every order item and fixes
-- two payout carry-forward gaps:
--   1. eligible unpaid sales from an earlier period are automatically carried
--      into the next payout calculation; and
--   2. a positive balance correction can be paid without requiring a new sale.

BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric;

-- Older rows did not retain the configured rate. The effective rate derived
-- from their immutable monetary snapshot is the closest auditable equivalent.
UPDATE public.order_items
SET commission_rate_snapshot = CASE
  WHEN seller_id IS NULL THEN 0
  WHEN price > 0 THEN commission_amount::numeric / price::numeric
  ELSE 0
END
WHERE commission_rate_snapshot IS NULL;

ALTER TABLE public.order_items
  ALTER COLUMN commission_rate_snapshot SET DEFAULT 0,
  ALTER COLUMN commission_rate_snapshot SET NOT NULL;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_commission_rate_snapshot_range_check
    CHECK (commission_rate_snapshot >= 0 AND commission_rate_snapshot <= 1) NOT VALID,
  ADD CONSTRAINT order_items_commission_distribution_check
    CHECK (
      (
        seller_id IS NULL
        AND commission_rate_snapshot = 0
        AND commission_amount = 0
        AND seller_earning = 0
      )
      OR (
        seller_id IS NOT NULL
        AND commission_amount + seller_earning = price
      )
    ) NOT VALID;

COMMENT ON COLUMN public.order_items.commission_rate_snapshot IS
  'Platform commission rate captured when the checkout order is created.';

-- Snapshot the configured rate and its resulting monetary split in the same
-- transaction that snapshots the product price.
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_profile_id uuid,
  p_product_id bigint
)
RETURNS TABLE (
  order_id uuid,
  order_number text,
  total_amount integer,
  product_name text,
  resumed boolean,
  invoice_creation_token uuid,
  should_create_invoice boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product public.products;
  v_seller public.sellers;
  v_order public.orders;
  v_commission_rate numeric := 0;
  v_commission_amount integer := 0;
  v_seller_earning integer := 0;
  v_claim_token uuid;
  v_should_create_invoice boolean := false;
BEGIN
  IF p_profile_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Buyer and product are required.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Buyer profile was not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('checkout:' || p_profile_id::text || ':' || p_product_id::text, 0)
  );

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND status = 'published'
  FOR SHARE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product is not available.' USING ERRCODE = 'P0002';
  END IF;
  IF v_product.price IS NULL OR v_product.price <= 0 THEN
    RAISE EXCEPTION 'Product price is invalid.' USING ERRCODE = '22023';
  END IF;

  IF v_product.seller_id IS NOT NULL THEN
    SELECT * INTO v_seller
    FROM public.sellers
    WHERE id = v_product.seller_id
    FOR SHARE;

    IF v_seller.id IS NULL OR v_seller.status <> 'approved' THEN
      RAISE EXCEPTION 'Seller is not currently accepting orders.' USING ERRCODE = 'P0001';
    END IF;
    IF v_seller.profile_id = p_profile_id THEN
      RAISE EXCEPTION 'You cannot purchase your own product.' USING ERRCODE = 'P0001';
    END IF;
    IF v_seller.commission_rate < 0 OR v_seller.commission_rate > 1 THEN
      RAISE EXCEPTION 'Seller commission configuration is invalid.' USING ERRCODE = '22023';
    END IF;

    v_commission_rate := v_seller.commission_rate;
    v_commission_amount := round(v_product.price * v_commission_rate)::integer;
    v_seller_earning := v_product.price - v_commission_amount;
  END IF;

  SELECT candidate.* INTO v_order
  FROM public.orders AS candidate
  WHERE candidate.profile_id = p_profile_id
    AND candidate.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.order_items
      WHERE order_items.order_id = candidate.id
        AND order_items.product_id = p_product_id
    )
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payments
      WHERE payments.order_id = v_order.id
        AND payments.provider = 'xendit'
        AND payments.provider_invoice_id IS NOT NULL
    ) AND (
      v_order.invoice_creation_token IS NULL
      OR v_order.invoice_creation_started_at < now() - interval '2 minutes'
    ) THEN
      v_claim_token := gen_random_uuid();
      v_should_create_invoice := true;
      UPDATE public.orders
      SET invoice_creation_token = v_claim_token,
          invoice_creation_started_at = now()
      WHERE id = v_order.id;
    ELSE
      v_claim_token := v_order.invoice_creation_token;
    END IF;

    RETURN QUERY SELECT
      v_order.id,
      v_order.order_number,
      v_order.total_amount,
      v_product.name,
      true,
      v_claim_token,
      v_should_create_invoice;
    RETURN;
  END IF;

  v_claim_token := gen_random_uuid();
  INSERT INTO public.orders (
    profile_id,
    order_number,
    total_amount,
    status,
    created_at,
    invoice_creation_token,
    invoice_creation_started_at
  )
  VALUES (
    p_profile_id,
    'ORD-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_product.price,
    'pending',
    now(),
    v_claim_token,
    now()
  )
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    price,
    seller_id,
    commission_rate_snapshot,
    commission_amount,
    seller_earning
  ) VALUES (
    v_order.id,
    v_product.id,
    v_product.price,
    v_product.seller_id,
    v_commission_rate,
    v_commission_amount,
    v_seller_earning
  );

  RETURN QUERY SELECT
    v_order.id,
    v_order.order_number,
    v_order.total_amount,
    v_product.name,
    false,
    v_claim_token,
    true;
END;
$$;

-- Candidate calculations now use every mature, unpaid sale before the chosen
-- period end. The missing lower bound is intentional: a balance blocked by a
-- prior refund debt must carry forward instead of being stranded forever.
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
      AND oi.seller_id IS NOT NULL
      AND oi.payout_status = 'held'
      AND oi.available_for_payout_at <= now()
      AND oi.seller_earning > 0
      AND COALESCE(o.paid_at, o.created_at) < p_period_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS existing_item
        JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
        WHERE existing_item.order_item_id = oi.id
          AND existing_payout.status <> 'failed'
      )
    GROUP BY oi.seller_id
  ),
  pending_adjustments AS (
    SELECT
      adjustment.seller_id,
      SUM(adjustment.amount)::bigint AS amount
    FROM public.seller_balance_adjustments AS adjustment
    WHERE adjustment.status = 'pending'
      AND adjustment.created_at < p_period_end
    GROUP BY adjustment.seller_id
  ),
  balances AS (
    SELECT
      COALESCE(sales.seller_id, adjustment.seller_id) AS seller_id,
      COALESCE(sales.gross_amount, 0)::bigint AS gross_amount,
      COALESCE(adjustment.amount, 0)::bigint AS adjustment_amount,
      COALESCE(sales.item_count, 0)::bigint AS item_count
    FROM eligible_sales AS sales
    FULL OUTER JOIN pending_adjustments AS adjustment
      ON adjustment.seller_id = sales.seller_id
  )
  SELECT
    seller.id,
    seller.store_name,
    seller.bank_name,
    seller.bank_account,
    balance.gross_amount + balance.adjustment_amount,
    balance.item_count
  FROM balances AS balance
  JOIN public.sellers AS seller ON seller.id = balance.seller_id
  WHERE seller.status = 'approved'
    AND balance.gross_amount + balance.adjustment_amount > 0
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
  v_oldest_sale_at timestamp with time zone;
  v_oldest_adjustment_at timestamp with time zone;
  v_effective_period_start timestamp with time zone;
  v_payout public.seller_payouts;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_seller_id IS NULL OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_start >= p_period_end THEN
    RAISE EXCEPTION 'Seller and a valid payout period are required.' USING ERRCODE = '22023';
  END IF;

  -- Serializes all payout creation for this seller. Refund processing still
  -- locks the affected order/payout rows and therefore reconciles safely.
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

  SELECT
    COALESCE(SUM(oi.seller_earning), 0)::bigint,
    MIN(COALESCE(o.paid_at, o.created_at))
  INTO v_gross_amount, v_oldest_sale_at
  FROM public.order_items AS oi
  JOIN public.orders AS o ON o.id = oi.order_id
  WHERE oi.id = ANY(v_item_ids);

  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::uuid[])
  INTO v_adjustment_ids
  FROM (
    SELECT id
    FROM public.seller_balance_adjustments
    WHERE seller_id = p_seller_id
      AND status = 'pending'
      AND created_at < p_period_end
    ORDER BY created_at, id
    FOR UPDATE
  ) AS candidate;

  SELECT
    COALESCE(SUM(amount), 0)::bigint,
    MIN(created_at)
  INTO v_adjustment_amount, v_oldest_adjustment_at
  FROM public.seller_balance_adjustments
  WHERE id = ANY(v_adjustment_ids);

  v_amount := v_gross_amount + v_adjustment_amount;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'No positive eligible balance was found for this payout.' USING ERRCODE = 'P0001';
  END IF;
  IF v_gross_amount > 2147483647
     OR v_adjustment_amount NOT BETWEEN -2147483648 AND 2147483647
     OR v_amount > 2147483647 THEN
    RAISE EXCEPTION 'Payout amount exceeds the supported integer range.' USING ERRCODE = '22003';
  END IF;

  v_effective_period_start := LEAST(
    p_period_start,
    COALESCE(v_oldest_sale_at, p_period_start),
    COALESCE(v_oldest_adjustment_at, p_period_start)
  );

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
    v_effective_period_start,
    p_period_end,
    btrim(v_seller.bank_name),
    btrim(v_seller.bank_account)
  )
  RETURNING * INTO v_payout;

  INSERT INTO public.seller_payout_items (payout_id, order_item_id)
  SELECT v_payout.id, item_id
  FROM unnest(v_item_ids) AS item_id;

  UPDATE public.seller_balance_adjustments
  SET status = 'applied', payout_id = v_payout.id, applied_at = now()
  WHERE id = ANY(v_adjustment_ids);

  RETURN NEXT v_payout;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;

COMMIT;
