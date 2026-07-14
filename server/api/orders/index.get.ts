import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
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

  if (!profileId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: profile_id required.' });
  }

  const { data: orders, error } = await reqSupabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      payment_method,
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
      )
    `)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Orders API] Fetch error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch orders.' });
  }

  return { orders: orders || [] };
});
