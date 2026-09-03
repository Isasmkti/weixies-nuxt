import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { requireRequestUser } from '~/server/utils/request-auth';
import { findSelfPurchaseConflicts, isSelfPurchaseDatabaseError, throwSelfPurchase } from '~/server/utils/self-purchase';

export default defineEventHandler(async (event) => {
  const { user } = await requireRequestUser(event);
  const body = await readBody(event).catch(() => ({}));
  const productId = Number(body?.product_id);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A valid product_id is required.' });
  }

  const supabase = useSupabaseAdmin();
  const conflicts = await findSelfPurchaseConflicts(supabase, user.id, [productId]);
  if (conflicts.length) throwSelfPurchase('wishlist', conflicts);

  const { data: existingRows, error: lookupError } = await supabase
    .from('wishlists')
    .select('id')
    .eq('profile_id', user.id)
    .eq('product_id', productId)
    .limit(1);
  if (lookupError) throw lookupError;
  const existing = existingRows?.[0];
  if (existing) return { item: existing, created: false };

  const { data: item, error: insertError } = await supabase
    .from('wishlists')
    .insert({ profile_id: user.id, product_id: productId })
    .select('id, profile_id, product_id')
    .single();

  if (insertError) {
    if (isSelfPurchaseDatabaseError(insertError)) throwSelfPurchase('wishlist', [productId]);
    throw insertError;
  }

  setResponseStatus(event, 201);
  return { item, created: true };
});
