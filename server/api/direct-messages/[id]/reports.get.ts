import { requireRequestUser } from '~/server/utils/request-auth';
import { getDirectThreadForUser } from '~/server/utils/direct-messages';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const threadId = String(getRouterParam(event, 'id') || '');
  await getDirectThreadForUser(threadId, user.id);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const { data, error } = await useSupabaseAdmin().from('buyer_seller_reports')
    .select('id, category, reason, status, created_at, reviewed_at, resolution_note')
    .eq('thread_id', threadId).eq('reported_by', user.id)
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw createError({ statusCode: 500, statusMessage: 'Reports could not be loaded.' });
  return { reports: data || [] };
});
