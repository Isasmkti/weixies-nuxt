import { createClient } from '@supabase/supabase-js';

const SIGNED_URL_EXPIRES_IN = 300; // 5 minutes

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
  const productId = query.product_id as string;

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Order ID is required.' });
  }

  if (!profileId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: profile_id required.' });
  }

  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'product_id is required.' });
  }

  // 1. Verify order belongs to user and is paid
  const { data: order, error: orderError } = await reqSupabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('profile_id', profileId)
    .single();

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }

  if (order.status !== 'paid') {
    throw createError({ statusCode: 403, statusMessage: 'Payment not completed. Download unavailable.' });
  }

  // 2. Verify user actually owns this product via user_products
  const { data: ownership, error: ownershipError } = await reqSupabase
    .from('user_products')
    .select('id')
    .eq('profile_id', profileId)
    .eq('product_id', productId)
    .single();

  if (ownershipError || !ownership) {
    throw createError({ statusCode: 403, statusMessage: 'You do not own this product.' });
  }

  // 3. Fetch the product file from product_files table
  const { data: productFile, error: fileError } = await reqSupabase
    .from('product_files')
    .select('file_url, file_name')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fileError || !productFile) {
    throw createError({ statusCode: 404, statusMessage: 'No downloadable file found for this product.' });
  }

  // file_url stores the storage path, e.g. "products/template-admin.zip"
  const storagePath = productFile.file_url;

  // 4. Generate a signed URL (private bucket)
  const { data: signedData, error: signedError } = await reqSupabase.storage
    .from('products')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);

  if (signedError || !signedData?.signedUrl) {
    console.error('[Download] Failed to generate signed URL:', signedError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate download link.' });
  }

  // 5. Log the download
  await reqSupabase.from('download_logs').insert({
    profile_id: profileId,
    product_id: productId,
    downloaded_at: new Date().toISOString(),
    ip_address: getRequestIP(event, { xForwardedFor: true }) || null,
    user_agent: getRequestHeader(event, 'user-agent') || null,
  });

  return {
    url: signedData.signedUrl,
    file_name: productFile.file_name,
    expires_in: SIGNED_URL_EXPIRES_IN,
  };
});
