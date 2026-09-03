import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { getDirectThreadForUser } from '~/server/utils/direct-messages';

export default defineEventHandler(async (event) => {
  const threadId = String(getRouterParam(event, 'id') || '').trim();
  const body = await readBody(event).catch(() => ({}));
  const reason = String(body?.reason || '').trim();
  const { supabase, user } = await requireRequestUser(event);
  if (reason.length < 3 || reason.length > 2000) throw createError({ statusCode: 400, statusMessage: 'Report reason must contain 3 to 2000 characters.' });
  await getDirectThreadForUser(threadId, user.id);
  await enforceRateLimit(`direct-report:${user.id}`, 3, 3600);

  const { error } = await supabase.from('buyer_seller_reports').insert({ thread_id: threadId, reported_by: user.id, reason });
  if (error) throw createError({ statusCode: 403, statusMessage: error.message });
  return { ok: true };
});
