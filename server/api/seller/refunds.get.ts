import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const relationOne = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const supabase = useSupabaseAdmin();
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0');

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, store_name, store_slug, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (sellerError) {
    console.error('[Seller refunds API] Seller fetch error:', sellerError);
    throw createError({ statusCode: 500, statusMessage: 'Seller account could not be loaded.' });
  }
  if (!seller) {
    throw createError({ statusCode: 403, statusMessage: 'A seller account is required.' });
  }

  const { data: sellerItems, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      id,
      order_id,
      price,
      commission_amount,
      seller_earning,
      payout_status,
      available_for_payout_at,
      product:products(id, name, slug, product_images(image_url, is_primary))
    `)
    .eq('seller_id', seller.id)
    .order('id', { ascending: false })
    .limit(1000);

  if (itemsError) {
    console.error('[Seller refunds API] Order item fetch error:', itemsError);
    throw createError({ statusCode: 500, statusMessage: 'Store refund items could not be loaded.' });
  }

  const orderIds = [...new Set((sellerItems || []).map((item: any) => item.order_id).filter(Boolean))];
  if (!orderIds.length) return { seller, refunds: [] };

  const [{ data: requests, error: requestError }, { data: orders, error: orderError }, { data: completedRefunds, error: completedError }] = await Promise.all([
    supabase
      .from('order_refund_requests')
      .select('id, order_id, reason, status, provider_reference_id, provider_refund_id, provider_failure_code, requested_at, submitted_at, resolved_at, updated_at')
      .in('order_id', orderIds)
      .order('requested_at', { ascending: false })
      .limit(100),
    supabase
      .from('orders')
      .select('id, order_number, status, created_at, paid_at')
      .in('id', orderIds),
    supabase
      .from('payment_refunds')
      .select('order_id, amount, status, provider_refund_id, created_at, updated_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false }),
  ]);

  if (requestError || orderError || completedError) {
    console.error('[Seller refunds API] Refund fetch error:', requestError || orderError || completedError);
    throw createError({ statusCode: 500, statusMessage: 'Store refund information could not be loaded.' });
  }

  const orderById = new Map((orders || []).map((order: any) => [order.id, order]));
  const completedByOrder = new Map<string, any>();
  for (const refund of completedRefunds || []) {
    if (!completedByOrder.has(refund.order_id)) completedByOrder.set(refund.order_id, refund);
  }
  const itemsByOrder = new Map<string, any[]>();
  for (const item of sellerItems || []) {
    const current = itemsByOrder.get(item.order_id) || [];
    const product = relationOne(item.product);
    const images = Array.isArray(product?.product_images) ? product.product_images : [];
    current.push({
      id: item.id,
      price: item.price,
      commission_amount: item.commission_amount,
      seller_earning: item.seller_earning,
      payout_status: item.payout_status,
      available_for_payout_at: item.available_for_payout_at,
      product: product ? {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image_url: images.find((image: any) => image.is_primary)?.image_url || images[0]?.image_url || null,
      } : null,
    });
    itemsByOrder.set(item.order_id, current);
  }

  const refunds = (requests || []).map((request: any) => {
    const order = orderById.get(request.order_id) || null;
    const completed = completedByOrder.get(request.order_id) || null;
    const items = itemsByOrder.get(request.order_id) || [];
    const storeItemTotal = items.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
    return {
      id: request.id,
      reason: request.reason,
      status: request.status,
      failure_code: request.provider_failure_code,
      reference: request.provider_refund_id || request.provider_reference_id,
      requested_at: request.requested_at,
      submitted_at: request.submitted_at,
      resolved_at: request.resolved_at,
      updated_at: request.updated_at,
      provider_status: completed?.status || null,
      store_item_total: storeItemTotal,
      seller_impact: items.reduce((sum: number, item: any) => sum + Number(item.seller_earning || 0), 0),
      order: order ? {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        paid_at: order.paid_at,
      } : null,
      items,
    };
  });

  return { seller, refunds };
});
