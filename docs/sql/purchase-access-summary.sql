BEGIN TRANSACTION READ ONLY;
-- One SELECT because the CLI returns only the last result set.
SELECT jsonb_build_object(
  'invalid_ownership', (SELECT count(*) FROM public.user_products u LEFT JOIN public.orders o ON o.id=u.order_id
    WHERE o.id IS NULL OR o.status <> 'paid' OR o.profile_id <> u.profile_id
      OR (SELECT count(*) FROM public.order_items i WHERE i.order_id=u.order_id AND i.product_id=u.product_id) <> 1),
  'duplicate_paid_pairs', (SELECT count(*) FROM (SELECT o.profile_id,i.product_id FROM public.orders o
    JOIN public.order_items i ON i.order_id=o.id WHERE o.status='paid'
    GROUP BY o.profile_id,i.product_id HAVING count(DISTINCT o.id)>1) d),
  'paid_items_missing_ownership', (SELECT count(*) FROM public.orders o JOIN public.order_items i ON i.order_id=o.id
    WHERE o.status='paid' AND NOT EXISTS (SELECT 1 FROM public.user_products u WHERE u.profile_id=o.profile_id AND u.product_id=i.product_id)),
  'duplicate_pending_pairs', (SELECT count(*) FROM (SELECT o.profile_id,i.product_id FROM public.orders o
    JOIN public.order_items i ON i.order_id=o.id WHERE o.status='pending'
    GROUP BY o.profile_id,i.product_id HAVING count(DISTINCT o.id)>1) d),
  'unknown_pending_invoices', (SELECT count(*) FROM public.orders o WHERE o.status='pending' AND NOT EXISTS
    (SELECT 1 FROM public.payments p WHERE p.order_id=o.id AND p.provider='xendit' AND p.provider_invoice_id IS NOT NULL)),
  'historical_over_limit', (SELECT count(*) FROM public.order_items WHERE download_count>3),
  'auth_session_columns', (SELECT jsonb_agg(column_name) FROM information_schema.columns WHERE table_schema='auth'
    AND table_name='sessions' AND column_name IN ('id','user_id','not_after')),
  'zip_bucket', (SELECT jsonb_build_object('private',NOT public,'max_bytes',file_size_limit) FROM storage.buckets WHERE id='products'),
  'policies', (SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'using',qual,'check',with_check))
    FROM pg_policies WHERE (schemaname='public' AND tablename IN ('orders','order_items','user_products','download_logs','product_files'))
      OR (schemaname='storage' AND tablename='objects'))
) AS audit;
ROLLBACK;
