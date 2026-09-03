import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { getDirectThreadForUser } from '~/server/utils/direct-messages';

export default defineEventHandler(async (event) => {
  const threadId = String(getRouterParam(event, 'id') || '').trim();
  const body = await readBody(event).catch(() => ({}));
  const content = String(body?.content || '').trim();
  const { supabase, user } = await requireRequestUser(event);

  if (!content || content.length > 5000) throw createError({ statusCode: 400, statusMessage: 'Message must contain 1 to 5000 characters.' });
  const thread = await getDirectThreadForUser(threadId, user.id);
  if (thread.status !== 'open') throw createError({ statusCode: 409, statusMessage: 'This conversation is closed.' });

  await enforceRateLimit(`direct-message:${user.id}`, 10, 60);

  const { data, error } = await supabase
    .from('buyer_seller_messages')
    .insert({ thread_id: threadId, sender_profile_id: user.id, content })
    .select('id, thread_id, sender_profile_id, content, attachment_url, is_read, read_at, created_at')
    .single();
  if (error) throw createError({ statusCode: error.code === 'P0001' ? 429 : 403, statusMessage: error.message });
  return { message: data };
});

