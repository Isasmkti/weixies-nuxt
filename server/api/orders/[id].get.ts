import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id');
  const query = getQuery(event);
  const config = useRuntimeConfig();

  const authHeader = getRequestHeader(event, 'authorization');
  const reqSupabase = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
    {
      global: {
        headers: { Authorization: authHeader || '' }
      }
    }
  );
  const profileId = query.profile_id as string;

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Order ID is required.' });
  }

  if (!profileId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: profile_id required.' });
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
    .eq('profile_id', profileId)
    .single();

  if (error || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }

  return { order };
});
