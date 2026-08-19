-- Multi-seller marketplace migration
-- Phase 2: product ownership
-- Date: 2026-08-19
--
-- This migration is additive. Existing products retain seller_id = NULL and
-- status = 'published', so they remain platform-owned and publicly visible.

ALTER TABLE public.products
  ADD COLUMN seller_id uuid NULL REFERENCES public.sellers(id),
  ADD COLUMN status text NOT NULL DEFAULT 'published'
    CHECK (status = ANY (ARRAY[
      'draft'::text,
      'pending_review'::text,
      'published'::text,
      'rejected'::text,
      'suspended'::text
    ]));

CREATE INDEX products_seller_id_idx ON public.products (seller_id);

-- Products are already consumed directly by the public storefront and the
-- current admin UI. These policies preserve published-product reads while
-- granting sellers write access only to their own products after approval.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published products are publicly visible"
  ON public.products
  FOR SELECT
  TO public
  USING (status = 'published');

CREATE POLICY "Sellers can view their own products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = products.seller_id
        AND sellers.profile_id = auth.uid()
    )
  );

CREATE POLICY "Approved sellers can create their own products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = products.seller_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

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
    EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = products.seller_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

CREATE POLICY "Platform admins can manage all products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());
