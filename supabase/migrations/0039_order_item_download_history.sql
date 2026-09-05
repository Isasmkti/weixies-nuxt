-- Durable per-order-item download state backed by the existing download log.

BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_downloaded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS downloaded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_download_count_nonnegative_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_download_count_nonnegative_check
  CHECK (download_count >= 0);

CREATE INDEX IF NOT EXISTS order_items_order_downloaded_idx
  ON public.order_items (order_id, is_downloaded);

-- Existing active ownership rows identify the original paid order that issued
-- earlier download logs. Backfill only this unambiguous relationship.
WITH download_history AS (
  SELECT
    ownership.order_id,
    ownership.product_id,
    max(log.downloaded_at) AS downloaded_at,
    count(*)::integer AS download_count
  FROM public.user_products AS ownership
  JOIN public.download_logs AS log
    ON log.profile_id = ownership.profile_id
   AND log.product_id = ownership.product_id
  GROUP BY ownership.order_id, ownership.product_id
)
UPDATE public.order_items AS item
SET is_downloaded = true,
    downloaded_at = history.downloaded_at,
    download_count = history.download_count
FROM download_history AS history
WHERE item.order_id = history.order_id
  AND item.product_id = history.product_id;

CREATE OR REPLACE FUNCTION public.record_order_item_download(
  p_order_item_id bigint,
  p_profile_id uuid,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  is_downloaded boolean,
  downloaded_at timestamp with time zone,
  download_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.order_items;
  v_now timestamp with time zone := now();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_order_item_id IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Order item and buyer are required.' USING ERRCODE = '22023';
  END IF;

  SELECT item.* INTO v_item
  FROM public.order_items AS item
  JOIN public.orders AS customer_order ON customer_order.id = item.order_id
  WHERE item.id = p_order_item_id
    AND customer_order.profile_id = p_profile_id
    AND customer_order.status = 'paid'
  FOR UPDATE OF item;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'A paid order item owned by this buyer was not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.download_logs (
    profile_id,
    product_id,
    downloaded_at,
    ip_address,
    user_agent
  ) VALUES (
    p_profile_id,
    v_item.product_id,
    v_now,
    p_ip_address,
    left(NULLIF(p_user_agent, ''), 1000)
  );

  UPDATE public.order_items AS item
  SET is_downloaded = true,
      downloaded_at = v_now,
      download_count = item.download_count + 1
  WHERE item.id = v_item.id
  RETURNING item.is_downloaded, item.downloaded_at, item.download_count
  INTO is_downloaded, downloaded_at, download_count;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_item_download(bigint, uuid, inet, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_item_download(bigint, uuid, inet, text)
  TO service_role;

COMMIT;
