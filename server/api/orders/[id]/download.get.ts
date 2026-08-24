import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';

const SIGNED_URL_EXPIRES_IN = 300; // 5 minutes

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id');
  const query = getQuery(event);
  const { supabase: reqSupabase, user } = await requireRequestUser(event);
  const productId = query.product_id as string;

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Order ID is required.' });
  }

  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'product_id is required.' });
  }

  await enforceRateLimit(`download:${user.id}`, 30, 60);

  // 1. Verify order belongs to user and is paid
  const { data: order, error: orderError } = await reqSupabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('profile_id', user.id)
    .single();

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }

  if (order.status !== 'paid') {
    throw createError({ statusCode: 403, statusMessage: 'Payment not completed. Download unavailable.' });
  }

  const { data: orderedItem, error: orderedItemError } = await reqSupabase
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle();

  if (orderedItemError || !orderedItem) {
    throw createError({ statusCode: 403, statusMessage: 'Product does not belong to this order.' });
  }

  // 2. Verify user actually owns this product via user_products
  const { data: ownership, error: ownershipError } = await reqSupabase
    .from('user_products')
    .select('id')
    .eq('profile_id', user.id)
    .eq('product_id', productId)
    .single();

  if (ownershipError || !ownership) {
    throw createError({ statusCode: 403, statusMessage: 'You do not own this product.' });
  }

  // 3. Fetch the product file from product_files table
  //    Uses the admin client: ownership/payment already verified above,
  //    and the "products" storage bucket's SELECT policy is admin-only,
  //    so a buyer's own JWT can never read this table/bucket via RLS.
  const supabaseAdmin = useSupabaseAdmin();

  const { data: productFile, error: fileError } = await supabaseAdmin
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
  const storagePath = String(productFile.file_url || '');
  if (storagePath.split('/')[0] !== String(productId) || !storagePath.toLowerCase().endsWith('.zip')) {
    throw createError({ statusCode: 500, statusMessage: 'Product file configuration is invalid.' });
  }

  // 4. Generate a signed URL (private bucket, admin-only SELECT policy)
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from('products')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);

  if (signedError || !signedData?.signedUrl) {
    console.error('[Download] Failed to generate signed URL:', signedError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate download link.' });
  }

  // 5. Log the download
  await supabaseAdmin.from('download_logs').insert({
    profile_id: user.id,
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
