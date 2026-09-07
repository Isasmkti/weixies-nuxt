-- Three started transfers per paid entitlement. No reusable storage URLs.
BEGIN;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS download_limit integer NOT NULL DEFAULT 3
  CHECK (download_limit > 0);
-- Historical counts (including counts above three) are intentionally preserved.
CREATE TABLE public.purchase_download_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id bigint NOT NULL REFERENCES public.order_items(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  auth_session_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  binding_hash text NOT NULL CHECK (length(binding_hash) = 64),
  idempotency_key uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'failed', 'revoked')),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  started_at timestamptz,
  UNIQUE (profile_id, idempotency_key)
);
CREATE INDEX purchase_download_binding_idx ON public.purchase_download_sessions(binding_hash) WHERE status = 'pending';
ALTER TABLE public.purchase_download_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_download_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.purchase_download_sessions TO service_role;

ALTER TABLE public.download_logs
  ADD COLUMN IF NOT EXISTS order_item_id bigint REFERENCES public.order_items(id),
  ADD COLUMN IF NOT EXISTS download_session_id uuid REFERENCES public.purchase_download_sessions(id);
CREATE UNIQUE INDEX download_logs_session_idx ON public.download_logs(download_session_id) WHERE download_session_id IS NOT NULL;

-- Never let browser-side grants bypass the atomic counter or mint ownership.
REVOKE INSERT, UPDATE, DELETE ON public.download_logs, public.user_products, public.order_items FROM PUBLIC, anon, authenticated;
DO $$
DECLARE v_column record;
BEGIN
  FOR v_column IN SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'download_logs' LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.download_logs FROM PUBLIC, anon, authenticated', v_column.column_name, v_column.column_name);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.record_order_item_download(bigint, uuid, inet, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_purchase_download(
  p_session_id uuid, p_token_hash text, p_binding_hash text,
  p_ip_address inet DEFAULT NULL, p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.purchase_download_sessions;
  v_item public.order_items;
  v_profile_id uuid;
  v_product_id bigint;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT s.profile_id, i.product_id INTO v_profile_id, v_product_id
  FROM public.purchase_download_sessions s JOIN public.order_items i ON i.id = s.order_item_id
  WHERE s.id = p_session_id AND s.token_hash = p_token_hash AND s.binding_hash = p_binding_hash;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'download_session_invalid' USING ERRCODE = '42501';
  END IF;
  PERFORM public.lock_purchase_access(v_profile_id, v_product_id);
  -- Same order as checkout/fulfillment/refund: product advisory lock, order, item.
  PERFORM 1 FROM public.orders o JOIN public.order_items i ON i.order_id = o.id
    JOIN public.purchase_download_sessions s ON s.order_item_id = i.id
    WHERE s.id = p_session_id FOR UPDATE OF o;
  SELECT i.* INTO v_item FROM public.order_items i
    JOIN public.purchase_download_sessions s ON s.order_item_id = i.id
    WHERE s.id = p_session_id FOR UPDATE OF i;
  SELECT * INTO v_session FROM public.purchase_download_sessions
    WHERE id = p_session_id FOR UPDATE;
  IF v_session.status <> 'pending' OR v_session.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'download_session_used_or_expired' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = v_session.auth_session_id
      AND s.user_id = v_session.profile_id AND (s.not_after IS NULL OR s.not_after > now())) THEN
    RAISE EXCEPTION 'download_session_signed_out' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_products u JOIN public.orders o ON o.id = u.order_id
    WHERE u.profile_id = v_session.profile_id AND u.product_id = v_item.product_id
      AND u.order_id = v_item.order_id AND o.profile_id = v_session.profile_id
      AND o.status = 'paid' AND NOT o.purchase_conflict
  ) THEN
    RAISE EXCEPTION 'purchase_access_revoked' USING ERRCODE = '42501';
  END IF;
  IF v_item.download_count >= v_item.download_limit THEN
    RAISE EXCEPTION 'download_limit_reached' USING ERRCODE = '42501';
  END IF;
  -- Upstream headers and first chunk have been checked by the trusted server.
  -- No reservation/lease to recover: before this transaction nothing is charged;
  -- after it commits an interrupted/ambiguous started transfer remains charged.
  UPDATE public.purchase_download_sessions SET status = 'started', started_at = clock_timestamp()
    WHERE id = v_session.id;
  UPDATE public.order_items SET download_count = download_count + 1,
      is_downloaded = true, downloaded_at = clock_timestamp()
    WHERE id = v_item.id RETURNING * INTO v_item;
  INSERT INTO public.download_logs(profile_id, product_id, downloaded_at, ip_address, user_agent, order_item_id, download_session_id)
    VALUES (v_session.profile_id, v_item.product_id, v_item.downloaded_at, p_ip_address,
      left(p_user_agent, 1000), v_item.id, v_session.id);
  RETURN jsonb_build_object('is_downloaded', v_item.is_downloaded, 'downloaded_at', v_item.downloaded_at,
    'download_count', v_item.download_count, 'download_limit', v_item.download_limit,
    'downloads_remaining', greatest(0, v_item.download_limit - v_item.download_count),
    'can_download', v_item.download_count < v_item.download_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.start_purchase_download(uuid, text, text, inet, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_purchase_download(uuid, text, text, inet, text) TO service_role;

-- A private bucket alone is not sufficient if a legacy buyer SELECT policy
-- allows creating storage signed URLs directly. Restrict only the ZIP bucket;
-- preserve existing policies for images and seller/admin ZIP management.
CREATE POLICY purchase_zip_anon_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
USING (bucket_id <> 'products');
CREATE POLICY purchase_zip_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id <> 'products' OR public.is_seller_platform_admin() OR EXISTS (
  SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id
  WHERE p.id::text = split_part(storage.objects.name, '/', 1)
    AND s.profile_id = auth.uid() AND s.status = 'approved'
));
UPDATE storage.buckets SET public = false WHERE id = 'products';

COMMIT;
