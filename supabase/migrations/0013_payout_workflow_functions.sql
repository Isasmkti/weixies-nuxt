BEGIN;

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
  SELECT
    s.id,
    s.store_name,
    s.bank_name,
    s.bank_account,
    SUM(oi.seller_earning)::bigint,
    COUNT(*)::bigint
  FROM public.order_items AS oi
  JOIN public.orders AS o ON o.id = oi.order_id
  JOIN public.sellers AS s ON s.id = oi.seller_id
  WHERE o.status = 'paid'
    AND s.status = 'approved'
    AND oi.payout_status IN ('pending', 'held')
    AND oi.seller_earning > 0
    AND COALESCE(o.paid_at, o.created_at) >= p_period_start
    AND COALESCE(o.paid_at, o.created_at) <= p_period_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.seller_payout_items AS existing_item
      JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
      WHERE existing_item.order_item_id = oi.id
        AND existing_payout.status <> 'failed'
    )
  GROUP BY s.id, s.store_name, s.bank_name, s.bank_account
  ORDER BY s.store_name;
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
  v_amount bigint;
  v_payout public.seller_payouts;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_seller_id IS NULL OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_start >= p_period_end THEN
    RAISE EXCEPTION 'Seller and a valid payout period are required.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('seller-payout:' || p_seller_id::text, 0));

  SELECT SUM(oi.seller_earning)::bigint INTO v_amount
  FROM public.order_items AS oi
  JOIN public.orders AS o ON o.id = oi.order_id
  WHERE oi.seller_id = p_seller_id
    AND o.status = 'paid'
    AND oi.payout_status IN ('pending', 'held')
    AND oi.seller_earning > 0
    AND COALESCE(o.paid_at, o.created_at) >= p_period_start
    AND COALESCE(o.paid_at, o.created_at) <= p_period_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.seller_payout_items AS existing_item
      JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
      WHERE existing_item.order_item_id = oi.id
        AND existing_payout.status <> 'failed'
    );

  IF COALESCE(v_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'No eligible order items were found for this payout.' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount > 2147483647 THEN
    RAISE EXCEPTION 'Payout amount exceeds the supported integer range.' USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.seller_payouts (seller_id, amount, status, period_start, period_end)
  VALUES (p_seller_id, v_amount::integer, 'pending', p_period_start, p_period_end)
  RETURNING * INTO v_payout;

  INSERT INTO public.seller_payout_items (payout_id, order_item_id)
  SELECT v_payout.id, oi.id
  FROM public.order_items AS oi
  JOIN public.orders AS o ON o.id = oi.order_id
  WHERE oi.seller_id = p_seller_id
    AND o.status = 'paid'
    AND oi.payout_status IN ('pending', 'held')
    AND oi.seller_earning > 0
    AND COALESCE(o.paid_at, o.created_at) >= p_period_start
    AND COALESCE(o.paid_at, o.created_at) <= p_period_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.seller_payout_items AS existing_item
      JOIN public.seller_payouts AS existing_payout ON existing_payout.id = existing_item.payout_id
      WHERE existing_item.order_item_id = oi.id
        AND existing_payout.status <> 'failed'
        AND existing_payout.id <> v_payout.id
    );

  UPDATE public.order_items AS oi
  SET payout_status = 'held'
  WHERE EXISTS (
    SELECT 1 FROM public.seller_payout_items AS payout_item
    WHERE payout_item.payout_id = v_payout.id
      AND payout_item.order_item_id = oi.id
  );

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
  IF p_status = 'paid' AND NULLIF(btrim(p_reference_no), '') IS NULL THEN
    RAISE EXCEPTION 'A payment reference is required.' USING ERRCODE = '22023';
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

  UPDATE public.seller_payouts
  SET status = p_status,
      reference_no = CASE WHEN p_status = 'paid' THEN btrim(p_reference_no) ELSE reference_no END,
      paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE NULL END
  WHERE id = p_payout_id
  RETURNING * INTO v_payout;

  UPDATE public.order_items AS oi
  SET payout_status = CASE WHEN p_status = 'paid' THEN 'released' ELSE 'held' END
  WHERE EXISTS (
    SELECT 1 FROM public.seller_payout_items AS payout_item
    WHERE payout_item.payout_id = p_payout_id
      AND payout_item.order_item_id = oi.id
  );

  RETURN NEXT v_payout;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_seller_payout_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_payout_batch(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_seller_payout_status(uuid, text, text) TO authenticated;

COMMIT;
