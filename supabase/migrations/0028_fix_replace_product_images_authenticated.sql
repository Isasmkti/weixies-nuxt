-- The storage upload is authorized by migration 0027, but authenticated calls
-- to the metadata RPC can still fail while PostgreSQL evaluates nested RLS
-- policies. Perform the atomic replace as SECURITY DEFINER only after an
-- explicit owner/admin authorization check.

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_product_images(
  p_product_id bigint,
  p_images jsonb DEFAULT '[]'::jsonb
)
RETURNS SETOF public.product_images
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL OR p_product_id <= 0 THEN
    RAISE EXCEPTION 'A valid product is required.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_manage_product_assets(p_product_id) THEN
    RAISE EXCEPTION 'You do not have access to manage this product.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(COALESCE(p_images, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Product images must be an array.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(COALESCE(p_images, '[]'::jsonb)) > 8 THEN
    RAISE EXCEPTION 'A product can have up to 8 images.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) AS image
    WHERE NULLIF(btrim(image->>'image_url'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Every product image requires a URL.' USING ERRCODE = '22023';
  END IF;

  -- Every new Storage-backed image must use the authenticated user's approved
  -- productId/userId/file.ext path. Existing rows are allowed to be retained
  -- so legacy external URLs and admin-uploaded images remain editable.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) AS requested(image)
    WHERE NULLIF(btrim(image->>'storage_path'), '') IS NOT NULL
      AND NOT public.can_manage_product_image_object(btrim(image->>'storage_path'))
      AND NOT EXISTS (
        SELECT 1
        FROM public.product_images AS existing
        WHERE existing.product_id = p_product_id
          AND existing.image_url = btrim(image->>'image_url')
          AND existing.storage_path = btrim(image->>'storage_path')
      )
  ) THEN
    RAISE EXCEPTION 'One or more product image paths are not authorized.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.product_images
  WHERE product_id = p_product_id;

  INSERT INTO public.product_images (product_id, image_url, storage_path, is_primary)
  SELECT
    p_product_id,
    btrim(image->>'image_url'),
    NULLIF(btrim(image->>'storage_path'), ''),
    CASE WHEN row_number() OVER (ORDER BY ordinal) = 1 THEN true ELSE false END
  FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb))
    WITH ORDINALITY AS source(image, ordinal)
  ORDER BY ordinal;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) AS image
    WHERE COALESCE((image->>'is_primary')::boolean, false)
  ) THEN
    UPDATE public.product_images
    SET is_primary = false
    WHERE product_id = p_product_id;

    UPDATE public.product_images
    SET is_primary = true
    WHERE id = (
      SELECT stored.id
      FROM public.product_images AS stored
      JOIN jsonb_array_elements(COALESCE(p_images, '[]'::jsonb))
        WITH ORDINALITY AS source(image, ordinal)
        ON stored.product_id = p_product_id
       AND stored.image_url = btrim(image->>'image_url')
      WHERE COALESCE((image->>'is_primary')::boolean, false)
      ORDER BY ordinal
      LIMIT 1
    );
  END IF;

  RETURN QUERY
  SELECT image.*
  FROM public.product_images AS image
  WHERE image.product_id = p_product_id
  ORDER BY image.is_primary DESC, image.created_at, image.id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_product_images(bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_product_images(bigint, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
