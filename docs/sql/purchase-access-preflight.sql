-- READ ONLY: run before applying 0041/0042. These checks never repair data.
-- Every ambiguous duplicate/missing ownership case needs review before rollout.
BEGIN TRANSACTION READ ONLY;

-- 1. Installed migration versions (must include 0039 and 0040).
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- 2. Canonical ownership must identify a paid order belonging to this buyer
-- with exactly one matching item. Refunded/stale ownership is not a new grant.
SELECT ownership.id, ownership.profile_id, ownership.product_id,
       ownership.order_id, customer_order.status,
       customer_order.profile_id AS order_buyer_id,
       count(item.id) AS matching_items
FROM public.user_products AS ownership
JOIN public.orders AS customer_order ON customer_order.id = ownership.order_id
LEFT JOIN public.order_items AS item ON item.order_id = ownership.order_id
  AND item.product_id = ownership.product_id
GROUP BY ownership.id, ownership.profile_id, ownership.product_id,
         ownership.order_id, customer_order.status, customer_order.profile_id
HAVING customer_order.status <> 'paid'
  OR customer_order.profile_id <> ownership.profile_id
  OR count(item.id) <> 1;

-- 3. Duplicate paid orders: never grant three downloads per duplicate invoice.
SELECT customer_order.profile_id, item.product_id,
       array_agg(DISTINCT customer_order.id) AS paid_order_ids,
       count(DISTINCT customer_order.id) AS paid_order_count,
       sum(item.download_count) AS recorded_downloads
FROM public.orders AS customer_order
JOIN public.order_items AS item ON item.order_id = customer_order.id
WHERE customer_order.status = 'paid'
GROUP BY customer_order.profile_id, item.product_id
HAVING count(DISTINCT customer_order.id) > 1;

-- 4. Paid products missing any active ownership. Refund history may make old
-- download logs ambiguous; no unconditional zero-counter backfill is safe.
SELECT customer_order.id AS order_id, customer_order.profile_id, item.product_id,
       item.id AS order_item_id, item.download_count
FROM public.orders AS customer_order
JOIN public.order_items AS item ON item.order_id = customer_order.id
WHERE customer_order.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_products AS ownership
    WHERE ownership.profile_id = customer_order.profile_id AND ownership.product_id = item.product_id
  );

-- 5. Simultaneous active invoices across license tiers / duplicate local items.
SELECT customer_order.profile_id, item.product_id,
       array_agg(DISTINCT customer_order.id) AS pending_order_ids,
       array_agg(DISTINCT payment.provider_invoice_id) FILTER (WHERE payment.provider_invoice_id IS NOT NULL) AS invoice_ids
FROM public.orders AS customer_order
JOIN public.order_items AS item ON item.order_id = customer_order.id
LEFT JOIN public.payments AS payment ON payment.order_id = customer_order.id AND payment.provider = 'xendit'
WHERE customer_order.status = 'pending'
GROUP BY customer_order.profile_id, item.product_id
HAVING count(DISTINCT customer_order.id) > 1 OR count(DISTINCT payment.provider_invoice_id) > 1;

-- 6. An attempted invoice without a receipt must be reconciled by external_id;
-- do not mark failed or retry provider creation based on elapsed time alone.
SELECT customer_order.id, customer_order.profile_id, customer_order.created_at,
       customer_order.invoice_creation_started_at
FROM public.orders AS customer_order
WHERE customer_order.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments AS payment
    WHERE payment.order_id = customer_order.id AND payment.provider = 'xendit'
      AND payment.provider_invoice_id IS NOT NULL
  );

-- 7. Counts above the new cap remain intact and have zero downloads remaining.
SELECT id, order_id, product_id, download_count, downloaded_at
FROM public.order_items WHERE download_count > 3;

-- 8. Compare old log totals with canonical item summaries; counts from refunded
-- purchases must not be silently assigned to a later new ownership.
SELECT log.profile_id, log.product_id, count(*) AS legacy_log_count,
       count(DISTINCT ownership.order_id) AS canonical_order_count
FROM public.download_logs AS log
LEFT JOIN public.user_products AS ownership ON ownership.profile_id = log.profile_id
  AND ownership.product_id = log.product_id
GROUP BY log.profile_id, log.product_id;

-- 9. Live policies and grants are not fully represented in the initial dump.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN
  ('orders', 'order_items', 'user_products', 'payments', 'cart_items', 'download_logs', 'product_files'))
  OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name IN
  ('orders', 'order_items', 'user_products', 'payments', 'cart_items', 'download_logs', 'product_files')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN
  ('orders', 'order_items', 'user_products', 'payments', 'cart_items', 'download_logs')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE')
ORDER BY table_name, column_name, grantee;

SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'products';
ROLLBACK;
