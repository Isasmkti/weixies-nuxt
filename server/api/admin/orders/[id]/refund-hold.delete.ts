import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  const orderId = String(getRouterParam(event, 'id') || '').trim();
  if (!UUID_PATTERN.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid order ID is required.' });
  }

  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc('release_order_refund_hold', {
    p_order_id: orderId,
  });
  if (error) {
    throw createError({ statusCode: 409, statusMessage: error.message || 'Refund hold could not be released.' });
  }

  return { status: 'cancelled', refundRequest: Array.isArray(data) ? data[0] : data };
});
