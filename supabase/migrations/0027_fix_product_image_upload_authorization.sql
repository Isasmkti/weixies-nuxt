-- Fix product image uploads that are rejected before an object reaches the
-- product-images bucket. Authorization is resolved through SECURITY DEFINER
-- helpers so storage.objects policies do not depend on nested products or
-- sellers RLS visibility.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_product_assets(p_product_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_product_id IS NOT NULL
    AND p_product_id > 0
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.products
        JOIN public.sellers ON sellers.id = products.seller_id
        WHERE products.id = p_product_id
          AND sellers.profile_id = auth.uid()
          AND sellers.status = 'approved'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_product_assets(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_product_assets(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_product_image_object(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_segments text[];
  v_product_id bigint;
BEGIN
  IF auth.uid() IS NULL
    OR p_object_name IS NULL
    OR p_object_name ~ '(^|/)\.\.(/|$)'
    OR lower(p_object_name) !~ '\.(jpe?g|png|webp|gif)$'
  THEN
    RETURN false;
  END IF;

  v_segments := string_to_array(p_object_name, '/');

  -- The application always writes productId/userId/file.ext. Requiring the
  -- exact shape prevents users from writing into another seller's folder.
  IF cardinality(v_segments) <> 3
    OR v_segments[1] !~ '^[1-9][0-9]*$'
    OR v_segments[2] <> auth.uid()::text
    OR NULLIF(v_segments[3], '') IS NULL
  THEN
    RETURN false;
  END IF;

  BEGIN
    v_product_id := v_segments[1]::bigint;
  EXCEPTION
    WHEN numeric_value_out_of_range OR invalid_text_representation THEN
      RETURN false;
  END;

  RETURN public.can_manage_product_assets(v_product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_product_image_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_product_image_object(text) TO authenticated;

-- Make product image metadata use the same owner check as Storage. Public
-- catalog reads remain handled by the published-product SELECT policy.
DROP POLICY IF EXISTS "Sellers can manage own product images" ON public.product_images;
DROP POLICY IF EXISTS "Platform admins can manage product images" ON public.product_images;
DROP POLICY IF EXISTS "Product owners can manage product images" ON public.product_images;

CREATE POLICY "Product owners can manage product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (public.can_manage_product_assets(product_images.product_id))
  WITH CHECK (public.can_manage_product_assets(product_images.product_id));

GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;

DROP POLICY IF EXISTS "Product owners can upload product images" ON storage.objects;
CREATE POLICY "Product owners can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.can_manage_product_image_object(name)
  );

DROP POLICY IF EXISTS "Product owners can update product images" ON storage.objects;
CREATE POLICY "Product owners can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.can_manage_product_image_object(name)
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.can_manage_product_image_object(name)
  );

DROP POLICY IF EXISTS "Product owners can delete product images" ON storage.objects;
CREATE POLICY "Product owners can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.can_manage_product_image_object(name)
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
