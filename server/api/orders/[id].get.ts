import { supabase } from '~/utils/supabase';

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id');
  const query = getQuery(event);
  const profileId = query.profile_id as string;

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Order ID is required.' });
  }

  if (!profileId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: profile_id required.' });
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      payment_method,
      midtrans_transaction_id,
      created_at,
      paid_at,
      expired_at,
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
        payment_type,
        gross_amount,
        transaction_status,
        created_at
      )
    `)
    .eq('id', orderId)
    .eq('profile_id', profileId)
    .single();

  if (error || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }

  return { order };
});
