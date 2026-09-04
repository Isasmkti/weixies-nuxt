-- Three-day seller settlement window and refund-review holds.
-- Payout submission is performed by the trusted server cron after this
-- migration makes the existing payout RPCs callable by service_role.

BEGIN;

-- The service role is already a privileged server credential. Treating it as
-- a platform administrator lets background jobs reuse the same atomic payout
-- batching functions without weakening authenticated-user authorization.
CREATE OR REPLACE FUNCTION public.is_seller_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_seller_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.set_seller_payout_status(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) TO service_role;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_payout_status_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_payout_status_check
  CHECK (payout_status IN ('pending', 'held', 'refund_review', 'released', 'refunded'));

CREATE TABLE public.order_refund_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  provider_reference_id text NOT NULL,
  provider_refund_id text,
  provider_failure_code text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  resolved_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_refund_requests_pkey PRIMARY KEY (id),
  CONSTRAINT order_refund_requests_order_key UNIQUE (order_id),
  CONSTRAINT order_refund_requests_provider_reference_key UNIQUE (provider_reference_id),
  CONSTRAINT order_refund_requests_provider_refund_key UNIQUE (provider_refund_id),
  CONSTRAINT order_refund_requests_reason_check CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  CONSTRAINT order_refund_requests_status_check CHECK (
    status IN ('requested', 'manual_action_required', 'submitted', 'succeeded', 'failed', 'cancelled')
  )
);

CREATE INDEX order_refund_requests_status_requested_at_idx
  ON public.order_refund_requests (status, requested_at DESC);

ALTER TABLE public.order_refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read order refund requests"
  ON public.order_refund_requests FOR SELECT TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage order refund requests"
  ON public.order_refund_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.order_refund_requests FROM authenticated;
GRANT SELECT ON public.order_refund_requests TO authenticated;
GRANT ALL PRIVILEGES ON public.order_refund_requests TO service_role;

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

  IF NOT FOUND AND NOT EXISTS (
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

REVOKE ALL ON FUNCTION public.place_order_refund_hold(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_order_refund_hold(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_refund_hold(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_order_refund_hold(uuid) TO service_role;

-- Existing unpaid seller balances become eligible after three days as well.
UPDATE public.order_items AS order_item
SET available_for_payout_at = LEAST(
  COALESCE(order_item.available_for_payout_at, 'infinity'::timestamp with time zone),
  COALESCE(customer_order.paid_at, customer_order.created_at, now()) + interval '3 days'
)
FROM public.orders AS customer_order
WHERE customer_order.id = order_item.order_id
  AND customer_order.status = 'paid'
  AND order_item.seller_id IS NOT NULL
  AND order_item.payout_status IN ('held', 'refund_review');

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
      available_for_payout_at = v_paid_at + interval '3 days'
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

CREATE OR REPLACE FUNCTION public.audit_order_refund_request_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.record_activity(
    NEW.requested_by,
    'admin',
    CASE
      WHEN TG_OP = 'INSERT' THEN 'order_refund.requested'
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'order_refund.status_changed'
      ELSE 'order_refund.updated'
    END,
    'order_refund',
    NEW.id::text,
    jsonb_build_object(
      'order_id', NEW.order_id,
      'status', NEW.status,
      'provider_refund_id', NEW.provider_refund_id
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_order_refund_requests_activity
  AFTER INSERT OR UPDATE ON public.order_refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_order_refund_request_activity();

COMMIT;
