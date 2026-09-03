-- Prevent sellers from buying, carting, or wishlisting products owned by their
-- own seller account. Application checks provide friendly errors; these
-- triggers are the final race-condition/direct-access guard.

CREATE OR REPLACE FUNCTION public.prevent_self_purchase_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders AS buyer_order
    JOIN public.products AS product ON product.id = NEW.product_id
    JOIN public.sellers AS seller ON seller.id = product.seller_id
    WHERE buyer_order.id = NEW.order_id
      AND buyer_order.profile_id = seller.profile_id
  ) THEN
    RAISE EXCEPTION 'self_purchase_not_allowed: seller cannot purchase own product (order_id: %, product_id: %)', NEW.order_id, NEW.product_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_purchase ON public.order_items;
CREATE TRIGGER trg_prevent_self_purchase
BEFORE INSERT OR UPDATE OF order_id, product_id, seller_id ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_purchase_order_item();

CREATE OR REPLACE FUNCTION public.prevent_self_purchase_cart_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cart AS buyer_cart
    JOIN public.products AS product ON product.id = NEW.product_id
    JOIN public.sellers AS seller ON seller.id = product.seller_id
    WHERE buyer_cart.id = NEW.cart_id
      AND buyer_cart.profile_id = seller.profile_id
  ) THEN
    RAISE EXCEPTION 'self_purchase_not_allowed: seller cannot add own product to cart (product_id: %)', NEW.product_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_purchase_cart_item ON public.cart_items;
CREATE TRIGGER trg_prevent_self_purchase_cart_item
BEFORE INSERT OR UPDATE OF cart_id, product_id ON public.cart_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_purchase_cart_item();

CREATE OR REPLACE FUNCTION public.prevent_self_purchase_wishlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    JOIN public.sellers AS seller ON seller.id = product.seller_id
    WHERE product.id = NEW.product_id
      AND seller.profile_id = NEW.profile_id
  ) THEN
    RAISE EXCEPTION 'self_purchase_not_allowed: seller cannot add own product to wishlist (product_id: %)', NEW.product_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_purchase_wishlist ON public.wishlists;
CREATE TRIGGER trg_prevent_self_purchase_wishlist
BEFORE INSERT OR UPDATE OF profile_id, product_id ON public.wishlists
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_purchase_wishlist();
