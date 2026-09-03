import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { getDirectThreadForUser } from '~/server/utils/direct-messages';

export default defineEventHandler(async (event) => {
  const threadId = String(getRouterParam(event, 'id') || '').trim();
  const { user } = await requireRequestUser(event);
  const thread = await getDirectThreadForUser(threadId, user.id);
  const supabase = useSupabaseAdmin();
  const { data: messages, error } = await supabase
    .from('buyer_seller_messages')
    .select('id, thread_id, sender_profile_id, content, attachment_url, is_read, read_at, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;

  return { thread, messages: messages || [], profile_id: user.id };
});

