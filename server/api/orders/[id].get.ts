import { requireRequestUser } from '~/server/utils/request-auth';
import { sanitizeBuyerOrder } from '~/server/utils/order-response';

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id');
  const { supabase: reqSupabase, user } = await requireRequestUser(event);

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Order ID is required.' });
  }

  const { data: order, error } = await reqSupabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      created_at,
      paid_at,
      expired_at,
      order_items (
        id,
        price,
        seller_id,
        is_downloaded,
        downloaded_at,
        download_count,
        order_item_licenses (
          id,
          license_name_snapshot,
          usage_terms_snapshot,
          allow_commercial_use_snapshot,
          allow_resale_snapshot,
          price_snapshot
        ),
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
    .eq('id', orderId)
    .eq('profile_id', user.id)
    .single();

  if (error || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }

  return { order: sanitizeBuyerOrder(order) };
});
