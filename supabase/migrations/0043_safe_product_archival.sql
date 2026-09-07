-- Product records are part of immutable order, purchase, refund, payout, and
-- download history. Marketplace clients archive products by changing their
-- status to suspended; they must never hard-delete the source row.

DROP POLICY IF EXISTS "Platform admins can manage all products" ON public.products;

DROP POLICY IF EXISTS "Platform admins can view all products" ON public.products;
CREATE POLICY "Platform admins can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

DROP POLICY IF EXISTS "Platform admins can create products" ON public.products;
CREATE POLICY "Platform admins can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_seller_platform_admin());

DROP POLICY IF EXISTS "Platform admins can update all products" ON public.products;
CREATE POLICY "Platform admins can update all products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

-- Intentionally no DELETE policy for products. RLS therefore rejects hard
-- deletes from anon/authenticated clients while service-role maintenance can
-- still bypass RLS when explicitly required.

NOTIFY pgrst, 'reload schema';
