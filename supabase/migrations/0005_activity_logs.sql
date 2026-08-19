-- Multi-seller marketplace migration
-- Activity audit logs for admin monitoring
-- Date: 2026-08-19
--
-- This migration is additive. It records key buyer, seller, admin, and system
-- database events after this migration is applied; it does not backfill or
-- alter existing marketplace data.

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles(id),
  actor_name text,
  actor_type text NOT NULL DEFAULT 'system'
    CHECK (actor_type = ANY (ARRAY['buyer'::text, 'seller'::text, 'admin'::text, 'system'::text])),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX activity_logs_actor_profile_id_idx ON public.activity_logs (actor_profile_id, created_at DESC);
CREATE INDEX activity_logs_actor_type_idx ON public.activity_logs (actor_type, created_at DESC);
CREATE INDEX activity_logs_action_idx ON public.activity_logs (action, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Service role can manage activity logs"
  ON public.activity_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- The triggers below call this SECURITY DEFINER function so logging works for
-- client writes protected by RLS as well as trusted server-side service-role
-- writes. It is intentionally not granted to client roles for direct use.
CREATE FUNCTION public.record_activity(
  p_actor_profile_id uuid,
  p_actor_type text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_actor_name text;
  resolved_actor_type text;
BEGIN
  resolved_actor_type := COALESCE(p_actor_type, 'system');

  IF p_actor_profile_id IS NOT NULL THEN
    SELECT full_name INTO resolved_actor_name
    FROM public.profiles
    WHERE id = p_actor_profile_id;

    IF p_actor_type IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_actor_profile_id AND role = 'admin'
      ) THEN
        resolved_actor_type := 'admin';
      ELSIF EXISTS (
        SELECT 1 FROM public.sellers
        WHERE profile_id = p_actor_profile_id
      ) THEN
        resolved_actor_type := 'seller';
      ELSE
        resolved_actor_type := 'buyer';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.activity_logs (
    actor_profile_id,
    actor_name,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_profile_id,
    resolved_actor_name,
    resolved_actor_type,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity(uuid, text, text, text, text, jsonb) FROM PUBLIC;

CREATE FUNCTION public.audit_profile_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_activity(
    NEW.id,
    'buyer',
    'profile.created',
    'profile',
    NEW.id::text,
    jsonb_build_object('email', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_seller_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_activity(
      NEW.profile_id,
      'seller',
      'seller.application_submitted',
      'seller',
      NEW.id::text,
      jsonb_build_object('store_name', NEW.store_name, 'store_slug', NEW.store_slug, 'status', NEW.status)
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.record_activity(
      auth.uid(),
      NULL,
      'seller.status_changed',
      'seller',
      NEW.id::text,
      jsonb_build_object('seller_profile_id', NEW.profile_id, 'previous_status', OLD.status, 'status', NEW.status)
    );
  ELSE
    PERFORM public.record_activity(
      auth.uid(),
      NULL,
      'seller.updated',
      'seller',
      NEW.id::text,
      jsonb_build_object('seller_profile_id', NEW.profile_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_product_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_action text;
  logged_product_id bigint;
  logged_seller_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    activity_action := 'product.deleted';
    logged_product_id := OLD.id;
    logged_seller_id := OLD.seller_id;
  ELSIF TG_OP = 'INSERT' THEN
    activity_action := 'product.created';
    logged_product_id := NEW.id;
    logged_seller_id := NEW.seller_id;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    activity_action := 'product.status_changed';
    logged_product_id := NEW.id;
    logged_seller_id := NEW.seller_id;
  ELSE
    activity_action := 'product.updated';
    logged_product_id := NEW.id;
    logged_seller_id := NEW.seller_id;
  END IF;

  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    activity_action,
    'product',
    logged_product_id::text,
    jsonb_build_object('seller_id', logged_seller_id)
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_activity(
      NEW.profile_id,
      'buyer',
      'order.created',
      'order',
      NEW.id::text,
      jsonb_build_object('order_number', NEW.order_number, 'total_amount', NEW.total_amount, 'status', NEW.status)
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.record_activity(
      auth.uid(),
      NULL,
      'order.status_changed',
      'order',
      NEW.id::text,
      jsonb_build_object('buyer_profile_id', NEW.profile_id, 'order_number', NEW.order_number, 'previous_status', OLD.status, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_profile_entity_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid;
  entity_id text;
  activity_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    profile_id := OLD.profile_id;
    entity_id := OLD.id::text;
    activity_action := TG_ARGV[1];
  ELSE
    profile_id := NEW.profile_id;
    entity_id := NEW.id::text;
    activity_action := TG_ARGV[0];
  END IF;

  PERFORM public.record_activity(
    profile_id,
    'buyer',
    activity_action,
    TG_ARGV[2],
    entity_id,
    '{}'::jsonb
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_payment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    CASE WHEN TG_OP = 'INSERT' THEN 'payment.created' ELSE 'payment.updated' END,
    'payment',
    NEW.id::text,
    jsonb_build_object('order_id', NEW.order_id, 'provider', NEW.provider, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_payout_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_activity(
    auth.uid(),
    NULL,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'seller_payout.created'
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'seller_payout.status_changed'
      ELSE 'seller_payout.updated'
    END,
    'seller_payout',
    NEW.id::text,
    jsonb_build_object('seller_id', NEW.seller_id, 'amount', NEW.amount, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_profiles_activity
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_activity();

CREATE TRIGGER audit_sellers_activity
  AFTER INSERT OR UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.audit_seller_activity();

CREATE TRIGGER audit_products_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_product_activity();

CREATE TRIGGER audit_orders_activity
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_order_activity();

CREATE TRIGGER audit_reviews_activity
  AFTER INSERT OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_entity_activity('review.created', 'review.deleted', 'review');

CREATE TRIGGER audit_wishlists_activity
  AFTER INSERT OR DELETE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_entity_activity('wishlist.added', 'wishlist.removed', 'wishlist');

CREATE TRIGGER audit_payments_activity
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payment_activity();

CREATE TRIGGER audit_seller_payouts_activity
  AFTER INSERT OR UPDATE ON public.seller_payouts
  FOR EACH ROW EXECUTE FUNCTION public.audit_payout_activity();
