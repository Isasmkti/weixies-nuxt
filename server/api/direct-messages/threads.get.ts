import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { DIRECT_THREAD_SELECT } from '~/server/utils/direct-messages';

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const supabase = useSupabaseAdmin();
  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  let query = supabase.from('buyer_seller_threads').select(DIRECT_THREAD_SELECT);
  query = seller?.id
    ? query.or(`buyer_id.eq.${user.id},seller_id.eq.${seller.id}`)
    : query.eq('buyer_id', user.id);

  const { data, error } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return { threads: data || [], profile_id: user.id };
});

