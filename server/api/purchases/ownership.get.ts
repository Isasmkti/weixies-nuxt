import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { positivePurchaseId } from '~/server/utils/purchase-response';

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0');
  const query = getQuery(event);
  const input = String(query.product_ids || '').split(',');
  const ids = input.map(positivePurchaseId);
  if (!input.length || input.length > 100 || ids.some(id => !id)) {
    throw createError({ statusCode: 400, statusMessage: 'Provide between 1 and 100 valid product IDs.' });
  }

  const supabase = useSupabaseAdmin();
  // Use the same ownership priority as cart/checkout guards, including paid
  // legacy orders still waiting for entitlement reconciliation. One bounded
  // database call avoids fetching an unlimited order history or N API calls.
  const { data, error } = await supabase.rpc('get_purchase_ownership_batch', {
    p_profile_id: user.id,
    p_product_ids: [...new Set(ids as string[])],
  });

  if (error) {
    console.error('[Purchase ownership API] Fetch error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Purchase status could not be checked.' });
  }

  return {
    ownership: (data || []).map((row: any) => ({
      product_id: row.product_id,
      order_id: row.order_id || null,
      has_access: row.has_access === true,
    })),
  };
});
