import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  const supabase = useSupabaseAdmin();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      created_at,
      paid_at,
      buyer:profiles(full_name, email),
      order_items(
        id,
        seller_id,
        price,
        seller_earning,
        payout_status,
        available_for_payout_at,
        product:products(name)
      ),
      payments(id, provider, provider_invoice_id, status, raw_response),
      order_refund_requests(
        id,
        reason,
        status,
        provider_reference_id,
        provider_refund_id,
        provider_failure_code,
        requested_at,
        submitted_at,
        resolved_at
      )
    `)
    .in('status', ['paid', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Orders could not be loaded.' });
  }

  return { orders: data || [] };
});
