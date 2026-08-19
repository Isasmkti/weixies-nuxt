-- Multi-seller marketplace migration
-- Upgrade applied seller foundation with rejected-seller resubmission support
-- Date: 2026-08-19
--
-- Use this after an earlier version of 0001_seller_foundation.sql has already
-- been applied. It is forward-only and preserves the existing seller rows.

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Replace the original trigger function so sellers cannot self-approve, but
-- can resubmit their own rejected application as pending while clearing the
-- old rejection reason. Admins retain authority over all status transitions.
CREATE OR REPLACE FUNCTION public.enforce_seller_self_update()
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
    RAISE EXCEPTION 'only platform admins may update seller status, commission rate, ownership, or rejection reason';
  END IF;

  RETURN NEW;
END;
$$;

-- The original owner-update policy included rejected rows. Narrow it so the
-- dedicated policy below is the only owner path for a rejected application.
DROP POLICY IF EXISTS "Sellers can update their own record" ON public.sellers;
CREATE POLICY "Sellers can update their own record"
  ON public.sellers
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND status <> 'rejected')
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can resubmit rejected applications" ON public.sellers;
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
