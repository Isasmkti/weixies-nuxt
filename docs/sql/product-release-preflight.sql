-- Read-only checks to run before 0044_product_file_versions.sql.

-- Storage paths must be unique in practice so an existing download session can
-- be associated with exactly one product_files row.
SELECT file_url, count(*) AS rows_using_path
FROM public.product_files
GROUP BY file_url
HAVING count(*) > 1;

-- Product rows that cannot currently deliver a ZIP.
SELECT product.id, product.name, product.status
FROM public.products AS product
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_files AS file WHERE file.product_id = product.id
)
ORDER BY product.id;

-- Invalid legacy paths will be unavailable to the secure download proxy.
SELECT id, product_id, file_url
FROM public.product_files
WHERE split_part(file_url, '/', 1) <> product_id::text
   OR file_url ~ '(^|/)\.\.(/|$)'
   OR lower(file_url) !~ '\.zip$'
ORDER BY product_id, created_at;

-- Paid receipts without canonical ownership are already denied by the current
-- download path and should be reconciled before release entitlements are added.
SELECT customer_order.id AS order_id, customer_order.profile_id, item.product_id
FROM public.orders AS customer_order
JOIN public.order_items AS item ON item.order_id = customer_order.id
LEFT JOIN public.user_products AS ownership
  ON ownership.profile_id = customer_order.profile_id
 AND ownership.product_id = item.product_id
 AND ownership.order_id = customer_order.id
WHERE customer_order.status = 'paid'
  AND ownership.id IS NULL
ORDER BY customer_order.created_at, item.id;

-- These products need an admin review because the old schema cannot tell
-- whether their newest ZIP had previously been approved.
SELECT product.id, product.name, product.status, count(file.id) AS file_count,
       max(file.created_at) AS newest_file_at
FROM public.products AS product
JOIN public.product_files AS file ON file.product_id = product.id
WHERE product.status IN ('draft', 'pending_review', 'rejected')
GROUP BY product.id, product.name, product.status
ORDER BY newest_file_at DESC;
