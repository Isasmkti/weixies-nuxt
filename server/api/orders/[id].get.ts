import { requireRequestUser } from '~/server/utils/request-auth';
import { sanitizeBuyerOrder } from '~/server/utils/order-response';
import { attachOrderPurchaseMetadata } from '~/server/utils/order-purchase-metadata';

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id');
  const { supabase: reqSupabase, user } = await requireRequestUser(event);
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

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
      purchase_conflict,
      purchase_conflict_reason,
      created_at,
      paid_at,
      expired_at,
      order_items (
        id,
        product_id,
        price,
        seller_id,
        is_downloaded,
        downloaded_at,
        download_count,
        download_limit,
        product_file_id_at_purchase,
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

  const [purchaseOrder] = await attachOrderPurchaseMetadata([order], user.id);
  return { order: sanitizeBuyerOrder(purchaseOrder) };
});
