BEGIN;

-- Reviews are created through this function so the caller cannot impersonate
-- another profile or review a product that they have not paid for.
CREATE OR REPLACE FUNCTION public.submit_verified_review(
  p_product_id bigint,
  p_rating integer,
  p_comment text
)
RETURNS SETOF public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := auth.uid();
  v_review public.reviews;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product is required.' USING ERRCODE = '22023';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5.' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_comment), '') IS NULL THEN
    RAISE EXCEPTION 'Review comment is required.' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(p_comment)) > 1000 THEN
    RAISE EXCEPTION 'Review comment cannot exceed 1000 characters.' USING ERRCODE = '22023';
  END IF;

  -- Serialize submissions for one buyer/product pair to prevent double clicks
  -- from creating duplicate reviews, without modifying historical rows.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_profile_id::text || ':' || p_product_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi.order_id = o.id
    WHERE o.profile_id = v_profile_id
      AND o.status = 'paid'
      AND oi.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Only paid purchases can be reviewed.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reviews AS r
    WHERE r.profile_id = v_profile_id
      AND r.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'You have already reviewed this product.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.reviews (product_id, profile_id, rating, comment)
  VALUES (p_product_id, v_profile_id, p_rating, btrim(p_comment))
  RETURNING * INTO v_review;

  RETURN NEXT v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_verified_review(bigint, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_verified_review(bigint, integer, text) TO authenticated;

-- The application now writes through submit_verified_review. Reads remain
-- unchanged so existing product review lists keep working.
REVOKE INSERT ON TABLE public.reviews FROM anon, authenticated;

COMMENT ON FUNCTION public.submit_verified_review(bigint, integer, text) IS
  'Creates one review per authenticated buyer and product after a paid order is verified.';

COMMIT;
