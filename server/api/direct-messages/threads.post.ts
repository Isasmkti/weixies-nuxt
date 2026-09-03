import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { getDirectThreadForUser } from '~/server/utils/direct-messages';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const { supabase, user } = await requireRequestUser(event);
  const admin = useSupabaseAdmin();
  const sellerId = String(body?.seller_id || '').trim();
  const productId = body?.product_id == null ? null : Number(body.product_id);
  const orderId = body?.order_id == null ? null : String(body.order_id).trim();

  if (!UUID.test(sellerId)) throw createError({ statusCode: 400, statusMessage: 'A valid seller_id is required.' });
  if (productId !== null && (!Number.isSafeInteger(productId) || productId <= 0)) throw createError({ statusCode: 400, statusMessage: 'Invalid product_id.' });
  if (orderId !== null && !UUID.test(orderId)) throw createError({ statusCode: 400, statusMessage: 'Invalid order_id.' });

  await enforceRateLimit(`direct-thread:${user.id}`, 10, 3600);

  let existingQuery = admin
    .from('buyer_seller_threads')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('seller_id', sellerId)
    .eq('status', 'open');
  existingQuery = productId === null ? existingQuery.is('product_id', null) : existingQuery.eq('product_id', productId);
  existingQuery = orderId === null ? existingQuery.is('order_id', null) : existingQuery.eq('order_id', orderId);
  const { data: existing } = await existingQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing?.id) return { thread: await getDirectThreadForUser(existing.id, user.id), resumed: true };

  const { data, error } = await supabase
    .from('buyer_seller_threads')
    .insert({ buyer_id: user.id, seller_id: sellerId, product_id: productId, order_id: orderId })
    .select('id')
    .single();
  if (error) {
    throw createError({ statusCode: error.code === '23514' ? 400 : 403, statusMessage: error.message });
  }

  return { thread: await getDirectThreadForUser(data.id, user.id), resumed: false };
});

