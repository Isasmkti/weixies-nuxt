-- Product-level ownership, checkout serialization, and duplicate receipt holds.
-- Forward-only. Run docs/sql/purchase-access-preflight.sql before deployment.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS purchase_conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_conflict_reason text;

-- All access-changing flows acquire these locks in product_id order BEFORE
-- locking orders, ownership rows, or order items. Downloads use the same helper.
CREATE OR REPLACE FUNCTION public.lock_purchase_access(p_profile_id uuid, p_product_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_profile_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Buyer and product are required.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('purchase:' || p_profile_id::text || ':' || p_product_id::text, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.lock_purchase_access(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_purchase_access(uuid, bigint) TO service_role;

-- Canonical ownership takes precedence. Paid history is a fail-closed fallback
-- for legacy rows whose ownership has not yet been reconciled.
CREATE OR REPLACE FUNCTION public.get_purchase_order_id(
  p_profile_id uuid, p_product_id bigint, p_exclude_order_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT candidate.order_id
  FROM (
    SELECT ownership.order_id, 0 AS priority, ownership.created_at
    FROM public.user_products AS ownership
    WHERE ownership.profile_id = p_profile_id
      AND ownership.product_id = p_product_id
      AND (p_exclude_order_id IS NULL OR ownership.order_id <> p_exclude_order_id)
    UNION ALL
    SELECT customer_order.id, 1 AS priority, COALESCE(customer_order.paid_at, customer_order.created_at)
    FROM public.orders AS customer_order
    JOIN public.order_items AS item ON item.order_id = customer_order.id
    WHERE customer_order.profile_id = p_profile_id
      AND customer_order.status = 'paid'
      AND item.product_id = p_product_id
      AND (p_exclude_order_id IS NULL OR customer_order.id <> p_exclude_order_id)
  ) AS candidate
  ORDER BY candidate.priority, candidate.created_at, candidate.order_id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_purchase_order_id(uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_order_id(uuid, bigint, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_purchase_ownership_batch(p_profile_id uuid, p_product_ids bigint[])
RETURNS TABLE (product_id bigint, order_id uuid, has_access boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_profile_id IS NULL OR COALESCE(cardinality(p_product_ids), 0) > 100 THEN
    RAISE EXCEPTION 'Buyer and at most 100 product IDs are required.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_product_ids) AS value WHERE value IS NULL OR value <= 0) THEN
    RAISE EXCEPTION 'Product IDs must be positive integers.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT requested.product_id,
         CASE WHEN customer_order.profile_id = p_profile_id THEN resolved.order_id ELSE NULL::uuid END,
         COALESCE(customer_order.profile_id = p_profile_id
           AND customer_order.status = 'paid'
           AND NOT customer_order.purchase_conflict
           AND EXISTS (
             SELECT 1 FROM public.user_products AS ownership
             WHERE ownership.profile_id = p_profile_id
               AND ownership.product_id = requested.product_id
               AND ownership.order_id = resolved.order_id
           ), false)
  FROM (SELECT DISTINCT value AS product_id FROM unnest(p_product_ids) AS value) AS requested
  CROSS JOIN LATERAL (
    SELECT public.get_purchase_order_id(p_profile_id, requested.product_id) AS order_id
  ) AS resolved
  LEFT JOIN public.orders AS customer_order ON customer_order.id = resolved.order_id
  WHERE resolved.order_id IS NOT NULL
  ORDER BY requested.product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_purchase_ownership_batch(uuid, bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_ownership_batch(uuid, bigint[]) TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_purchased_cart_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_buyer_id uuid;
  v_order_id uuid;
BEGIN
  SELECT profile_id INTO v_buyer_id FROM public.cart WHERE id = NEW.cart_id;
  PERFORM public.lock_purchase_access(v_buyer_id, NEW.product_id);
  v_order_id := public.get_purchase_order_id(v_buyer_id, NEW.product_id);
  IF v_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'product_already_purchased' USING
      ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('product_id', NEW.product_id, 'order_id', v_order_id)::text;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_purchased_cart_item ON public.cart_items;
CREATE TRIGGER prevent_purchased_cart_item
BEFORE INSERT OR UPDATE OF cart_id, product_id ON public.cart_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_purchased_cart_item();

CREATE OR REPLACE FUNCTION public.prevent_purchased_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_buyer_id uuid;
  v_order_id uuid;
BEGIN
  SELECT profile_id INTO v_buyer_id FROM public.orders WHERE id = NEW.order_id;
  PERFORM public.lock_purchase_access(v_buyer_id, NEW.product_id);
  v_order_id := public.get_purchase_order_id(v_buyer_id, NEW.product_id, NEW.order_id);
  IF v_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'product_already_purchased' USING
      ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('product_id', NEW.product_id, 'order_id', v_order_id)::text;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_purchased_order_item ON public.order_items;
CREATE TRIGGER prevent_purchased_order_item
BEFORE INSERT OR UPDATE OF order_id, product_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_purchased_order_item();

-- Browser writes cannot fabricate an order/payment or mutate entitlement
-- counters. Existing read policies and cart delete functionality are preserved.
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items, public.user_products, public.payments
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE ON public.cart_items FROM PUBLIC, anon, authenticated;
-- Table-level REVOKE does not remove independent historical column grants.
DO $$
DECLARE
  v_column record;
BEGIN
  FOR v_column IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('orders', 'order_items', 'user_products', 'payments', 'cart_items')
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      v_column.column_name, v_column.column_name, v_column.table_name);
  END LOOP;
END;
$$;
GRANT ALL ON public.orders, public.order_items, public.user_products, public.payments, public.cart_items
  TO service_role;
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_products FROM PUBLIC, anon;
DROP POLICY IF EXISTS "Buyers can view own purchases" ON public.user_products;
CREATE POLICY "Buyers can view own purchases"
  ON public.user_products FOR SELECT TO authenticated USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "Purchase reads stay within buyer account" ON public.user_products;
CREATE POLICY "Purchase reads stay within buyer account"
  ON public.user_products AS RESTRICTIVE FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_seller_platform_admin());
GRANT SELECT ON public.user_products TO authenticated;

CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_profile_id uuid,
  p_product_id bigint,
  p_product_license_id uuid
)
RETURNS TABLE (
  order_id uuid,
  order_number text,
  total_amount integer,
  product_name text,
  license_name text,
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
  v_license public.product_licenses;
  v_seller public.sellers;
  v_order public.orders;
  v_order_item_id bigint;
  v_commission_rate numeric := 0;
  v_commission_amount integer := 0;
  v_seller_earning integer := 0;
  v_claim_token uuid;
  v_should_create_invoice boolean := false;
  v_existing_order_id uuid;
  v_existing_license_id uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_profile_id IS NULL OR p_product_id IS NULL OR p_product_license_id IS NULL THEN
    RAISE EXCEPTION 'Buyer, product, and product license are required.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Buyer profile was not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.lock_purchase_access(p_profile_id, p_product_id);
  v_existing_order_id := public.get_purchase_order_id(p_profile_id, p_product_id);
  IF v_existing_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'product_already_purchased' USING
      ERRCODE = 'P0001',
      DETAIL = jsonb_build_object('product_id', p_product_id, 'order_id', v_existing_order_id)::text;
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND status = 'published'
  FOR SHARE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product is not available.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_license
  FROM public.product_licenses
  WHERE id = p_product_license_id
    AND product_id = p_product_id
    AND is_active = true
  FOR SHARE;

  IF v_license.id IS NULL THEN
    RAISE EXCEPTION 'The selected product license is no longer available.' USING ERRCODE = 'P0002';
  END IF;
  IF v_license.price <= 0 THEN
    RAISE EXCEPTION 'The selected product license price is invalid.' USING ERRCODE = '22023';
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
    v_commission_amount := round(v_license.price * v_commission_rate)::integer;
    v_seller_earning := v_license.price - v_commission_amount;
  END IF;

  SELECT candidate.* INTO v_order
  FROM public.orders AS candidate
  WHERE candidate.profile_id = p_profile_id
    AND candidate.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.order_items
      WHERE order_items.order_id = candidate.id
        AND order_items.product_id = p_product_id
    )
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NOT NULL THEN
    SELECT snapshot.product_license_id INTO v_existing_license_id
    FROM public.order_items AS item
    JOIN public.order_item_licenses AS snapshot ON snapshot.order_item_id = item.id
    WHERE item.order_id = v_order.id AND item.product_id = p_product_id
    LIMIT 1;

    IF v_existing_license_id IS DISTINCT FROM p_product_license_id THEN
      RAISE EXCEPTION 'product_payment_pending' USING
        ERRCODE = 'P0001',
        DETAIL = jsonb_build_object('product_id', p_product_id, 'order_id', v_order.id)::text;
    END IF;

    -- Never reclaim an invoice creation attempt merely because time passed.
    -- Xendit may have accepted it before a timeout/crash. The server reconciles
    -- by external_id, and a replacement waits for a definitive terminal result.
    v_claim_token := v_order.invoice_creation_token;
    v_should_create_invoice := false;


    RETURN QUERY SELECT
      v_order.id,
      v_order.order_number,
      v_order.total_amount,
      v_product.name,
      v_license.name,
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
  ) VALUES (
    p_profile_id,
    'ORD-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_license.price,
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
    v_license.price,
    v_product.seller_id,
    v_commission_rate,
    v_commission_amount,
    v_seller_earning
  )
  RETURNING id INTO v_order_item_id;

  INSERT INTO public.order_item_licenses (
    order_item_id,
    product_license_id,
    license_name_snapshot,
    usage_terms_snapshot,
    allow_commercial_use_snapshot,
    allow_resale_snapshot,
    price_snapshot
  ) VALUES (
    v_order_item_id,
    v_license.id,
    v_license.name,
    v_license.usage_terms,
    v_license.allow_commercial_use,
    v_license.allow_resale,
    v_license.price
  );

  RETURN QUERY SELECT
    v_order.id,
    v_order.order_number,
    v_order.total_amount,
    v_product.name,
    v_license.name,
    false,
    v_claim_token,
    true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_paid_order(
  p_order_id uuid, p_profile_id uuid, p_paid_at timestamp with time zone DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order public.orders;
  v_product_id bigint;
  v_product_ids bigint[];
  v_conflict_ids bigint[] := ARRAY[]::bigint[];
  v_existing_order_id uuid;
  v_owner_order_id uuid;
  v_granted_count integer := 0;
  v_inserted integer := 0;
  v_cart_items_removed integer := 0;
  v_paid_at timestamp with time zone := COALESCE(p_paid_at, now());
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Buyer is required.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT product_id ORDER BY product_id), ARRAY[]::bigint[])
  INTO v_product_ids FROM public.order_items WHERE order_id = p_order_id;
  FOREACH v_product_id IN ARRAY v_product_ids LOOP
    PERFORM public.lock_purchase_access(p_profile_id, v_product_id);
  END LOOP;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.profile_id <> p_profile_id THEN
    RAISE EXCEPTION 'Order ownership does not match.' USING ERRCODE = '42501';
  END IF;
  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'A refunded order cannot be fulfilled again.' USING ERRCODE = 'P0001';
  END IF;
  IF cardinality(v_product_ids) = 0 THEN
    RAISE EXCEPTION 'Order has no products to fulfill.' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_product_id IN ARRAY v_product_ids LOOP
    SELECT ownership.order_id INTO v_owner_order_id
    FROM public.user_products AS ownership
    WHERE ownership.profile_id = p_profile_id AND ownership.product_id = v_product_id
    FOR UPDATE;

    -- Replaying the canonical receipt remains idempotent even if another
    -- historical duplicate receipt also exists. A flagged duplicate must never
    -- become a new entitlement when the original is later refunded.
    IF v_owner_order_id = p_order_id THEN
      CONTINUE;
    END IF;
    v_existing_order_id := public.get_purchase_order_id(p_profile_id, v_product_id, p_order_id);
    IF v_existing_order_id IS NOT NULL OR v_order.purchase_conflict THEN
      v_conflict_ids := array_append(v_conflict_ids, v_product_id);
      CONTINUE;
    END IF;

    INSERT INTO public.user_products (profile_id, product_id, order_id, created_at)
    VALUES (p_profile_id, v_product_id, p_order_id, v_paid_at)
    ON CONFLICT (profile_id, product_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_granted_count := v_granted_count + v_inserted;
  END LOOP;

  DELETE FROM public.cart_items AS cart_item USING public.cart AS buyer_cart
  WHERE buyer_cart.id = cart_item.cart_id
    AND buyer_cart.profile_id = p_profile_id
    AND cart_item.product_id = ANY(v_product_ids);
  GET DIAGNOSTICS v_cart_items_removed = ROW_COUNT;

  UPDATE public.order_items
  SET payout_status = CASE
        WHEN product_id = ANY(v_conflict_ids) THEN 'refund_review'
        ELSE 'held'
      END,
      available_for_payout_at = v_paid_at + interval '3 days'
  WHERE order_id = p_order_id
    AND seller_id IS NOT NULL
    AND payout_status = 'pending';

  -- Do not move already released funds backwards; a duplicate legacy receipt
  -- whose payout has begun is reconciled through the existing refund/debt flow.
  UPDATE public.order_items
  SET payout_status = 'refund_review'
  WHERE order_id = p_order_id
    AND product_id = ANY(v_conflict_ids)
    AND seller_id IS NOT NULL
    AND payout_status = 'held';

  UPDATE public.orders
  SET status = 'paid',
      paid_at = COALESCE(paid_at, v_paid_at),
      fulfilled_at = COALESCE(fulfilled_at, now()),
      invoice_creation_token = NULL,
      invoice_creation_started_at = NULL,
      purchase_conflict = purchase_conflict OR cardinality(v_conflict_ids) > 0,
      purchase_conflict_reason = CASE WHEN cardinality(v_conflict_ids) > 0
        THEN 'Duplicate payment for an already purchased product. Refund/reconciliation required.'
        ELSE purchase_conflict_reason END
  WHERE id = p_order_id;

  IF cardinality(v_conflict_ids) > 0 AND NOT v_order.purchase_conflict THEN
    PERFORM public.record_activity(
      p_profile_id, 'buyer', 'order.duplicate_payment', 'order', p_order_id::text,
      jsonb_build_object('product_ids', v_conflict_ids, 'seller_funds_on_hold', true)
    );
  END IF;

  RETURN jsonb_build_object(
    'productIds', to_jsonb(v_product_ids), 'grantedCount', v_granted_count,
    'cartItemsRemoved', v_cart_items_removed,
    'conflictingProductIds', to_jsonb(v_conflict_ids),
    'requiresReconciliation', cardinality(v_conflict_ids) > 0 OR v_order.purchase_conflict
  );
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_paid_order(uuid, uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_order(uuid, uuid, timestamp with time zone) TO service_role;

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
  v_product_id bigint;
  v_profile_id uuid;
  v_failed_payout_ids uuid[] := ARRAY[]::uuid[];
  v_adjustment_count integer := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT profile_id INTO v_profile_id FROM public.orders WHERE id = p_order_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Order was not found.' USING ERRCODE = 'P0002';
  END IF;
  FOR v_product_id IN SELECT DISTINCT product_id FROM public.order_items WHERE order_id = p_order_id ORDER BY product_id LOOP
    PERFORM public.lock_purchase_access(v_profile_id, v_product_id);
  END LOOP;
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
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL OR p_requested_by IS NULL OR char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Order, administrator, and a quality issue reason are required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_requested_by AND role = 'admin'
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
  IF EXISTS (
    SELECT 1
    FROM public.seller_payout_items payout_item
    JOIN public.seller_payouts payout ON payout.id = payout_item.payout_id
    JOIN public.order_items order_item ON order_item.id = payout_item.order_item_id
    WHERE order_item.order_id = p_order_id
      AND payout.status IN ('pending', 'processing', 'paid')
  ) THEN
    RAISE EXCEPTION 'Seller payout processing has already started for this order.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.order_items
  SET payout_status = 'refund_review'
  WHERE order_id = p_order_id
    AND seller_id IS NOT NULL
    AND payout_status = 'held';

  IF NOT FOUND AND NOT v_order.purchase_conflict AND NOT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = p_order_id AND payout_status = 'refund_review'
  ) THEN
    RAISE EXCEPTION 'This order no longer has seller funds available to hold.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_refund_requests (
    order_id, requested_by, reason, status, provider_reference_id
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
  WHERE public.order_refund_requests.status IN ('failed', 'cancelled', 'manual_action_required')
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

  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND purchase_conflict AND status = 'paid') THEN
    RAISE EXCEPTION 'Duplicate payment must be refunded before its hold can be resolved.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.order_items
  SET payout_status = 'held'
  WHERE order_id = p_order_id
    AND payout_status = 'refund_review';

  UPDATE public.order_refund_requests
  SET status = 'cancelled', resolved_at = now(), updated_at = now()
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN NEXT v_request;
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, bigint, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.apply_order_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_refund(uuid, text) TO service_role;

COMMIT;
