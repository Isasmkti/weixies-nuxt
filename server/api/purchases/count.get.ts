import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const { user } = await requireRequestUser(event);
  const { count, error } = await useSupabaseAdmin().from('user_products')
    .select('id,order:orders!inner(id)', { count: 'exact', head: true })
    .eq('profile_id', user.id).eq('order.profile_id', user.id)
    .eq('order.status', 'paid').eq('order.purchase_conflict', false);
  if (error) throw createError({ statusCode: 503, statusMessage: 'Purchase count could not be loaded.' });
  return { count: count || 0 };
});
