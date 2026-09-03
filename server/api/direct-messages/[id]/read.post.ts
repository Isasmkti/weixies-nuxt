import { requireRequestUser } from '~/server/utils/request-auth';

export default defineEventHandler(async (event) => {
  const threadId = String(getRouterParam(event, 'id') || '').trim();
  const { supabase } = await requireRequestUser(event);
  const { error } = await supabase.rpc('mark_buyer_seller_thread_read', { p_thread_id: threadId });
  if (error) throw createError({ statusCode: error.code === 'P0002' ? 404 : 403, statusMessage: error.message });
  return { ok: true };
});
