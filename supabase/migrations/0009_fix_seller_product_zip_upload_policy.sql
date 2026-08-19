-- Fix the seller ZIP upload policy introduced in 0008.
-- Inside the ownership subquery, unqualified `name` resolves to
-- public.products.name instead of storage.objects.name. Qualifying the outer
-- storage column keeps the product-id folder check on the uploaded file path.

DROP POLICY IF EXISTS "Sellers can upload own product ZIP files" ON storage.objects;

CREATE POLICY "Sellers can upload own product ZIP files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND split_part(storage.objects.name, '/', 1) ~ '^[0-9]+$'
    AND EXISTS (
      SELECT 1
      FROM public.products
      JOIN public.sellers ON sellers.id = products.seller_id
      WHERE products.id = split_part(storage.objects.name, '/', 1)::bigint
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );
