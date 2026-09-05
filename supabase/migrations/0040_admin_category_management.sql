-- Atomic category deletion for the authenticated platform-admin API.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_category_with_assignments(
  p_category_id bigint
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignment_count integer := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.categories AS category
    WHERE category.id = p_category_id
  ) THEN
    RAISE EXCEPTION 'Category was not found.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.product_categories AS assignment
  WHERE assignment.category_id = p_category_id;
  GET DIAGNOSTICS v_assignment_count = ROW_COUNT;

  DELETE FROM public.categories AS category
  WHERE category.id = p_category_id;

  RETURN v_assignment_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_category_with_assignments(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_category_with_assignments(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.delete_category_with_assignments(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category_with_assignments(bigint) TO service_role;

COMMIT;
