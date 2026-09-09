-- Approved product releases and a fresh three-download allowance per release.
-- Existing order_items.download_count remains the lifetime audit counter.

BEGIN;

ALTER TABLE public.product_files
  ADD COLUMN IF NOT EXISTS version_sequence integer,
  ADD COLUMN IF NOT EXISTS release_status text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Preserve every existing file as an already released version. There was no
-- historical file-level moderation state from which a safer distinction could
-- be reconstructed.
WITH ranked AS (
  SELECT id,
         (row_number() OVER (PARTITION BY product_id ORDER BY created_at NULLS FIRST, id) + 9)::integer AS sequence
  FROM public.product_files
)
UPDATE public.product_files AS file
SET version_sequence = ranked.sequence,
    version = (ranked.sequence / 10)::text || '.' || mod(ranked.sequence, 10)::text,
    release_status = 'published',
    published_at = COALESCE(file.created_at, now())
FROM ranked
WHERE file.id = ranked.id
  AND file.version_sequence IS NULL;

ALTER TABLE public.product_files
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN release_status SET DEFAULT 'pending_review',
  ALTER COLUMN release_status SET NOT NULL;

ALTER TABLE public.product_files
  DROP CONSTRAINT IF EXISTS product_files_release_status_check,
  ADD CONSTRAINT product_files_release_status_check
    CHECK (release_status IN ('pending_review', 'published', 'rejected', 'archived')),
  DROP CONSTRAINT IF EXISTS product_files_version_sequence_check,
  ADD CONSTRAINT product_files_version_sequence_check
    CHECK (
      (release_status = 'published' AND version_sequence >= 10
        AND version = (version_sequence / 10)::text || '.' || mod(version_sequence, 10)::text
        AND published_at IS NOT NULL)
      OR (release_status <> 'published' AND version_sequence IS NULL AND version IS NULL AND published_at IS NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS product_files_product_version_unique
  ON public.product_files(product_id, version_sequence)
  WHERE release_status = 'published';
CREATE INDEX IF NOT EXISTS product_files_latest_release_idx
  ON public.product_files(product_id, version_sequence DESC)
  WHERE release_status = 'published';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_file_id_at_purchase uuid REFERENCES public.product_files(id);

-- Reconstruct the release that was current when payment settled. Fall back to
-- the earliest release for legacy orders predating trustworthy file timestamps.
UPDATE public.order_items AS item
SET product_file_id_at_purchase = COALESCE(
  (
    SELECT file.id
    FROM public.product_files AS file
    JOIN public.orders AS paid_order ON paid_order.id = item.order_id
    WHERE file.product_id = item.product_id
      AND file.release_status = 'published'
      AND file.published_at <= COALESCE(paid_order.paid_at, paid_order.created_at, now())
    ORDER BY file.version_sequence DESC
    LIMIT 1
  ),
  (
    SELECT file.id
    FROM public.product_files AS file
    WHERE file.product_id = item.product_id
      AND file.release_status = 'published'
    ORDER BY file.version_sequence ASC
    LIMIT 1
  )
)
WHERE item.product_file_id_at_purchase IS NULL;

CREATE TABLE IF NOT EXISTS public.order_item_file_downloads (
  order_item_id bigint NOT NULL REFERENCES public.order_items(id),
  product_file_id uuid NOT NULL REFERENCES public.product_files(id),
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  download_limit integer NOT NULL DEFAULT 3 CHECK (download_limit > 0),
  first_downloaded_at timestamptz,
  last_downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_item_id, product_file_id)
);
CREATE INDEX IF NOT EXISTS order_item_file_downloads_file_idx
  ON public.order_item_file_downloads(product_file_id, order_item_id);

-- Do not grant a free reset merely by deploying this migration. Historical
-- usage is assigned to the release that the paid order currently owns.
WITH current_usage AS (
  SELECT item.*,
         (
           SELECT file.id
           FROM public.product_files AS file
           WHERE file.product_id = item.product_id
             AND file.release_status = 'published'
           ORDER BY file.version_sequence DESC
           LIMIT 1
         ) AS current_product_file_id
  FROM public.order_items AS item
)
INSERT INTO public.order_item_file_downloads (
  order_item_id, product_file_id, download_count, download_limit,
  first_downloaded_at, last_downloaded_at
)
SELECT item.id,
       item.current_product_file_id,
       item.download_count,
       item.download_limit,
       CASE WHEN item.download_count > 0 THEN item.downloaded_at END,
       CASE WHEN item.download_count > 0 THEN item.downloaded_at END
FROM current_usage AS item
WHERE item.current_product_file_id IS NOT NULL
ON CONFLICT (order_item_id, product_file_id) DO NOTHING;

ALTER TABLE public.order_item_file_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_item_file_downloads FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_item_file_downloads TO service_role;

ALTER TABLE public.purchase_download_sessions
  ADD COLUMN IF NOT EXISTS product_file_id uuid REFERENCES public.product_files(id);
UPDATE public.purchase_download_sessions AS session
SET product_file_id = file.id
FROM public.order_items AS item
JOIN public.product_files AS file ON file.product_id = item.product_id
WHERE session.order_item_id = item.id
  AND session.storage_path = file.file_url
  AND session.product_file_id IS NULL;
UPDATE public.purchase_download_sessions
SET status = 'revoked', failure_code = 'download_session_used_or_expired'
WHERE status = 'pending' AND product_file_id IS NULL;

ALTER TABLE public.download_logs
  ADD COLUMN IF NOT EXISTS product_file_id uuid REFERENCES public.product_files(id);
CREATE INDEX IF NOT EXISTS download_logs_product_file_idx
  ON public.download_logs(product_file_id, downloaded_at DESC);

-- Product file metadata is immutable to browsers. The RPC below verifies both
-- ownership and the product-specific private storage path.
REVOKE INSERT, UPDATE, DELETE ON public.product_files FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.product_files TO authenticated;

CREATE OR REPLACE FUNCTION public.register_product_file_release(
  p_product_id bigint,
  p_file_url text,
  p_file_name text,
  p_file_size bigint,
  p_publish_immediately boolean DEFAULT false
)
RETURNS public.product_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result public.product_files;
  v_is_admin boolean := public.is_seller_platform_admin();
  v_is_owner boolean := false;
  v_next_sequence integer;
  v_status text := 'pending_review';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;
  IF p_product_id IS NULL OR p_product_id <= 0
    OR p_file_size IS NULL OR p_file_size <= 0 OR p_file_size > 209715200
    OR NULLIF(btrim(p_file_name), '') IS NULL
    OR NULLIF(btrim(p_file_url), '') IS NULL
    OR split_part(p_file_url, '/', 1) <> p_product_id::text
    OR p_file_url ~ '(^|/)\.\.(/|$)'
    OR lower(p_file_url) !~ '\.zip$' THEN
    RAISE EXCEPTION 'Invalid product ZIP metadata.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN public.sellers AS seller ON seller.id = product.seller_id
    WHERE product.id = p_product_id
      AND seller.profile_id = auth.uid()
      AND seller.status = 'approved'
  ) INTO v_is_owner;

  IF NOT v_is_admin AND NOT v_is_owner THEN
    RAISE EXCEPTION 'You cannot upload a release for this product.' USING ERRCODE = '42501';
  END IF;
  IF p_publish_immediately AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only an administrator can publish a release immediately.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects AS stored_object
    WHERE stored_object.bucket_id = 'products' AND stored_object.name = p_file_url
  ) THEN
    RAISE EXCEPTION 'The uploaded product ZIP was not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('product-release:' || p_product_id::text, 0));

  -- A replacement submission keeps an audit row instead of deleting metadata.
  UPDATE public.product_files
  SET release_status = 'archived'
  WHERE product_id = p_product_id AND release_status = 'pending_review';

  IF p_publish_immediately THEN
    SELECT greatest(COALESCE(max(version_sequence), 9) + 1, 10)
    INTO v_next_sequence
    FROM public.product_files
    WHERE product_id = p_product_id AND release_status = 'published';
    v_status := 'published';
  END IF;

  INSERT INTO public.product_files (
    product_id, file_url, file_name, file_size, created_by,
    release_status, version_sequence, version, published_at
  ) VALUES (
    p_product_id, p_file_url, btrim(p_file_name), p_file_size, auth.uid(),
    v_status, v_next_sequence,
    CASE WHEN v_next_sequence IS NULL THEN NULL ELSE (v_next_sequence / 10)::text || '.' || mod(v_next_sequence, 10)::text END,
    CASE WHEN v_next_sequence IS NULL THEN NULL ELSE now() END
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.register_product_file_release(bigint, text, text, bigint, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_product_file_release(bigint, text, text, bigint, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.moderate_product_release(
  p_product_id bigint,
  p_status text
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product public.products;
  v_pending_file_id uuid;
  v_next_sequence integer;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('published', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid moderation status.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('product-release:' || p_product_id::text, 0));
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND seller_id IS NOT NULL
  FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Seller product was not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = 'published' THEN
    SELECT id INTO v_pending_file_id
    FROM public.product_files
    WHERE product_id = p_product_id AND release_status = 'pending_review'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF v_pending_file_id IS NOT NULL THEN
      SELECT greatest(COALESCE(max(version_sequence), 9) + 1, 10)
      INTO v_next_sequence
      FROM public.product_files
      WHERE product_id = p_product_id AND release_status = 'published';

      UPDATE public.product_files
      SET release_status = 'published',
          version_sequence = v_next_sequence,
          version = (v_next_sequence / 10)::text || '.' || mod(v_next_sequence, 10)::text,
          published_at = now()
      WHERE id = v_pending_file_id;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.product_files
      WHERE product_id = p_product_id AND release_status = 'published'
    ) THEN
      RAISE EXCEPTION 'A product ZIP must be approved before publishing.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_status = 'rejected' THEN
    UPDATE public.product_files
    SET release_status = 'rejected'
    WHERE product_id = p_product_id AND release_status = 'pending_review';
  END IF;

  UPDATE public.products
  SET status = p_status
  WHERE id = p_product_id
  RETURNING * INTO v_product;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.moderate_product_release(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_product_release(bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_paid_product_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    UPDATE public.order_items AS item
    SET product_file_id_at_purchase = (
      SELECT file.id
      FROM public.product_files AS file
      WHERE file.product_id = item.product_id
        AND file.release_status = 'published'
      ORDER BY file.version_sequence DESC
      LIMIT 1
    )
    WHERE item.order_id = NEW.id
      AND item.product_file_id_at_purchase IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS capture_paid_product_release ON public.orders;
CREATE TRIGGER capture_paid_product_release
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.capture_paid_product_release();
REVOKE ALL ON FUNCTION public.capture_paid_product_release() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.revoke_refunded_download_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    UPDATE public.purchase_download_sessions AS session
    SET status = 'revoked', failure_code = 'purchase_access_revoked'
    FROM public.order_items AS item
    WHERE item.order_id = NEW.id
      AND session.order_item_id = item.id
      AND session.status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS revoke_refunded_download_sessions ON public.orders;
CREATE TRIGGER revoke_refunded_download_sessions
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.revoke_refunded_download_sessions();
REVOKE ALL ON FUNCTION public.revoke_refunded_download_sessions() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_product_version_download(
  p_session_id uuid,
  p_token_hash text,
  p_binding_hash text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.purchase_download_sessions;
  v_item public.order_items;
  v_file public.product_files;
  v_usage public.order_item_file_downloads;
  v_profile_id uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM public.purchase_download_sessions
  WHERE id = p_session_id AND token_hash = p_token_hash AND binding_hash = p_binding_hash;
  IF v_session.id IS NULL OR v_session.product_file_id IS NULL THEN
    RAISE EXCEPTION 'download_session_invalid' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = v_session.order_item_id;
  SELECT * INTO v_file FROM public.product_files WHERE id = v_session.product_file_id;
  v_profile_id := v_session.profile_id;
  IF v_item.id IS NULL OR v_file.id IS NULL OR v_file.product_id <> v_item.product_id THEN
    RAISE EXCEPTION 'download_session_invalid' USING ERRCODE = '42501';
  END IF;

  PERFORM public.lock_purchase_access(v_profile_id, v_item.product_id);
  PERFORM 1 FROM public.orders WHERE id = v_item.order_id FOR UPDATE;
  SELECT * INTO v_item FROM public.order_items WHERE id = v_item.id FOR UPDATE;
  SELECT * INTO v_session FROM public.purchase_download_sessions WHERE id = p_session_id FOR UPDATE;
  SELECT * INTO v_file FROM public.product_files WHERE id = v_session.product_file_id FOR SHARE;

  IF v_session.status <> 'pending' OR v_session.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'download_session_used_or_expired' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.sessions AS session
    WHERE session.id = v_session.auth_session_id
      AND session.user_id = v_session.profile_id
      AND (session.not_after IS NULL OR session.not_after > now())
  ) THEN
    RAISE EXCEPTION 'download_session_signed_out' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_products AS ownership
    JOIN public.orders AS customer_order ON customer_order.id = ownership.order_id
    WHERE ownership.profile_id = v_session.profile_id
      AND ownership.product_id = v_item.product_id
      AND ownership.order_id = v_item.order_id
      AND customer_order.profile_id = v_session.profile_id
      AND customer_order.status = 'paid'
      AND NOT customer_order.purchase_conflict
  ) THEN
    RAISE EXCEPTION 'purchase_access_revoked' USING ERRCODE = '42501';
  END IF;
  IF v_file.release_status <> 'published' OR v_file.file_url <> v_session.storage_path THEN
    RAISE EXCEPTION 'file_unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.order_item_file_downloads(order_item_id, product_file_id)
  VALUES (v_item.id, v_file.id)
  ON CONFLICT (order_item_id, product_file_id) DO NOTHING;
  SELECT * INTO v_usage
  FROM public.order_item_file_downloads
  WHERE order_item_id = v_item.id AND product_file_id = v_file.id
  FOR UPDATE;
  IF v_usage.download_count >= v_usage.download_limit THEN
    RAISE EXCEPTION 'download_limit_reached' USING ERRCODE = '42501';
  END IF;

  UPDATE public.purchase_download_sessions
  SET status = 'started', started_at = clock_timestamp()
  WHERE id = v_session.id;

  UPDATE public.order_item_file_downloads
  SET download_count = download_count + 1,
      first_downloaded_at = COALESCE(first_downloaded_at, clock_timestamp()),
      last_downloaded_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE order_item_id = v_item.id AND product_file_id = v_file.id
  RETURNING * INTO v_usage;

  UPDATE public.order_items
  SET download_count = download_count + 1,
      is_downloaded = true,
      downloaded_at = v_usage.last_downloaded_at
  WHERE id = v_item.id
  RETURNING * INTO v_item;

  INSERT INTO public.download_logs(
    profile_id, product_id, downloaded_at, ip_address, user_agent,
    order_item_id, download_session_id, product_file_id
  ) VALUES (
    v_session.profile_id, v_item.product_id, v_usage.last_downloaded_at,
    p_ip_address, left(NULLIF(p_user_agent, ''), 1000),
    v_item.id, v_session.id, v_file.id
  );

  RETURN jsonb_build_object(
    'is_downloaded', v_usage.download_count > 0,
    'downloaded_at', v_usage.last_downloaded_at,
    'download_count', v_usage.download_count,
    'download_limit', v_usage.download_limit,
    'downloads_remaining', greatest(0, v_usage.download_limit - v_usage.download_count),
    'can_download', v_usage.download_count < v_usage.download_limit,
    'version', v_file.version,
    'version_sequence', v_file.version_sequence,
    'product_file_id', v_file.id,
    'update_available', EXISTS (
      SELECT 1 FROM public.product_files AS newer
      WHERE newer.product_id = v_file.product_id
        AND newer.release_status = 'published'
        AND newer.version_sequence > v_file.version_sequence
    ),
    'lifetime_download_count', v_item.download_count
  );
END;
$$;
REVOKE ALL ON FUNCTION public.start_product_version_download(uuid, text, text, inet, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_product_version_download(uuid, text, text, inet, text)
  TO service_role;

COMMIT;
