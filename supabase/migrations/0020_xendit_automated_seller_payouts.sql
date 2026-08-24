-- Automated seller payouts through Xendit Payouts API v3
-- Date: 2026-08-24

BEGIN;

ALTER TABLE public.sellers
  ADD COLUMN payout_recipient_type text NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN payout_account_holder_name text,
  ADD COLUMN payout_given_name text,
  ADD COLUMN payout_surname text,
  ADD COLUMN payout_business_name text,
  ADD COLUMN payout_routing_type text,
  ADD COLUMN payout_routing_value text,
  ADD COLUMN payout_address_line_1 text,
  ADD COLUMN payout_city text,
  ADD COLUMN payout_province text,
  ADD COLUMN payout_postal_code text;

ALTER TABLE public.sellers
  ADD CONSTRAINT sellers_payout_recipient_type_check
    CHECK (payout_recipient_type IN ('INDIVIDUAL', 'BUSINESS')),
  ADD CONSTRAINT sellers_payout_routing_type_check
    CHECK (
      payout_routing_type IS NULL
      OR payout_routing_type IN (
        'SWIFT', 'IBAN', 'SORT_CODE', 'ABA', 'BSB', 'WALLET',
        'CLABE', 'MOBILE_NO', 'BUSINESS_REG_NO', 'NATIONAL_ID'
      )
    );

ALTER TABLE public.seller_payouts
  ADD COLUMN provider text,
  ADD COLUMN provider_payout_id text,
  ADD COLUMN provider_reference_id text,
  ADD COLUMN provider_status text,
  ADD COLUMN provider_failure_code text,
  ADD COLUMN provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN provider_submitted_at timestamp with time zone,
  ADD COLUMN provider_updated_at timestamp with time zone,
  ADD COLUMN provider_submission_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN reversed_at timestamp with time zone,
  ADD COLUMN recipient_type_snapshot text,
  ADD COLUMN account_holder_name_snapshot text,
  ADD COLUMN recipient_given_name_snapshot text,
  ADD COLUMN recipient_surname_snapshot text,
  ADD COLUMN recipient_business_name_snapshot text,
  ADD COLUMN routing_type_snapshot text,
  ADD COLUMN routing_value_snapshot text,
  ADD COLUMN address_line_1_snapshot text,
  ADD COLUMN city_snapshot text,
  ADD COLUMN province_snapshot text,
  ADD COLUMN postal_code_snapshot text;

ALTER TABLE public.seller_payouts
  DROP CONSTRAINT IF EXISTS seller_payouts_status_check;

ALTER TABLE public.seller_payouts
  ADD CONSTRAINT seller_payouts_status_check
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'reversed')),
  ADD CONSTRAINT seller_payouts_provider_attempts_check
    CHECK (provider_submission_attempts >= 0);

CREATE UNIQUE INDEX seller_payouts_provider_payout_id_uidx
  ON public.seller_payouts (provider, provider_payout_id)
  WHERE provider_payout_id IS NOT NULL;

CREATE UNIQUE INDEX seller_payouts_provider_reference_id_uidx
  ON public.seller_payouts (provider, provider_reference_id)
  WHERE provider_reference_id IS NOT NULL;

CREATE TABLE public.xendit_payout_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  event_name text NOT NULL,
  provider_payout_id text,
  provider_reference_id text NOT NULL,
  provider_status text NOT NULL,
  payout_id uuid NOT NULL REFERENCES public.seller_payouts(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT xendit_payout_events_pkey PRIMARY KEY (id),
  CONSTRAINT xendit_payout_events_event_key_key UNIQUE (event_key)
);

CREATE INDEX xendit_payout_events_payout_id_idx
  ON public.xendit_payout_events (payout_id, processed_at DESC);

ALTER TABLE public.xendit_payout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read Xendit payout events"
  ON public.xendit_payout_events FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage Xendit payout events"
  ON public.xendit_payout_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.xendit_payout_events FROM authenticated;

-- Add payout readiness to the existing admin candidate RPC without exposing
-- beneficiary details in its result.
DROP FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone);

CREATE FUNCTION public.get_seller_payout_candidates(
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
          AND existing_payout.status <> 'reversed'
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

-- Recreate payout batching so an amount returned by Xendit can be batched
-- again after a provider reversal. Beneficiary completeness is checked here
-- as well as at submission time to avoid creating unusable pending batches.
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
        FROM public.seller_payout_items AS existing_item
        JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
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
  SET status = 'applied', payout_id = v_payout.id, applied_at = now()
  WHERE adjustment.id = ANY(v_adjustment_ids);

  RETURN NEXT v_payout;
END;
$$;

-- Trusted server claim. The beneficiary is snapshotted before the external
-- request so retries always send an identical body with one idempotency key.
CREATE FUNCTION public.claim_seller_payout_for_xendit(p_payout_id uuid)
RETURNS SETOF public.seller_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payout public.seller_payouts;
  v_seller public.sellers;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payout
  FROM public.seller_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF v_payout.id IS NULL THEN
    RAISE EXCEPTION 'Payout was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_payout.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Only pending or processing payouts can be submitted.' USING ERRCODE = 'P0001';
  END IF;
  IF v_payout.status = 'processing' AND v_payout.provider IS DISTINCT FROM 'xendit' THEN
    RAISE EXCEPTION 'This payout is already handled outside Xendit.' USING ERRCODE = 'P0001';
  END IF;

  IF v_payout.status = 'pending' THEN
    SELECT * INTO v_seller
    FROM public.sellers
    WHERE id = v_payout.seller_id
      AND status = 'approved'
    FOR UPDATE;

    IF v_seller.id IS NULL THEN
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

    UPDATE public.seller_payouts
    SET status = 'processing',
        provider = 'xendit',
        provider_reference_id = 'seller-payout-' || id::text,
        bank_name_snapshot = btrim(v_seller.bank_name),
        bank_account_snapshot = btrim(v_seller.bank_account),
        recipient_type_snapshot = v_seller.payout_recipient_type,
        account_holder_name_snapshot = btrim(v_seller.payout_account_holder_name),
        recipient_given_name_snapshot = NULLIF(btrim(v_seller.payout_given_name), ''),
        recipient_surname_snapshot = NULLIF(btrim(v_seller.payout_surname), ''),
        recipient_business_name_snapshot = NULLIF(btrim(v_seller.payout_business_name), ''),
        routing_type_snapshot = v_seller.payout_routing_type,
        routing_value_snapshot = btrim(v_seller.payout_routing_value),
        address_line_1_snapshot = btrim(v_seller.payout_address_line_1),
        city_snapshot = btrim(v_seller.payout_city),
        province_snapshot = btrim(v_seller.payout_province),
        postal_code_snapshot = btrim(v_seller.payout_postal_code),
        provider_submission_attempts = provider_submission_attempts + 1,
        provider_updated_at = NULL
    WHERE id = p_payout_id
    RETURNING * INTO v_payout;
  ELSE
    UPDATE public.seller_payouts
    SET provider_submission_attempts = provider_submission_attempts + 1
    WHERE id = p_payout_id
    RETURNING * INTO v_payout;
  END IF;

  RETURN NEXT v_payout;
END;
$$;

-- Applies both real webhooks and authenticated status synchronization. All
-- monetary checks and ledger transitions happen atomically in PostgreSQL.
CREATE FUNCTION public.apply_xendit_payout_event(
  p_event_key text,
  p_event_name text,
  p_provider_payout_id text,
  p_provider_reference_id text,
  p_provider_status text,
  p_failure_code text,
  p_processor_reference text,
  p_amount bigint,
  p_currency text,
  p_provider_updated_at timestamp with time zone,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payout public.seller_payouts;
  v_inserted integer := 0;
  v_status text := upper(COALESCE(p_provider_status, ''));
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_event_key), '') IS NULL
     OR NULLIF(btrim(p_event_name), '') IS NULL
     OR NULLIF(btrim(p_provider_reference_id), '') IS NULL
     OR NULLIF(v_status, '') IS NULL THEN
    RAISE EXCEPTION 'A complete Xendit payout event is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payout
  FROM public.seller_payouts
  WHERE provider = 'xendit'
    AND provider_reference_id = p_provider_reference_id
  FOR UPDATE;

  IF v_payout.id IS NULL THEN
    RAISE EXCEPTION 'Xendit payout reference was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_provider_payout_id IS NOT NULL
     AND v_payout.provider_payout_id IS NOT NULL
     AND v_payout.provider_payout_id <> p_provider_payout_id THEN
    RAISE EXCEPTION 'Xendit payout ID does not match.' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount IS NOT NULL AND p_amount <> v_payout.amount THEN
    RAISE EXCEPTION 'Xendit payout amount does not match.' USING ERRCODE = 'P0001';
  END IF;
  IF p_currency IS NOT NULL AND upper(p_currency) <> 'IDR' THEN
    RAISE EXCEPTION 'Xendit payout currency does not match.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.xendit_payout_events (
    event_key,
    event_name,
    provider_payout_id,
    provider_reference_id,
    provider_status,
    payout_id,
    payload
  ) VALUES (
    p_event_key,
    p_event_name,
    p_provider_payout_id,
    p_provider_reference_id,
    v_status,
    v_payout.id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (event_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('duplicate', true, 'payoutId', v_payout.id, 'status', v_payout.status);
  END IF;

  -- Xendit may retry or deliver callbacks out of order. Preserve every event
  -- for audit, but do not let an older provider timestamp roll state back.
  IF p_provider_updated_at IS NOT NULL
     AND v_payout.provider_updated_at IS NOT NULL
     AND p_provider_updated_at < v_payout.provider_updated_at THEN
    RETURN jsonb_build_object(
      'duplicate', false,
      'ignoredAsStale', true,
      'payoutId', v_payout.id,
      'status', v_payout.status,
      'providerStatus', v_payout.provider_status
    );
  END IF;

  -- Only REVERSED may move a locally paid payout again. Other late terminal
  -- events are retained above without contradicting the settled ledger.
  IF (v_payout.status = 'paid' AND v_status NOT IN ('SUCCEEDED', 'REVERSED'))
     OR (v_payout.status = 'failed' AND v_status NOT IN ('FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'))
     OR (v_payout.status = 'reversed' AND v_status <> 'REVERSED') THEN
    RETURN jsonb_build_object(
      'duplicate', false,
      'ignoredForTerminalState', true,
      'payoutId', v_payout.id,
      'status', v_payout.status,
      'providerStatus', v_payout.provider_status
    );
  END IF;

  UPDATE public.seller_payouts
  SET provider_payout_id = COALESCE(provider_payout_id, NULLIF(btrim(p_provider_payout_id), '')),
      provider_status = v_status,
      provider_failure_code = NULLIF(btrim(p_failure_code), ''),
      -- Keep full callbacks in the admin-only event table. This summary lives
      -- on a seller-readable payout row and therefore excludes recipient and
      -- business payload details.
      provider_response = jsonb_strip_nulls(jsonb_build_object(
        'status', v_status,
        'failure_code', NULLIF(btrim(p_failure_code), ''),
        'processor_reference', NULLIF(btrim(p_processor_reference), ''),
        'updated', p_provider_updated_at
      )),
      provider_submitted_at = CASE
        WHEN p_provider_payout_id IS NOT NULL THEN COALESCE(provider_submitted_at, now())
        ELSE provider_submitted_at
      END,
      provider_updated_at = COALESCE(p_provider_updated_at, provider_updated_at)
  WHERE id = v_payout.id;

  IF v_status = 'SUCCEEDED' AND v_payout.status = 'processing' THEN
    UPDATE public.seller_payouts
    SET status = 'paid',
        reference_no = COALESCE(NULLIF(btrim(p_processor_reference), ''), NULLIF(btrim(p_provider_payout_id), '')),
        paid_at = COALESCE(p_provider_updated_at, now()),
        reversed_at = NULL
    WHERE id = v_payout.id;

    UPDATE public.order_items AS order_item
    SET payout_status = 'released'
    WHERE order_item.payout_status = 'held'
      AND EXISTS (
        SELECT 1 FROM public.seller_payout_items AS payout_item
        WHERE payout_item.payout_id = v_payout.id
          AND payout_item.order_item_id = order_item.id
      );
  ELSIF v_status IN ('FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED')
        AND v_payout.status = 'processing' THEN
    UPDATE public.seller_payouts
    SET status = 'failed', paid_at = NULL
    WHERE id = v_payout.id;

    UPDATE public.order_items AS order_item
    SET payout_status = 'held'
    WHERE order_item.payout_status <> 'refunded'
      AND EXISTS (
        SELECT 1 FROM public.seller_payout_items AS payout_item
        WHERE payout_item.payout_id = v_payout.id
          AND payout_item.order_item_id = order_item.id
      );

    UPDATE public.seller_balance_adjustments
    SET status = 'pending', payout_id = NULL, applied_at = NULL
    WHERE payout_id = v_payout.id;

    INSERT INTO public.seller_balance_adjustments (
      seller_id, order_item_id, amount, reason, reference_no, source_payout_id
    )
    SELECT
      adjustment.seller_id,
      adjustment.order_item_id,
      -adjustment.amount,
      'refund_reversal',
      adjustment.reference_no,
      v_payout.id
    FROM public.seller_balance_adjustments AS adjustment
    WHERE adjustment.source_payout_id = v_payout.id
      AND adjustment.reason = 'refund'
      AND adjustment.status = 'applied'
    ON CONFLICT (order_item_id, reason) DO NOTHING;

    UPDATE public.seller_balance_adjustments
    SET status = 'cancelled', applied_at = now()
    WHERE source_payout_id = v_payout.id
      AND reason = 'refund'
      AND status = 'pending';
  ELSIF v_status = 'REVERSED' AND v_payout.status = 'paid' THEN
    UPDATE public.seller_payouts
    SET status = 'reversed', reversed_at = COALESCE(p_provider_updated_at, now())
    WHERE id = v_payout.id;

    UPDATE public.order_items AS order_item
    SET payout_status = 'held'
    WHERE order_item.payout_status = 'released'
      AND EXISTS (
        SELECT 1 FROM public.seller_payout_items AS payout_item
        WHERE payout_item.payout_id = v_payout.id
          AND payout_item.order_item_id = order_item.id
      );

    UPDATE public.seller_balance_adjustments
    SET status = 'pending', payout_id = NULL, applied_at = NULL
    WHERE payout_id = v_payout.id;

    INSERT INTO public.seller_balance_adjustments (
      seller_id, order_item_id, amount, reason, reference_no, source_payout_id
    )
    SELECT
      adjustment.seller_id,
      adjustment.order_item_id,
      -adjustment.amount,
      'refund_reversal',
      adjustment.reference_no,
      v_payout.id
    FROM public.seller_balance_adjustments AS adjustment
    WHERE adjustment.source_payout_id = v_payout.id
      AND adjustment.reason = 'refund'
      AND adjustment.status = 'applied'
    ON CONFLICT (order_item_id, reason) DO NOTHING;

    UPDATE public.seller_balance_adjustments
    SET status = 'cancelled', applied_at = now()
    WHERE source_payout_id = v_payout.id
      AND reason = 'refund'
      AND status = 'pending';
  END IF;

  SELECT refreshed.* INTO v_payout
  FROM public.seller_payouts AS refreshed
  WHERE refreshed.id = v_payout.id;
  RETURN jsonb_build_object(
    'duplicate', false,
    'payoutId', v_payout.id,
    'status', v_payout.status,
    'providerStatus', v_payout.provider_status
  );
END;
$$;

-- Even a platform admin cannot manually declare a Xendit payout paid. Only a
-- service-role webhook/sync transaction may move its accounting state.
CREATE FUNCTION public.enforce_xendit_payout_status_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (OLD.provider = 'xendit' OR NEW.provider = 'xendit')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Xendit payout status is controlled by provider events.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_xendit_payout_status_source
  BEFORE UPDATE ON public.seller_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_xendit_payout_status_source();

REVOKE ALL ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_seller_payout_for_xendit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_xendit_payout_event(text, text, text, text, text, text, text, bigint, text, timestamp with time zone, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_seller_payout_for_xendit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_xendit_payout_event(text, text, text, text, text, text, text, bigint, text, timestamp with time zone, jsonb) TO service_role;

COMMIT;
