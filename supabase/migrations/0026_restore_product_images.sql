-- Repair legacy databases whose migration history was marked as applied while
-- the baseline product_images table was never created. This migration is
-- intentionally idempotent so it is also safe for databases that still have
-- the original table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  image_url text NOT NULL,
  storage_path text NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE CASCADE
);

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS storage_path text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.product_images'::regclass
      AND conname = 'product_images_owned_storage_path_check'
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_owned_storage_path_check
      CHECK (
        storage_path IS NULL
        OR (
          split_part(storage_path, '/', 1) = product_id::text
          AND storage_path !~ '(^|/)\.\.(/|$)'
          AND lower(storage_path) ~ '\.(jpe?g|png|webp|gif)$'
          AND position('/storage/v1/object/public/product-images/' || storage_path IN image_url) > 0
        )
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS product_images_product_id_idx
  ON public.product_images (product_id);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_storage_path_uidx
  ON public.product_images (storage_path)
  WHERE storage_path IS NOT NULL;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published product images" ON public.product_images;
CREATE POLICY "Public can read published product images"
  ON public.product_images
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = product_images.product_id
        AND products.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Sellers can manage own product images" ON public.product_images;
CREATE POLICY "Sellers can manage own product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = product_images.product_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = product_images.product_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Platform admins can manage product images" ON public.product_images;
CREATE POLICY "Platform admins can manage product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Product owners can upload product images" ON storage.objects;
CREATE POLICY "Product owners can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND split_part(storage.objects.name, '/', 1) ~ '^[0-9]+$'
    AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
    AND lower(storage.objects.name) ~ '\.(jpe?g|png|webp|gif)$'
    AND storage.objects.name !~ '(^|/)\.\.(/|$)'
    AND (
      public.is_seller_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.products
        JOIN public.sellers ON sellers.id = products.seller_id
        WHERE products.id::text = split_part(storage.objects.name, '/', 1)
          AND sellers.profile_id = auth.uid()
          AND sellers.status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "Product owners can update product images" ON storage.objects;
CREATE POLICY "Product owners can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.is_seller_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.products
        JOIN public.sellers ON sellers.id = products.seller_id
        WHERE products.id::text = split_part(storage.objects.name, '/', 1)
          AND sellers.profile_id = auth.uid()
          AND sellers.status = 'approved'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND split_part(storage.objects.name, '/', 1) ~ '^[0-9]+$'
    AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
    AND lower(storage.objects.name) ~ '\.(jpe?g|png|webp|gif)$'
    AND storage.objects.name !~ '(^|/)\.\.(/|$)'
    AND (
      public.is_seller_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.products
        JOIN public.sellers ON sellers.id = products.seller_id
        WHERE products.id::text = split_part(storage.objects.name, '/', 1)
          AND sellers.profile_id = auth.uid()
          AND sellers.status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "Product owners can delete product images" ON storage.objects;
CREATE POLICY "Product owners can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      public.is_seller_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.products
        JOIN public.sellers ON sellers.id = products.seller_id
        WHERE products.id::text = split_part(storage.objects.name, '/', 1)
          AND sellers.profile_id = auth.uid()
          AND sellers.status = 'approved'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.replace_product_images(
  p_product_id bigint,
  p_images jsonb DEFAULT '[]'::jsonb
)
RETURNS SETOF public.product_images
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_product_id IS NULL OR p_product_id <= 0 THEN
    RAISE EXCEPTION 'A valid product is required.' USING ERRCODE = '22023';
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

  DELETE FROM public.product_images
  WHERE product_id = p_product_id;

  INSERT INTO public.product_images (product_id, image_url, storage_path, is_primary)
  SELECT
    p_product_id,
    btrim(image->>'image_url'),
    NULLIF(btrim(image->>'storage_path'), ''),
    CASE WHEN row_number() OVER (ORDER BY ordinal) = 1 THEN true ELSE false END
  FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) WITH ORDINALITY AS source(image, ordinal)
  ORDER BY ordinal;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) WITH ORDINALITY AS source(image, ordinal)
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
      JOIN jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) WITH ORDINALITY AS source(image, ordinal)
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

COMMENT ON TABLE public.product_images IS
  'Public product image metadata backed by the product-images storage bucket.';
COMMENT ON COLUMN public.product_images.storage_path IS
  'Object path in the public product-images bucket. NULL is retained only for legacy external URLs.';

NOTIFY pgrst, 'reload schema';

COMMIT;
