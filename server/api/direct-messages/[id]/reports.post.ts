import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { getDirectThreadForUser } from '~/server/utils/direct-messages';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { validateChatReport } from '~/utils/chatReports.js';

export default defineEventHandler(async (event) => {
  const threadId = String(getRouterParam(event, 'id') || '').trim();
  const body = await readBody(event).catch(() => ({}));
  const { user } = await requireRequestUser(event);
  const input = validateChatReport(body);
  if (input.error) throw createError({ statusCode: 400, statusMessage: input.error });
  await getDirectThreadForUser(threadId, user.id);
  await enforceRateLimit(`direct-report:${user.id}`, 3, 3600);

  const supabase = useSupabaseAdmin();
  const { data: report, error } = await supabase.from('buyer_seller_reports')
    .insert({ thread_id: threadId, reported_by: user.id, reason: input.reason, category: input.category })
    .select('id, category, reason, status, created_at').single();
  if (error) throw createError({ statusCode: 500, statusMessage: 'The report could not be saved. Please try again.' });
  return { report };
});
