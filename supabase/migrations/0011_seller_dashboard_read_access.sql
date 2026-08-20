-- Multi-seller marketplace migration
-- Read-only sales data for the seller dashboard
-- Date: 2026-08-20

-- SECURITY DEFINER avoids circular RLS evaluation while still limiting every
-- order to one that contains an item attributed to the authenticated seller.
CREATE OR REPLACE FUNCTION public.seller_owns_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items
    JOIN public.sellers ON sellers.id = order_items.seller_id
    WHERE order_items.order_id = p_order_id
      AND sellers.profile_id = auth.uid()
      AND sellers.status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.seller_owns_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_owns_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "Approved sellers can view their attributed order items" ON public.order_items;
CREATE POLICY "Approved sellers can view their attributed order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE sellers.id = order_items.seller_id
        AND sellers.profile_id = auth.uid()
        AND sellers.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Approved sellers can view attributed orders" ON public.orders;
CREATE POLICY "Approved sellers can view attributed orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.seller_owns_order(id));

