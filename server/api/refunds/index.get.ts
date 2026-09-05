import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const relationOne = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const supabase = useSupabaseAdmin();
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0');

  const { data: requests, error } = await supabase
    .from('order_refund_requests')
    .select(`
      id,
      order_id,
      reason,
      status,
      provider_reference_id,
      provider_refund_id,
      provider_failure_code,
      requested_at,
      submitted_at,
      resolved_at,
      updated_at,
      order:orders!inner(
        id,
        profile_id,
        order_number,
        total_amount,
        status,
        created_at,
        paid_at,
        order_items(
          id,
          price,
          product:products(
            id,
            name,
            slug,
            product_images(image_url, is_primary),
            seller:sellers(id, store_name, store_slug)
          )
        ),
        payments(id, provider, payment_method, status, paid_at)
      )
    `)
    .eq('order.profile_id', user.id)
    .order('requested_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Buyer refunds API] Fetch error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Refund information could not be loaded.' });
  }

  const orderIds = (requests || []).map((request: any) => request.order_id);
  const { data: completedRefunds, error: completedError } = orderIds.length
    ? await supabase
      .from('payment_refunds')
      .select('order_id, amount, status, provider_refund_id, created_at, updated_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })
    : { data: [], error: null };

  if (completedError) {
    console.error('[Buyer refunds API] Completed refund fetch error:', completedError);
    throw createError({ statusCode: 500, statusMessage: 'Completed refund information could not be loaded.' });
  }

  const completedByOrder = new Map<string, any>();
  for (const refund of completedRefunds || []) {
    if (!completedByOrder.has(refund.order_id)) completedByOrder.set(refund.order_id, refund);
  }

  const refunds = (requests || []).map((request: any) => {
    const order = relationOne(request.order);
    const payment = (order?.payments || []).find((item: any) => item.status === 'refunded')
      || (order?.payments || []).find((item: any) => item.status === 'paid')
      || order?.payments?.[0]
      || null;
    const completed = completedByOrder.get(request.order_id) || null;
    const items = (order?.order_items || []).map((item: any) => {
      const product = relationOne(item.product);
      const seller = relationOne(product?.seller);
      const images = Array.isArray(product?.product_images) ? product.product_images : [];
      return {
        id: item.id,
        price: item.price,
        product: product ? {
          id: product.id,
          name: product.name,
          slug: product.slug,
          image_url: images.find((image: any) => image.is_primary)?.image_url || images[0]?.image_url || null,
        } : null,
        store: seller ? {
          id: seller.id,
          name: seller.store_name,
          slug: seller.store_slug,
        } : null,
      };
    });

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
      amount: completed?.amount ?? order?.total_amount ?? 0,
      provider_status: completed?.status || null,
      payment_method: payment?.payment_method || null,
      order: order ? {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        created_at: order.created_at,
        paid_at: order.paid_at,
      } : null,
      items,
    };
  });

  return { refunds };
});
