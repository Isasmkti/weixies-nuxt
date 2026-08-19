-- Multi-seller marketplace migration
-- Phase 1: seller foundation and onboarding
-- Date: 2026-08-19
--
-- This migration is additive. It creates the seller profile associated with a
-- buyer account; it deliberately does not modify products, orders, or order
-- items. A seller application always begins in the pending state.

CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  store_name text NOT NULL,
  store_slug text NOT NULL UNIQUE,
  store_description text,
  bank_account text,
  bank_name text,
  commission_rate numeric NOT NULL DEFAULT 0.10,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text, 'rejected'::text])),
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sellers_pkey PRIMARY KEY (id),
  CONSTRAINT sellers_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- The policy checks the existing profiles.role value without changing its enum
-- or schema. SECURITY DEFINER makes the authorization check independent of
-- any RLS policy that may already protect public.profiles.
CREATE FUNCTION public.is_seller_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_seller_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_seller_platform_admin() TO authenticated;

-- Sellers may maintain their own onboarding details, but must not approve or
-- suspend themselves, change their commission, or transfer the seller record.
-- The sole self-service status transition is rejected -> pending for a
-- resubmission, which must also clear the old rejection reason.
CREATE FUNCTION public.enforce_seller_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_seller_platform_admin()
     AND (
       (
         NEW.status IS DISTINCT FROM OLD.status
         AND NOT (
           OLD.status = 'rejected'
           AND NEW.status = 'pending'
           AND NEW.profile_id = auth.uid()
           AND NEW.rejection_reason IS NULL
         )
       )
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR (
         NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
         AND NOT (
           OLD.status = 'rejected'
           AND NEW.status = 'pending'
           AND NEW.profile_id = auth.uid()
           AND NEW.rejection_reason IS NULL
         )
       )
     ) THEN
    RAISE EXCEPTION 'only platform admins may update seller status, commission rate, or ownership';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_seller_self_update
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seller_self_update();

CREATE POLICY "Sellers can view their own record"
  ON public.sellers
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Platform admins can view seller records"
  ON public.sellers
  FOR SELECT
  TO authenticated
  USING (public.is_seller_platform_admin());

CREATE POLICY "Users can create their own pending seller application"
  ON public.sellers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending'
    AND commission_rate = 0.10
  );

CREATE POLICY "Sellers can update their own record"
  ON public.sellers
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND status <> 'rejected')
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Sellers can resubmit rejected applications"
  ON public.sellers
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND status = 'rejected')
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending'
    AND rejection_reason IS NULL
  );

CREATE POLICY "Platform admins can update seller records"
  ON public.sellers
  FOR UPDATE
  TO authenticated
  USING (public.is_seller_platform_admin())
  WITH CHECK (public.is_seller_platform_admin());

-- RLS cannot limit columns. Expose approved storefront information through a
-- deliberately narrow view instead of granting public SELECT on sellers,
-- which also contains bank and commission data.
CREATE VIEW public.approved_seller_stores AS
  SELECT id, store_name, store_slug, store_description, created_at
  FROM public.sellers
  WHERE status = 'approved';

REVOKE ALL ON public.approved_seller_stores FROM PUBLIC;
GRANT SELECT ON public.approved_seller_stores TO anon, authenticated;
