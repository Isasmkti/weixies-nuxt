import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { PURCHASE_SELECT, positivePurchaseId, purchaseResponse } from '~/server/utils/purchase-response';

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0');
  const query = getQuery(event);
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 12);
  const search = String(query.search || '').trim();
  const productId = query.product_id === undefined ? null : positivePurchaseId(query.product_id);

  if (!Number.isSafeInteger(page) || page < 1 || page > 100000
    || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 48
    || search.length > 120 || (query.product_id !== undefined && !productId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid purchase filters.' });
  }

  const supabase = useSupabaseAdmin();
  let request = supabase.from('user_products')
    .select(PURCHASE_SELECT, { count: 'exact' })
    .eq('profile_id', user.id)
    .eq('order.profile_id', user.id)
    .eq('order.status', 'paid')
    .eq('order.purchase_conflict', false);

  if (productId) request = request.eq('product_id', productId);
  if (search) {
    // Escape LIKE wildcards so the search string is always treated literally.
    request = request.ilike('product.name', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  }

  const { data, count, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error('[Purchases API] Fetch error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Your purchases could not be loaded.' });
  }

  return { purchases: (data || []).map(purchaseResponse), total: count || 0, page, page_size: pageSize };
});
