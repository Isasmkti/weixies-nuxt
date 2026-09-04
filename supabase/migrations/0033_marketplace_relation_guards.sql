-- Complete the cross-table integrity guards introduced by product licenses,
-- direct buyer/seller chat, and seller self-purchase prevention.

-- A license snapshot may keep a NULL product_license_id after its source tier
-- is deleted (ON DELETE SET NULL). While present, however, that tier must
-- belong to the exact product captured by the parent order item.
CREATE OR REPLACE FUNCTION public.validate_order_item_product_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.product_license_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'product_license_required: a new order license snapshot requires its source license'
        USING ERRCODE = '23502';
    END IF;

    -- ON DELETE SET NULL intentionally preserves immutable order snapshots
    -- after an administrator removes their source license row.
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_items AS order_item
    JOIN public.product_licenses AS product_license
      ON product_license.id = NEW.product_license_id
     AND product_license.product_id = order_item.product_id
    WHERE order_item.id = NEW.order_item_id
  ) THEN
    RAISE EXCEPTION 'product_license_mismatch: the selected license does not belong to the ordered product'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_item_product_license ON public.order_item_licenses;
CREATE TRIGGER validate_order_item_product_license
BEFORE INSERT OR UPDATE OF order_item_id, product_license_id ON public.order_item_licenses
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_item_product_license();

-- Keep this as a dedicated trigger instead of relying on the broader thread
-- context validator, so direct writes and APIs receive an unambiguous code.
CREATE OR REPLACE FUNCTION public.prevent_buyer_seller_self_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sellers AS seller
    WHERE seller.id = NEW.seller_id
      AND seller.profile_id = NEW.buyer_id
  ) THEN
    RAISE EXCEPTION 'self_chat_not_allowed: seller cannot open a conversation with their own store'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_buyer_seller_self_chat ON public.buyer_seller_threads;
CREATE TRIGGER prevent_buyer_seller_self_chat
BEFORE INSERT OR UPDATE OF buyer_id, seller_id ON public.buyer_seller_threads
FOR EACH ROW
EXECUTE FUNCTION public.prevent_buyer_seller_self_chat();

-- Migration 0029 already protects UPDATE-to-published and removal of the last
-- active tier. Extend the publish guard to direct INSERTs as well.
CREATE OR REPLACE FUNCTION public.require_active_license_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'published'
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
BEFORE INSERT OR UPDATE OF status ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.require_active_license_before_publish();
