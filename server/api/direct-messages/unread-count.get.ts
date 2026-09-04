import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const supabase = useSupabaseAdmin();

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (sellerError) {
    throw createError({ statusCode: 500, statusMessage: 'Seller identity could not be checked.' });
  }

  let query = supabase
    .from('buyer_seller_threads')
    .select('buyer_id, seller_id, buyer_unread_count, seller_unread_count');

  query = seller?.id
    ? query.or(`buyer_id.eq.${user.id},seller_id.eq.${seller.id}`)
    : query.eq('buyer_id', user.id);

  const { data: threads, error } = await query;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Unread messages could not be loaded.' });
  }

  const unreadCount = (threads || []).reduce((total, thread) => {
    const count = thread.buyer_id === user.id
      ? thread.buyer_unread_count
      : thread.seller_unread_count;
    return total + Math.max(0, Number(count) || 0);
  }, 0);

  return { unread_count: unreadCount };
});
