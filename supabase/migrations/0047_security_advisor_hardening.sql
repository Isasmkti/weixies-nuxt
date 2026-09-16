-- Close legacy PostgREST function exposure reported by the Supabase security
-- advisor. Browser-callable SECURITY DEFINER functions are re-granted below
-- through an explicit allowlist; all other privileged functions stay internal.

BEGIN;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Prevent
-- future migrations owned by the migration role from reopening that surface.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT format(
      '%I.%I(%s)',
      function_namespace.nspname,
      function_definition.proname,
      pg_get_function_identity_arguments(function_definition.oid)
    ) AS signature
    FROM pg_proc AS function_definition
    JOIN pg_namespace AS function_namespace
      ON function_namespace.oid = function_definition.pronamespace
    WHERE function_namespace.nspname = 'public'
      AND function_definition.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_record.signature
    );
  END LOOP;
END;
$$;

-- Functions used directly by authenticated clients or by RLS policies. Each
-- function performs its own ownership/admin checks before reading or writing.
GRANT EXECUTE ON FUNCTION public.is_seller_platform_admin()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_payout_candidates(
  timestamp with time zone,
  timestamp with time zone
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_product_assets(bigint)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_product_image_object(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_owns_order(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_verified_review(bigint, integer, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_buyer_seller_thread_participant(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_buyer_seller_thread_read(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_product_file_release(
  bigint,
  text,
  text,
  bigint,
  boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_product_release(bigint, text)
  TO authenticated;

-- Trigger functions never need direct PostgREST execution. This also covers
-- trigger helpers introduced after the advisor snapshot without maintaining a
-- fragile name list. PostgreSQL triggers continue to invoke them normally.
DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT format(
      '%I.%I(%s)',
      function_namespace.nspname,
      function_definition.proname,
      pg_get_function_identity_arguments(function_definition.oid)
    ) AS signature
    FROM pg_proc AS function_definition
    JOIN pg_namespace AS function_namespace
      ON function_namespace.oid = function_definition.pronamespace
    WHERE function_namespace.nspname = 'public'
      AND function_definition.prorettype = 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_record.signature
    );
  END LOOP;
END;
$$;

-- Fix the three legacy functions reported with a caller-controlled search
-- path. A fixed path preserves their existing unqualified public references.
DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT format(
      '%I.%I(%s)',
      function_namespace.nspname,
      function_definition.proname,
      pg_get_function_identity_arguments(function_definition.oid)
    ) AS signature
    FROM pg_proc AS function_definition
    JOIN pg_namespace AS function_namespace
      ON function_namespace.oid = function_definition.pronamespace
    WHERE function_namespace.nspname = 'public'
      AND function_definition.proname IN (
        'generate_slug',
        'ensure_single_primary_image',
        'set_wishlist_profile_id'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO public, pg_catalog',
      function_record.signature
    );
  END LOOP;
END;
$$;

-- Checkout and payment writes are server-owned. Removing the permissive legacy
-- policy also clears the advisor warning even on projects upgraded in place.
DROP POLICY IF EXISTS "Authenticated can upsert own payments" ON public.payments;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
GRANT ALL PRIVILEGES ON public.payments TO service_role;

-- These buckets are public, so public object delivery uses the Storage public
-- URL and does not require an unrestricted storage.objects listing policy.
-- Drop only SELECT policies: upload/update/delete ownership policies remain.
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND policyname IN (
        'Public can view home carousel images',
        'Public can view product images',
        'Public can view seller shop images',
        'Public can view welcome assets',
        'manage profile 2 2xzj1p_1',
        'manage profiles image 2xzj1p_2'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON storage.objects',
      policy_record.policyname
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
