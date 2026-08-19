-- Multi-seller marketplace migration
-- Phase 2 follow-up: prevent sellers from self-publishing products.
--
-- The original owner policies scoped the seller identity but did not constrain
-- products.status. This forward-only correction preserves owner access while
-- allowing seller submissions only as draft or pending_review.

DROP POLICY IF EXISTS "Approved sellers can create their own products" ON public.products;
CREATE POLICY "Approved sellers can create their own products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status IN ('draft', 'pending_review')
    AND EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = products.seller_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Approved sellers can update their own products" ON public.products;
CREATE POLICY "Approved sellers can update their own products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = products.seller_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  )
  WITH CHECK (
    status IN ('draft', 'pending_review')
    AND EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = products.seller_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );
