-- Admin dashboard analytics
-- Provides one protected aggregate endpoint for the admin dashboard without
-- widening client-side RLS access to buyer orders or profiles.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_seller_platform_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can view dashboard analytics'
      USING ERRCODE = '42501';
  END IF;

  WITH period_bounds AS (
    SELECT
      now() - interval '30 days' AS current_start,
      now() - interval '60 days' AS previous_start
  ),
  order_metrics AS (
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS total_gmv,
      COUNT(*) AS total_transactions,
      COALESCE(SUM(total_amount) FILTER (
        WHERE status = 'paid'
          AND COALESCE(paid_at, created_at) >= bounds.current_start
      ), 0) AS current_gmv,
      COALESCE(SUM(total_amount) FILTER (
        WHERE status = 'paid'
          AND COALESCE(paid_at, created_at) >= bounds.previous_start
          AND COALESCE(paid_at, created_at) < bounds.current_start
      ), 0) AS previous_gmv,
      COUNT(*) FILTER (WHERE created_at >= bounds.current_start) AS current_transactions,
      COUNT(*) FILTER (
        WHERE created_at >= bounds.previous_start
          AND created_at < bounds.current_start
      ) AS previous_transactions
    FROM public.orders
    CROSS JOIN period_bounds bounds
  ),
  user_metrics AS (
    SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE created_at >= bounds.current_start) AS current_users,
      COUNT(*) FILTER (
        WHERE created_at >= bounds.previous_start
          AND created_at < bounds.current_start
      ) AS previous_users
    FROM public.profiles
    CROSS JOIN period_bounds bounds
  ),
  seller_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'approved') AS active_sellers,
      COUNT(*) FILTER (
        WHERE status = 'approved' AND created_at >= bounds.current_start
      ) AS current_sellers,
      COUNT(*) FILTER (
        WHERE status = 'approved'
          AND created_at >= bounds.previous_start
          AND created_at < bounds.current_start
      ) AS previous_sellers,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_sellers
    FROM public.sellers
    CROSS JOIN period_bounds bounds
  ),
  chart_points AS (
    SELECT
      day::date AS date,
      COALESCE(SUM(orders.total_amount) FILTER (WHERE orders.status = 'paid'), 0) AS revenue,
      COUNT(orders.id) AS transactions
    FROM generate_series(current_date - 29, current_date, interval '1 day') day
    LEFT JOIN public.orders
      ON orders.created_at >= day
      AND orders.created_at < day + interval '1 day'
    GROUP BY day
    ORDER BY day
  ),
  recent_orders AS (
    SELECT
      orders.id,
      orders.order_number,
      orders.total_amount,
      orders.status,
      orders.created_at,
      profiles.full_name AS buyer_name,
      COALESCE(
        array_agg(DISTINCT products.name) FILTER (WHERE products.name IS NOT NULL),
        ARRAY[]::text[]
      ) AS product_names
    FROM public.orders
    LEFT JOIN public.profiles ON profiles.id = orders.profile_id
    LEFT JOIN public.order_items ON order_items.order_id = orders.id
    LEFT JOIN public.products ON products.id = order_items.product_id
    GROUP BY
      orders.id,
      orders.order_number,
      orders.total_amount,
      orders.status,
      orders.created_at,
      profiles.full_name
    ORDER BY orders.created_at DESC
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'gmv', order_metrics.total_gmv,
      'gmv_change', CASE
        WHEN order_metrics.previous_gmv = 0 THEN CASE WHEN order_metrics.current_gmv > 0 THEN 100 ELSE 0 END
        ELSE round(((order_metrics.current_gmv - order_metrics.previous_gmv)::numeric / order_metrics.previous_gmv) * 100, 1)
      END,
      'transactions', order_metrics.total_transactions,
      'transaction_change', CASE
        WHEN order_metrics.previous_transactions = 0 THEN CASE WHEN order_metrics.current_transactions > 0 THEN 100 ELSE 0 END
        ELSE round(((order_metrics.current_transactions - order_metrics.previous_transactions)::numeric / order_metrics.previous_transactions) * 100, 1)
      END,
      'users', user_metrics.total_users,
      'user_change', CASE
        WHEN user_metrics.previous_users = 0 THEN CASE WHEN user_metrics.current_users > 0 THEN 100 ELSE 0 END
        ELSE round(((user_metrics.current_users - user_metrics.previous_users)::numeric / user_metrics.previous_users) * 100, 1)
      END,
      'active_sellers', seller_metrics.active_sellers,
      'seller_change', CASE
        WHEN seller_metrics.previous_sellers = 0 THEN CASE WHEN seller_metrics.current_sellers > 0 THEN 100 ELSE 0 END
        ELSE round(((seller_metrics.current_sellers - seller_metrics.previous_sellers)::numeric / seller_metrics.previous_sellers) * 100, 1)
      END
    ),
    'pending_sellers', seller_metrics.pending_sellers,
    'chart', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', chart_points.date,
        'revenue', chart_points.revenue,
        'transactions', chart_points.transactions
      ) ORDER BY chart_points.date)
      FROM chart_points
    ), '[]'::jsonb),
    'recent_orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(recent_orders) ORDER BY recent_orders.created_at DESC)
      FROM recent_orders
    ), '[]'::jsonb)
  )
  INTO result
  FROM order_metrics, user_metrics, seller_metrics;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;
