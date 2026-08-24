-- Security hardening for checkout, API rate limits, and seller file isolation
-- Date: 2026-08-21

BEGIN;

-- SECURITY DEFINER authorization helpers must not resolve unqualified objects
-- through a caller-controlled search path.
CREATE OR REPLACE FUNCTION public.is_seller_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_seller_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_platform_admin() TO authenticated;

-- A seller-owned product file row may only point into that same product's
-- storage folder. This closes cross-seller signed URL substitution.
ALTER TABLE public.product_files
  ADD CONSTRAINT product_files_owned_storage_path_check
  CHECK (
    split_part(file_url, '/', 1) = product_id::text
    AND file_url !~ '(^|/)\.\.(/|$)'
    AND lower(file_url) ~ '\.zip$'
  ) NOT VALID;

DROP POLICY IF EXISTS "Sellers can manage own product files" ON public.product_files;
CREATE POLICY "Sellers can manage own product files"
  ON public.product_files
  FOR ALL
  TO authenticated
  USING (
    split_part(product_files.file_url, '/', 1) = product_files.product_id::text
    AND lower(product_files.file_url) ~ '\.zip$'
    AND EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = product_files.product_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  )
  WITH CHECK (
    split_part(product_files.file_url, '/', 1) = product_files.product_id::text
    AND product_files.file_url !~ '(^|/)\.\.(/|$)'
    AND lower(product_files.file_url) ~ '\.zip$'
    AND EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = product_files.product_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Sellers can upload own product ZIP files" ON storage.objects;
CREATE POLICY "Sellers can upload own product ZIP files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND split_part(storage.objects.name, '/', 1) ~ '^[0-9]+$'
    AND lower(storage.objects.name) ~ '\.zip$'
    AND storage.objects.name !~ '(^|/)\.\.(/|$)'
    AND EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = split_part(storage.objects.name, '/', 1)::bigint
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

UPDATE storage.buckets
SET public = false,
    file_size_limit = 209715200,
    allowed_mime_types = ARRAY[
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream'
    ]
WHERE id = 'products';

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'profile_img';

-- Distributed fixed-window limiter used by trusted server endpoints. Keys are
-- opaque action/user identifiers and contain no secrets.
CREATE TABLE public.api_rate_limits (
  key text NOT NULL,
  window_started_at timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (key)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;

CREATE POLICY "Service role can manage API rate limits"
  ON public.api_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NULLIF(btrim(p_key), '') IS NULL
     OR p_limit < 1 OR p_limit > 1000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.api_rate_limits AS limiter (key, window_started_at, request_count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE
  SET window_started_at = CASE
        WHEN limiter.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN now()
        ELSE limiter.window_started_at
      END,
      request_count = CASE
        WHEN limiter.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN 1
        ELSE limiter.request_count + 1
      END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;

-- Serialize checkout for a buyer/product pair and snapshot authoritative price,
-- seller approval, and commission values inside one database transaction.
ALTER TABLE public.orders
  ADD COLUMN invoice_creation_token uuid,
  ADD COLUMN invoice_creation_started_at timestamp with time zone;

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

    v_commission_amount := round(v_product.price * v_seller.commission_rate)::integer;
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
    commission_amount,
    seller_earning
  ) VALUES (
    v_order.id,
    v_product.id,
    v_product.price,
    v_product.seller_id,
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

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, bigint) TO service_role;

COMMIT;
