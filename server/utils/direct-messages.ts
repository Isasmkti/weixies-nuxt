import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export const DIRECT_THREAD_SELECT = `
  id,
  buyer_id,
  seller_id,
  product_id,
  order_id,
  status,
  last_message_at,
  buyer_unread_count,
  seller_unread_count,
  created_at,
  updated_at,
  buyer:profiles!buyer_seller_threads_buyer_id_fkey(id, full_name, profile_img),
  seller:sellers!buyer_seller_threads_seller_id_fkey(id, profile_id, store_name, store_slug, store_image_url),
  product:products!buyer_seller_threads_product_id_fkey(id, name, slug)
`;

export async function getDirectThreadForUser(threadId: string, profileId: string) {
  const supabase = useSupabaseAdmin();
  const { data: thread, error } = await supabase
    .from('buyer_seller_threads')
    .select(DIRECT_THREAD_SELECT)
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw error;
  const sellerProfileId = (thread as any)?.seller?.profile_id;
  if (!thread || (thread.buyer_id !== profileId && sellerProfileId !== profileId)) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found.' });
  }
  return thread as any;
}

