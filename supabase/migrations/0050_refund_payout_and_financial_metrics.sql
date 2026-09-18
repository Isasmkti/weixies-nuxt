-- Refund/payout reconciliation and precise marketplace financial metrics.
--
-- A refund must remain possible after a payout batch has been created:
--   * pending batches are cancelled before they reach the provider;
--   * processing/paid batches are reconciled by apply_order_refund() through
--     the existing negative seller balance adjustment; and
--   * cancelling a refund restores the item's real payout state.
--
-- Dashboard metrics distinguish gross merchandise value, completed refunds,
-- net GMV, and the platform's retained revenue. "Net platform revenue" here
-- is net of completed refunds, but intentionally remains before payment fees,
-- tax, and operating expenses because those costs are not stored in the app.

BEGIN;

CREATE OR REPLACE FUNCTION public.place_order_refund_hold(
  p_order_id uuid,
  p_requested_by uuid,
  p_reason text
)
RETURNS SETOF public.order_refund_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders;
  v_request public.order_refund_requests;
  v_pending_payout_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL
     OR p_requested_by IS NULL
     OR char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Order, administrator, and a quality issue reason are required.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_requested_by
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Platform admin access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status <> 'paid' THEN
    RAISE EXCEPTION 'Only a paid order can be reviewed for refund.' USING ERRCODE = 'P0001';
  END IF;

  -- A batch that has not been claimed by the payout worker is still fully
  -- reversible. Lock it, mark it failed, and return every unaffected item and
  -- balance adjustment to the next automatic payout cycle.
  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::uuid[])
  INTO v_pending_payout_ids
  FROM (
    SELECT payout.id
    FROM public.seller_payouts AS payout
    WHERE payout.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS payout_item
        JOIN public.order_items AS order_item
          ON order_item.id = payout_item.order_item_id
        WHERE payout_item.payout_id = payout.id
          AND order_item.order_id = p_order_id
      )
    ORDER BY payout.id
    FOR UPDATE OF payout
  ) AS candidate;

  UPDATE public.seller_payouts
  SET status = 'failed',
      provider_status = COALESCE(provider_status, 'CANCELLED_BEFORE_SUBMISSION'),
      provider_failure_code = COALESCE(provider_failure_code, 'REFUND_HOLD')
  WHERE id = ANY(v_pending_payout_ids);

  UPDATE public.order_items AS order_item
  SET payout_status = 'held'
  WHERE order_item.order_id <> p_order_id
    AND order_item.payout_status <> 'refunded'
    AND EXISTS (
      SELECT 1
      FROM public.seller_payout_items AS payout_item
      WHERE payout_item.payout_id = ANY(v_pending_payout_ids)
        AND payout_item.order_item_id = order_item.id
    );

  UPDATE public.seller_balance_adjustments
  SET status = 'pending',
      payout_id = NULL,
      applied_at = NULL
  WHERE payout_id = ANY(v_pending_payout_ids);

  -- For processing/paid payouts this is an accounting hold, not a claim that
  -- the provider transfer can still be stopped. apply_order_refund() records
  -- an equal seller debt if the transfer has already progressed too far.
  UPDATE public.order_items
  SET payout_status = 'refund_review'
  WHERE order_id = p_order_id
    AND seller_id IS NOT NULL
    AND payout_status IN ('pending', 'held', 'released');

  IF EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = p_order_id
      AND seller_id IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = p_order_id
      AND seller_id IS NOT NULL
      AND payout_status = 'refund_review'
  ) THEN
    RAISE EXCEPTION 'Seller earnings for this order cannot enter refund review.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Platform-owned products have no seller item to hold, but must still be
  -- refundable through the same buyer-facing workflow.
  INSERT INTO public.order_refund_requests (
    order_id,
    requested_by,
    reason,
    status,
    provider_reference_id
  ) VALUES (
    p_order_id,
    p_requested_by,
    btrim(p_reason),
    'requested',
    'order-refund-' || gen_random_uuid()::text
  )
  ON CONFLICT (order_id) DO UPDATE
  SET requested_by = EXCLUDED.requested_by,
      reason = EXCLUDED.reason,
      status = 'requested',
      provider_reference_id = 'order-refund-' || gen_random_uuid()::text,
      provider_refund_id = NULL,
      provider_failure_code = NULL,
      provider_response = '{}'::jsonb,
      submitted_at = NULL,
      resolved_at = NULL,
      updated_at = now()
  WHERE public.order_refund_requests.status IN (
    'failed',
    'cancelled',
    'manual_action_required'
  )
  RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    SELECT * INTO v_request
    FROM public.order_refund_requests
    WHERE order_id = p_order_id;
  END IF;

  RETURN NEXT v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order_refund_hold(p_order_id uuid)
RETURNS SETOF public.order_refund_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.order_refund_requests;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM public.order_refund_requests
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Refund review was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status IN ('submitted', 'succeeded') THEN
    RAISE EXCEPTION 'A submitted or completed refund cannot be released.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = p_order_id
      AND purchase_conflict
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Duplicate payment must be refunded before its hold can be resolved.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Restore released when Xendit already paid the linked payout. Otherwise
  -- return to held; an in-flight success webhook can then release it normally.
  UPDATE public.order_items AS order_item
  SET payout_status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.seller_payout_items AS payout_item
      JOIN public.seller_payouts AS payout ON payout.id = payout_item.payout_id
      WHERE payout_item.order_item_id = order_item.id
        AND payout.status = 'paid'
    ) THEN 'released'
    ELSE 'held'
  END
  WHERE order_item.order_id = p_order_id
    AND order_item.payout_status = 'refund_review';

  UPDATE public.order_refund_requests
  SET status = 'cancelled',
      resolved_at = now(),
      updated_at = now()
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN NEXT v_request;
END;
$$;

-- A provider may fail or reverse an in-flight payout while a refund review is
-- open, which can temporarily move an item back to `held`. The active refund
-- request is therefore an independent payout exclusion in both candidate
-- discovery and the transactional batch creation step.
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
  item_count bigint,
  payout_ready boolean
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
      order_item.seller_id,
      SUM(order_item.seller_earning)::bigint AS gross_amount,
      COUNT(*)::bigint AS item_count
    FROM public.order_items AS order_item
    JOIN public.orders AS customer_order ON customer_order.id = order_item.order_id
    WHERE customer_order.status = 'paid'
      AND customer_order.fulfilled_at IS NOT NULL
      AND order_item.seller_id IS NOT NULL
      AND order_item.payout_status = 'held'
      AND order_item.available_for_payout_at <= now()
      AND order_item.seller_earning > 0
      AND COALESCE(customer_order.paid_at, customer_order.created_at) < p_period_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_refund_requests AS refund_request
        WHERE refund_request.order_id = customer_order.id
          AND refund_request.status <> 'cancelled'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS existing_item
        JOIN public.seller_payouts AS existing_payout
          ON existing_payout.id = existing_item.payout_id
        WHERE existing_item.order_item_id = order_item.id
          AND existing_payout.status NOT IN ('failed', 'reversed')
      )
    GROUP BY order_item.seller_id
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
      COALESCE(sale.seller_id, adjustment.seller_id) AS seller_id,
      COALESCE(sale.gross_amount, 0)::bigint AS gross_amount,
      COALESCE(adjustment.amount, 0)::bigint AS adjustment_amount,
      COALESCE(sale.item_count, 0)::bigint AS item_count
    FROM eligible_sales AS sale
    FULL OUTER JOIN pending_adjustments AS adjustment
      ON adjustment.seller_id = sale.seller_id
  )
  SELECT
    seller.id,
    seller.store_name,
    seller.bank_name,
    seller.bank_account,
    balance.gross_amount + balance.adjustment_amount,
    balance.item_count,
    (
      NULLIF(btrim(seller.bank_name), '') IS NOT NULL
      AND NULLIF(btrim(seller.bank_account), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_account_holder_name), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_routing_type), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_routing_value), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_address_line_1), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_city), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_province), '') IS NOT NULL
      AND NULLIF(btrim(seller.payout_postal_code), '') IS NOT NULL
      AND (
        (
          seller.payout_recipient_type = 'INDIVIDUAL'
          AND NULLIF(btrim(seller.payout_given_name), '') IS NOT NULL
          AND NULLIF(btrim(seller.payout_surname), '') IS NOT NULL
        )
        OR (
          seller.payout_recipient_type = 'BUSINESS'
          AND NULLIF(btrim(seller.payout_business_name), '') IS NOT NULL
        )
      )
    ) AS payout_ready
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
  IF p_seller_id IS NULL
     OR p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_start >= p_period_end THEN
    RAISE EXCEPTION 'Seller and a valid payout period are required.' USING ERRCODE = '22023';
  END IF;

  SELECT seller.* INTO v_seller
  FROM public.sellers AS seller
  WHERE seller.id = p_seller_id
  FOR UPDATE;

  IF v_seller.id IS NULL OR v_seller.status <> 'approved' THEN
    RAISE EXCEPTION 'An approved seller is required.' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(btrim(v_seller.bank_name), '') IS NULL
     OR NULLIF(btrim(v_seller.bank_account), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_account_holder_name), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_routing_type), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_routing_value), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_address_line_1), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_city), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_province), '') IS NULL
     OR NULLIF(btrim(v_seller.payout_postal_code), '') IS NULL
     OR (
       v_seller.payout_recipient_type = 'INDIVIDUAL'
       AND (
         NULLIF(btrim(v_seller.payout_given_name), '') IS NULL
         OR NULLIF(btrim(v_seller.payout_surname), '') IS NULL
       )
     )
     OR (
       v_seller.payout_recipient_type = 'BUSINESS'
       AND NULLIF(btrim(v_seller.payout_business_name), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Seller Xendit beneficiary details are incomplete.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::bigint[])
  INTO v_item_ids
  FROM (
    SELECT order_item.id
    FROM public.order_items AS order_item
    JOIN public.orders AS customer_order ON customer_order.id = order_item.order_id
    WHERE order_item.seller_id = p_seller_id
      AND customer_order.status = 'paid'
      AND customer_order.fulfilled_at IS NOT NULL
      AND order_item.payout_status = 'held'
      AND order_item.available_for_payout_at <= now()
      AND order_item.seller_earning > 0
      AND COALESCE(customer_order.paid_at, customer_order.created_at) < p_period_end
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_refund_requests AS refund_request
        WHERE refund_request.order_id = customer_order.id
          AND refund_request.status <> 'cancelled'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.seller_payout_items AS existing_item
        JOIN public.seller_payouts AS existing_payout
          ON existing_payout.id = existing_item.payout_id
        WHERE existing_item.order_item_id = order_item.id
          AND existing_payout.status NOT IN ('failed', 'reversed')
      )
    ORDER BY order_item.id
    FOR UPDATE OF order_item
  ) AS candidate;

  SELECT
    COALESCE(SUM(order_item.seller_earning), 0)::bigint,
    MIN(COALESCE(customer_order.paid_at, customer_order.created_at))
  INTO v_gross_amount, v_oldest_sale_at
  FROM public.order_items AS order_item
  JOIN public.orders AS customer_order ON customer_order.id = order_item.order_id
  WHERE order_item.id = ANY(v_item_ids);

  SELECT COALESCE(array_agg(candidate.id), ARRAY[]::uuid[])
  INTO v_adjustment_ids
  FROM (
    SELECT adjustment.id
    FROM public.seller_balance_adjustments AS adjustment
    WHERE adjustment.seller_id = p_seller_id
      AND adjustment.status = 'pending'
      AND adjustment.created_at < p_period_end
    ORDER BY adjustment.created_at, adjustment.id
    FOR UPDATE
  ) AS candidate;

  SELECT
    COALESCE(SUM(adjustment.amount), 0)::bigint,
    MIN(adjustment.created_at)
  INTO v_adjustment_amount, v_oldest_adjustment_at
  FROM public.seller_balance_adjustments AS adjustment
  WHERE adjustment.id = ANY(v_adjustment_ids);

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

  UPDATE public.seller_balance_adjustments AS adjustment
  SET status = 'applied',
      payout_id = v_payout.id,
      applied_at = now()
  WHERE adjustment.id = ANY(v_adjustment_ids);

  RETURN NEXT v_payout;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can view dashboard analytics'
      USING ERRCODE = '42501';
  END IF;

  WITH period_bounds AS (
    SELECT
      now() - interval '30 days' AS current_start,
      now() - interval '60 days' AS previous_start
  ),
  order_financials AS (
    SELECT
      customer_order.id,
      customer_order.status,
      customer_order.total_amount::bigint AS total_amount,
      COALESCE(customer_order.paid_at, customer_order.created_at) AS sale_at,
      COALESCE(SUM(
        CASE
          WHEN order_item.seller_id IS NULL THEN order_item.price
          ELSE order_item.commission_amount
        END
      ), 0)::bigint AS platform_revenue,
      COALESCE(SUM(order_item.seller_earning), 0)::bigint AS seller_earnings
    FROM public.orders AS customer_order
    LEFT JOIN public.order_items AS order_item
      ON order_item.order_id = customer_order.id
    WHERE customer_order.status IN ('paid', 'refunded')
    GROUP BY
      customer_order.id,
      customer_order.status,
      customer_order.total_amount,
      customer_order.paid_at,
      customer_order.created_at
  ),
  completed_refunds AS (
    SELECT DISTINCT ON (refund.order_id)
      refund.order_id,
      refund.amount::bigint AS amount,
      refund.updated_at AS refunded_at
    FROM public.payment_refunds AS refund
    WHERE refund.status = 'succeeded'
    ORDER BY refund.order_id, refund.updated_at DESC, refund.id DESC
  ),
  order_metrics AS (
    SELECT
      COALESCE(SUM(financial.total_amount), 0)::bigint AS gross_gmv,
      COALESCE(SUM(refund.amount), 0)::bigint AS refund_amount,
      COALESCE(SUM(financial.total_amount), 0)::bigint
        - COALESCE(SUM(refund.amount), 0)::bigint AS net_gmv,
      COALESCE(SUM(financial.platform_revenue), 0)::bigint AS gross_platform_revenue,
      COALESCE(SUM(financial.platform_revenue)
        FILTER (WHERE refund.order_id IS NULL), 0)::bigint AS net_platform_revenue,
      COALESCE(SUM(financial.seller_earnings)
        FILTER (WHERE refund.order_id IS NULL), 0)::bigint AS net_seller_earnings,
      COUNT(*)::bigint AS successful_transactions,

      COALESCE(SUM(financial.total_amount) FILTER (
        WHERE financial.sale_at >= bounds.current_start
      ), 0)::bigint AS current_gross_gmv,
      COALESCE(SUM(financial.total_amount) FILTER (
        WHERE financial.sale_at >= bounds.previous_start
          AND financial.sale_at < bounds.current_start
      ), 0)::bigint AS previous_gross_gmv,
      COALESCE(SUM(financial.total_amount) FILTER (
        WHERE financial.sale_at >= bounds.current_start
      ), 0)::bigint
        - COALESCE(SUM(refund.amount) FILTER (
          WHERE refund.refunded_at >= bounds.current_start
        ), 0)::bigint AS current_net_gmv,
      COALESCE(SUM(financial.total_amount) FILTER (
        WHERE financial.sale_at >= bounds.previous_start
          AND financial.sale_at < bounds.current_start
      ), 0)::bigint
        - COALESCE(SUM(refund.amount) FILTER (
          WHERE refund.refunded_at >= bounds.previous_start
            AND refund.refunded_at < bounds.current_start
        ), 0)::bigint AS previous_net_gmv,
      COALESCE(SUM(financial.platform_revenue) FILTER (
        WHERE financial.sale_at >= bounds.current_start
      ), 0)::bigint
        - COALESCE(SUM(financial.platform_revenue) FILTER (
          WHERE refund.refunded_at >= bounds.current_start
        ), 0)::bigint AS current_net_revenue,
      COALESCE(SUM(financial.platform_revenue) FILTER (
        WHERE financial.sale_at >= bounds.previous_start
          AND financial.sale_at < bounds.current_start
      ), 0)::bigint
        - COALESCE(SUM(financial.platform_revenue) FILTER (
          WHERE refund.refunded_at >= bounds.previous_start
            AND refund.refunded_at < bounds.current_start
        ), 0)::bigint AS previous_net_revenue,
      COUNT(*) FILTER (
        WHERE financial.sale_at >= bounds.current_start
      )::bigint AS current_transactions,
      COUNT(*) FILTER (
        WHERE financial.sale_at >= bounds.previous_start
          AND financial.sale_at < bounds.current_start
      )::bigint AS previous_transactions
    FROM order_financials AS financial
    LEFT JOIN completed_refunds AS refund ON refund.order_id = financial.id
    CROSS JOIN period_bounds AS bounds
  ),
  user_metrics AS (
    SELECT
      COUNT(*)::bigint AS total_users,
      COUNT(*) FILTER (WHERE created_at >= bounds.current_start)::bigint AS current_users,
      COUNT(*) FILTER (
        WHERE created_at >= bounds.previous_start
          AND created_at < bounds.current_start
      )::bigint AS previous_users
    FROM public.profiles
    CROSS JOIN period_bounds AS bounds
  ),
  seller_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'approved')::bigint AS active_sellers,
      COUNT(*) FILTER (
        WHERE status = 'approved'
          AND created_at >= bounds.current_start
      )::bigint AS current_sellers,
      COUNT(*) FILTER (
        WHERE status = 'approved'
          AND created_at >= bounds.previous_start
          AND created_at < bounds.current_start
      )::bigint AS previous_sellers,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_sellers
    FROM public.sellers
    CROSS JOIN period_bounds AS bounds
  ),
  chart_days AS (
    SELECT generate_series(current_date - 29, current_date, interval '1 day')::date AS day
  ),
  daily_sales AS (
    SELECT
      financial.sale_at::date AS day,
      SUM(financial.total_amount)::bigint AS gross_gmv,
      SUM(financial.platform_revenue)::bigint AS gross_platform_revenue,
      COUNT(*)::bigint AS transactions
    FROM order_financials AS financial
    WHERE financial.sale_at >= current_date - 29
      AND financial.sale_at < current_date + 1
    GROUP BY financial.sale_at::date
  ),
  daily_refunds AS (
    SELECT
      refund.refunded_at::date AS day,
      SUM(refund.amount)::bigint AS refund_amount,
      SUM(financial.platform_revenue)::bigint AS platform_refund
    FROM completed_refunds AS refund
    JOIN order_financials AS financial ON financial.id = refund.order_id
    WHERE refund.refunded_at >= current_date - 29
      AND refund.refunded_at < current_date + 1
    GROUP BY refund.refunded_at::date
  ),
  chart_points AS (
    SELECT
      chart_day.day AS date,
      COALESCE(sale.gross_gmv, 0)::bigint AS gross_gmv,
      COALESCE(refund.refund_amount, 0)::bigint AS refunds,
      (COALESCE(sale.gross_gmv, 0) - COALESCE(refund.refund_amount, 0))::bigint AS net_gmv,
      (
        COALESCE(sale.gross_platform_revenue, 0)
        - COALESCE(refund.platform_refund, 0)
      )::bigint AS net_revenue,
      COALESCE(sale.transactions, 0)::bigint AS transactions
    FROM chart_days AS chart_day
    LEFT JOIN daily_sales AS sale ON sale.day = chart_day.day
    LEFT JOIN daily_refunds AS refund ON refund.day = chart_day.day
    ORDER BY chart_day.day
  ),
  recent_orders AS (
    SELECT
      customer_order.id,
      customer_order.order_number,
      customer_order.total_amount,
      customer_order.status,
      customer_order.created_at,
      profile.full_name AS buyer_name,
      COALESCE(
        array_agg(DISTINCT product.name) FILTER (WHERE product.name IS NOT NULL),
        ARRAY[]::text[]
      ) AS product_names
    FROM public.orders AS customer_order
    LEFT JOIN public.profiles AS profile ON profile.id = customer_order.profile_id
    LEFT JOIN public.order_items AS order_item ON order_item.order_id = customer_order.id
    LEFT JOIN public.products AS product ON product.id = order_item.product_id
    GROUP BY
      customer_order.id,
      customer_order.order_number,
      customer_order.total_amount,
      customer_order.status,
      customer_order.created_at,
      profile.full_name
    ORDER BY customer_order.created_at DESC
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'gross_gmv', order_metrics.gross_gmv,
      'refund_amount', order_metrics.refund_amount,
      'net_gmv', order_metrics.net_gmv,
      -- Keep gmv as a compatibility alias with the now-explicit net meaning.
      'gmv', order_metrics.net_gmv,
      'gross_platform_revenue', order_metrics.gross_platform_revenue,
      'net_platform_revenue', order_metrics.net_platform_revenue,
      'net_seller_earnings', order_metrics.net_seller_earnings,
      'gross_gmv_change', CASE
        WHEN order_metrics.previous_gross_gmv = 0 THEN
          CASE WHEN order_metrics.current_gross_gmv > 0 THEN 100 ELSE 0 END
        ELSE round((
          (order_metrics.current_gross_gmv - order_metrics.previous_gross_gmv)::numeric
          / order_metrics.previous_gross_gmv
        ) * 100, 1)
      END,
      'net_gmv_change', CASE
        WHEN order_metrics.previous_net_gmv = 0 THEN CASE
          WHEN order_metrics.current_net_gmv > 0 THEN 100
          WHEN order_metrics.current_net_gmv < 0 THEN -100
          ELSE 0
        END
        ELSE round((
          (order_metrics.current_net_gmv - order_metrics.previous_net_gmv)::numeric
          / abs(order_metrics.previous_net_gmv)
        ) * 100, 1)
      END,
      'gmv_change', CASE
        WHEN order_metrics.previous_net_gmv = 0 THEN CASE
          WHEN order_metrics.current_net_gmv > 0 THEN 100
          WHEN order_metrics.current_net_gmv < 0 THEN -100
          ELSE 0
        END
        ELSE round((
          (order_metrics.current_net_gmv - order_metrics.previous_net_gmv)::numeric
          / abs(order_metrics.previous_net_gmv)
        ) * 100, 1)
      END,
      'net_revenue_change', CASE
        WHEN order_metrics.previous_net_revenue = 0 THEN CASE
          WHEN order_metrics.current_net_revenue > 0 THEN 100
          WHEN order_metrics.current_net_revenue < 0 THEN -100
          ELSE 0
        END
        ELSE round((
          (order_metrics.current_net_revenue - order_metrics.previous_net_revenue)::numeric
          / abs(order_metrics.previous_net_revenue)
        ) * 100, 1)
      END,
      'transactions', order_metrics.successful_transactions,
      'transaction_change', CASE
        WHEN order_metrics.previous_transactions = 0 THEN
          CASE WHEN order_metrics.current_transactions > 0 THEN 100 ELSE 0 END
        ELSE round((
          (order_metrics.current_transactions - order_metrics.previous_transactions)::numeric
          / order_metrics.previous_transactions
        ) * 100, 1)
      END,
      'users', user_metrics.total_users,
      'user_change', CASE
        WHEN user_metrics.previous_users = 0 THEN
          CASE WHEN user_metrics.current_users > 0 THEN 100 ELSE 0 END
        ELSE round((
          (user_metrics.current_users - user_metrics.previous_users)::numeric
          / user_metrics.previous_users
        ) * 100, 1)
      END,
      'active_sellers', seller_metrics.active_sellers,
      'seller_change', CASE
        WHEN seller_metrics.previous_sellers = 0 THEN
          CASE WHEN seller_metrics.current_sellers > 0 THEN 100 ELSE 0 END
        ELSE round((
          (seller_metrics.current_sellers - seller_metrics.previous_sellers)::numeric
          / seller_metrics.previous_sellers
        ) * 100, 1)
      END
    ),
    'pending_sellers', seller_metrics.pending_sellers,
    'chart', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', chart_point.date,
        'gross_gmv', chart_point.gross_gmv,
        'refunds', chart_point.refunds,
        'net_gmv', chart_point.net_gmv,
        'net_revenue', chart_point.net_revenue,
        -- Compatibility alias for older clients.
        'revenue', chart_point.net_gmv,
        'transactions', chart_point.transactions
      ) ORDER BY chart_point.date)
      FROM chart_points AS chart_point
    ), '[]'::jsonb),
    'recent_orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(recent_order) ORDER BY recent_order.created_at DESC)
      FROM recent_orders AS recent_order
    ), '[]'::jsonb)
  )
  INTO result
  FROM order_metrics, user_metrics, seller_metrics;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.place_order_refund_hold(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_order_refund_hold(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_refund_hold(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_order_refund_hold(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_seller_payout_candidates(
  timestamp with time zone,
  timestamp with time zone
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(
  timestamp with time zone,
  timestamp with time zone
) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_seller_payout_batch(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_batch(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_dashboard()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard()
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
