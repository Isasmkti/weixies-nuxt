-- Product license tiers and immutable purchase snapshots.
-- Date: 2026-09-03

BEGIN;

CREATE TABLE IF NOT EXISTS public.license_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  license_type_id uuid,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  usage_terms text NOT NULL,
  max_end_products integer CHECK (max_end_products IS NULL OR max_end_products > 0),
  allow_resale boolean NOT NULL DEFAULT false,
  allow_commercial_use boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_licenses_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT product_licenses_license_type_id_fkey
    FOREIGN KEY (license_type_id) REFERENCES public.license_types(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS product_licenses_product_active_sort_idx
  ON public.product_licenses (product_id, is_active, sort_order, created_at);

INSERT INTO public.license_types (name, slug, description)
VALUES
  ('Personal Use', 'personal-use', 'For personal projects and non-commercial use.'),
  ('Commercial Use', 'commercial-use', 'For commercial projects and client work.'),
  ('Extended License', 'extended-license', 'For broader commercial distribution under the stated product terms.')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Existing products receive a usable default tier. This also gives legacy
-- cart and order rows an unambiguous license to reference during backfill.
INSERT INTO public.product_licenses (
  product_id,
  license_type_id,
  name,
  price,
  usage_terms,
  max_end_products,
  allow_resale,
  allow_commercial_use,
  is_active,
  sort_order
)
SELECT
  product.id,
  license_type.id,
  'Personal Use',
  GREATEST(COALESCE(product.price, 0), 0),
  'For use by one purchaser in personal, non-commercial end products. Redistribution or resale of the source files is not permitted.',
  1,
  false,
  false,
  true,
  0
FROM public.products AS product
JOIN public.license_types AS license_type ON license_type.slug = 'personal-use'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_licenses AS existing
  WHERE existing.product_id = product.id
);

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS product_license_id uuid;

UPDATE public.cart_items AS cart_item
SET product_license_id = (
  SELECT license.id
  FROM public.product_licenses AS license
  WHERE license.product_id = cart_item.product_id
    AND license.is_active = true
  ORDER BY license.sort_order, license.created_at, license.id
  LIMIT 1
)
WHERE cart_item.product_license_id IS NULL;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_license_id_fkey;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_product_license_id_fkey
    FOREIGN KEY (product_license_id)
    REFERENCES public.product_licenses(id)
    ON DELETE RESTRICT;

ALTER TABLE public.cart_items
  ALTER COLUMN product_license_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS cart_items_product_license_id_idx
  ON public.cart_items (product_license_id);

CREATE TABLE IF NOT EXISTS public.order_item_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id bigint NOT NULL UNIQUE,
  product_license_id uuid,
  license_name_snapshot text NOT NULL,
  usage_terms_snapshot text NOT NULL,
  allow_commercial_use_snapshot boolean NOT NULL,
  allow_resale_snapshot boolean NOT NULL,
  price_snapshot integer NOT NULL CHECK (price_snapshot >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_item_licenses_order_item_id_fkey
    FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE,
  CONSTRAINT order_item_licenses_product_license_id_fkey
    FOREIGN KEY (product_license_id) REFERENCES public.product_licenses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS order_item_licenses_product_license_id_idx
  ON public.order_item_licenses (product_license_id);

INSERT INTO public.order_item_licenses (
  order_item_id,
  product_license_id,
  license_name_snapshot,
  usage_terms_snapshot,
  allow_commercial_use_snapshot,
  allow_resale_snapshot,
  price_snapshot
)
SELECT
  order_item.id,
  selected_license.id,
  selected_license.name,
  selected_license.usage_terms,
  selected_license.allow_commercial_use,
  selected_license.allow_resale,
  order_item.price
FROM public.order_items AS order_item
JOIN LATERAL (
  SELECT license.*
  FROM public.product_licenses AS license
  WHERE license.product_id = order_item.product_id
  ORDER BY license.is_active DESC, license.sort_order, license.created_at, license.id
  LIMIT 1
) AS selected_license ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.order_item_licenses AS existing
  WHERE existing.order_item_id = order_item.id
);

CREATE OR REPLACE FUNCTION public.set_product_license_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_license_updated_at ON public.product_licenses;
CREATE TRIGGER set_product_license_updated_at
  BEFORE UPDATE ON public.product_licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_product_license_updated_at();

CREATE OR REPLACE FUNCTION public.validate_cart_item_product_license()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Short rolling-deploy compatibility: clients released before this
  -- migration omitted the new column. They receive the first active tier;
  -- current clients always send an explicit selection.
  IF NEW.product_license_id IS NULL THEN
    SELECT id INTO NEW.product_license_id
    FROM public.product_licenses
    WHERE product_id = NEW.product_id
      AND is_active = true
    ORDER BY sort_order, created_at, id
    LIMIT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_licenses
    WHERE id = NEW.product_license_id
      AND product_id = NEW.product_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'The selected license is not active for this product.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cart_item_product_license ON public.cart_items;
CREATE TRIGGER validate_cart_item_product_license
  BEFORE INSERT OR UPDATE OF product_id, product_license_id ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_cart_item_product_license();

CREATE OR REPLACE FUNCTION public.require_active_license_for_published_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_product_id bigint;
BEGIN
  v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_product_id AND status = 'published'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.product_licenses
    WHERE product_id = v_product_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'A published product must keep at least one active license.' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS require_active_license_for_published_product ON public.product_licenses;
CREATE CONSTRAINT TRIGGER require_active_license_for_published_product
  AFTER INSERT OR UPDATE OR DELETE ON public.product_licenses
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.require_active_license_for_published_product();

-- Cross-row rules cannot be represented by a CHECK constraint. Publishing an
-- existing product is blocked unless it has an active license. Product create
-- flows insert the product before its child tiers, so they create it as draft
-- or pending_review and publish only after license persistence succeeds.
CREATE OR REPLACE FUNCTION public.require_active_license_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'published'
    AND OLD.status IS DISTINCT FROM 'published'
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_licenses
      WHERE product_id = NEW.id
        AND is_active = true
    )
  THEN
    RAISE EXCEPTION 'A product requires at least one active license before publishing.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_active_license_before_publish ON public.products;
CREATE TRIGGER require_active_license_before_publish
  BEFORE UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.require_active_license_before_publish();

ALTER TABLE public.license_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "License types are publicly visible" ON public.license_types;
CREATE POLICY "License types are publicly visible"
  ON public.license_types
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Platform admins can manage license types" ON public.license_types;
CREATE POLICY "Platform admins can manage license types"
  ON public.license_types
  FOR ALL
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

DROP POLICY IF EXISTS "Active published product licenses are publicly visible" ON public.product_licenses;
CREATE POLICY "Active published product licenses are publicly visible"
  ON public.product_licenses
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = product_licenses.product_id
        AND products.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Product owners can manage product licenses" ON public.product_licenses;
CREATE POLICY "Product owners can manage product licenses"
  ON public.product_licenses
  FOR ALL
  TO authenticated
  USING (public.can_manage_product_assets(product_licenses.product_id))
  WITH CHECK (public.can_manage_product_assets(product_licenses.product_id));

DROP POLICY IF EXISTS "Order participants can view license snapshots" ON public.order_item_licenses;
CREATE POLICY "Order participants can view license snapshots"
  ON public.order_item_licenses
  FOR SELECT
  TO authenticated
  USING (
    public.is_seller_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.order_items
      JOIN public.orders ON orders.id = order_items.order_id
      LEFT JOIN public.sellers ON sellers.id = order_items.seller_id
      WHERE order_items.id = order_item_licenses.order_item_id
        AND (
          orders.profile_id = auth.uid()
          OR sellers.profile_id = auth.uid()
        )
    )
  );

GRANT SELECT ON public.license_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.license_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_licenses TO authenticated;
GRANT SELECT ON public.product_licenses TO anon;
GRANT SELECT ON public.order_item_licenses TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_item_licenses FROM anon, authenticated;

-- The checkout function is the sole writer for immutable license snapshots.
-- It validates the selected tier again at checkout time, so a license removed
-- from sale after add-to-cart cannot be purchased with stale client state.
DROP FUNCTION IF EXISTS public.create_checkout_order(uuid, bigint);

CREATE FUNCTION public.create_checkout_order(
  p_profile_id uuid,
  p_product_id bigint,
  p_product_license_id uuid
)
RETURNS TABLE (
  order_id uuid,
  order_number text,
  total_amount integer,
  product_name text,
  license_name text,
  resumed boolean,
  invoice_creation_token uuid,
  should_create_invoice boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product public.products;
  v_license public.product_licenses;
  v_seller public.sellers;
  v_order public.orders;
  v_order_item_id bigint;
  v_commission_rate numeric := 0;
  v_commission_amount integer := 0;
  v_seller_earning integer := 0;
  v_claim_token uuid;
  v_should_create_invoice boolean := false;
BEGIN
  IF p_profile_id IS NULL OR p_product_id IS NULL OR p_product_license_id IS NULL THEN
    RAISE EXCEPTION 'Buyer, product, and product license are required.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Buyer profile was not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'checkout:' || p_profile_id::text || ':' || p_product_id::text || ':' || p_product_license_id::text,
      0
    )
  );

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND status = 'published'
  FOR SHARE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product is not available.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_license
  FROM public.product_licenses
  WHERE id = p_product_license_id
    AND product_id = p_product_id
    AND is_active = true
  FOR SHARE;

  IF v_license.id IS NULL THEN
    RAISE EXCEPTION 'The selected product license is no longer available.' USING ERRCODE = 'P0002';
  END IF;
  IF v_license.price <= 0 THEN
    RAISE EXCEPTION 'The selected product license price is invalid.' USING ERRCODE = '22023';
  END IF;

  IF v_product.seller_id IS NOT NULL THEN
    SELECT * INTO v_seller
    FROM public.sellers
    WHERE id = v_product.seller_id
    FOR SHARE;

    IF v_seller.id IS NULL OR v_seller.status <> 'approved' THEN
      RAISE EXCEPTION 'Seller is not currently accepting orders.' USING ERRCODE = 'P0001';
    END IF;
    IF v_seller.profile_id = p_profile_id THEN
      RAISE EXCEPTION 'You cannot purchase your own product.' USING ERRCODE = 'P0001';
    END IF;
    IF v_seller.commission_rate < 0 OR v_seller.commission_rate > 1 THEN
      RAISE EXCEPTION 'Seller commission configuration is invalid.' USING ERRCODE = '22023';
    END IF;

    v_commission_rate := v_seller.commission_rate;
    v_commission_amount := round(v_license.price * v_commission_rate)::integer;
    v_seller_earning := v_license.price - v_commission_amount;
  END IF;

  SELECT candidate.* INTO v_order
  FROM public.orders AS candidate
  WHERE candidate.profile_id = p_profile_id
    AND candidate.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.order_items
      JOIN public.order_item_licenses
        ON order_item_licenses.order_item_id = order_items.id
      WHERE order_items.order_id = candidate.id
        AND order_items.product_id = p_product_id
        AND order_item_licenses.product_license_id = p_product_license_id
    )
  ORDER BY candidate.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payments
      WHERE payments.order_id = v_order.id
        AND payments.provider = 'xendit'
        AND payments.provider_invoice_id IS NOT NULL
    ) AND (
      v_order.invoice_creation_token IS NULL
      OR v_order.invoice_creation_started_at < now() - interval '2 minutes'
    ) THEN
      v_claim_token := gen_random_uuid();
      v_should_create_invoice := true;
      UPDATE public.orders
      SET invoice_creation_token = v_claim_token,
          invoice_creation_started_at = now()
      WHERE id = v_order.id;
    ELSE
      v_claim_token := v_order.invoice_creation_token;
    END IF;

    RETURN QUERY SELECT
      v_order.id,
      v_order.order_number,
      v_order.total_amount,
      v_product.name,
      v_license.name,
      true,
      v_claim_token,
      v_should_create_invoice;
    RETURN;
  END IF;

  v_claim_token := gen_random_uuid();
  INSERT INTO public.orders (
    profile_id,
    order_number,
    total_amount,
    status,
    created_at,
    invoice_creation_token,
    invoice_creation_started_at
  ) VALUES (
    p_profile_id,
    'ORD-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_license.price,
    'pending',
    now(),
    v_claim_token,
    now()
  )
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    price,
    seller_id,
    commission_rate_snapshot,
    commission_amount,
    seller_earning
  ) VALUES (
    v_order.id,
    v_product.id,
    v_license.price,
    v_product.seller_id,
    v_commission_rate,
    v_commission_amount,
    v_seller_earning
  )
  RETURNING id INTO v_order_item_id;

  INSERT INTO public.order_item_licenses (
    order_item_id,
    product_license_id,
    license_name_snapshot,
    usage_terms_snapshot,
    allow_commercial_use_snapshot,
    allow_resale_snapshot,
    price_snapshot
  ) VALUES (
    v_order_item_id,
    v_license.id,
    v_license.name,
    v_license.usage_terms,
    v_license.allow_commercial_use,
    v_license.allow_resale,
    v_license.price
  );

  RETURN QUERY SELECT
    v_order.id,
    v_order.order_number,
    v_order.total_amount,
    v_product.name,
    v_license.name,
    false,
    v_claim_token,
    true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, bigint, uuid) TO service_role;

-- Compatibility wrapper for an in-flight deployment of the previous API.
-- It still writes a proper immutable license snapshot through the new
-- implementation and can be removed after all deployments use the UUID arg.
CREATE FUNCTION public.create_checkout_order(
  p_profile_id uuid,
  p_product_id bigint
)
RETURNS TABLE (
  order_id uuid,
  order_number text,
  total_amount integer,
  product_name text,
  resumed boolean,
  invoice_creation_token uuid,
  should_create_invoice boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_license_id uuid;
BEGIN
  SELECT id INTO v_product_license_id
  FROM public.product_licenses
  WHERE product_id = p_product_id
    AND is_active = true
  ORDER BY sort_order, created_at, id
  LIMIT 1;

  IF v_product_license_id IS NULL THEN
    RAISE EXCEPTION 'The product does not have an active license.' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    checkout.order_id,
    checkout.order_number,
    checkout.total_amount,
    checkout.product_name,
    checkout.resumed,
    checkout.invoice_creation_token,
    checkout.should_create_invoice
  FROM public.create_checkout_order(
    p_profile_id,
    p_product_id,
    v_product_license_id
  ) AS checkout;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, bigint) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
