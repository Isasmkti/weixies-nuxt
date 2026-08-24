import { requireRequestUser } from '~/server/utils/request-auth';
import { sanitizeBuyerOrder } from '~/server/utils/order-response';

export default defineEventHandler(async (event) => {
  const { supabase: reqSupabase, user } = await requireRequestUser(event);

  const { data: orders, error } = await reqSupabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      created_at,
      paid_at,
      order_items (
        id,
        price,
        product:products (
          id,
          name,
          slug,
          description,
          product_images ( image_url )
        )
      ),
      payments (
        id,
        provider,
        provider_invoice_id,
        payment_method,
        status,
        paid_at,
        raw_response,
        created_at
      )
    `)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Orders API] Fetch error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch orders.' });
  }

  return { orders: (orders || []).map(sanitizeBuyerOrder) };
});
