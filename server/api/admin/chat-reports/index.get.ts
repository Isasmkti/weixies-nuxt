import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const query = getQuery(event);
  const status = String(query.status || 'open');
  const page = Number(query.page || 1);
  if (!['all', 'open', 'reviewed', 'dismissed'].includes(status) || !Number.isSafeInteger(page) || page < 1 || page > 100000) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid report filter.' });
  }
  let request = useSupabaseAdmin().from('buyer_seller_reports')
    .select('id, category, reason, status, created_at, reporter:profiles!buyer_seller_reports_reported_by_fkey(full_name)', { count: 'exact' });
  if (status !== 'all') request = request.eq('status', status);
  const { data, count, error } = await request.order('created_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1);
  if (error) throw createError({ statusCode: 500, statusMessage: 'Chat reports could not be loaded.' });
  return { reports: data || [], total: count || 0 };
});
