import { selfPurchasePayload } from '~/utils/selfPurchase.js';

export async function getOwnSellerId(supabase: any, profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sellers')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}

export async function findSelfPurchaseConflicts(
  supabase: any,
  profileId: string,
  productIds: Array<number | string>,
): Promise<number[]> {
  const normalizedIds = [...new Set(productIds
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!normalizedIds.length) return [];

  const ownSellerId = await getOwnSellerId(supabase, profileId);
  if (!ownSellerId) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id')
    .in('id', normalizedIds)
    .eq('seller_id', ownSellerId);

  if (error) throw error;
  return [...new Set((data || []).map((product: any) => Number(product.id)))];
}

export async function getCartProductIds(supabase: any, profileId: string): Promise<number[]> {
  const { data: cart, error: cartError } = await supabase
    .from('cart')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (cartError) throw cartError;
  if (!cart?.id) return [];

  const { data: items, error: itemsError } = await supabase
    .from('cart_items')
    .select('product_id')
    .eq('cart_id', cart.id);

  if (itemsError) throw itemsError;
  return (items || []).map((item: any) => Number(item.product_id));
}

export function throwSelfPurchase(context: 'cart' | 'wishlist' | 'checkout', productIds: number[]): never {
  const payload = selfPurchasePayload(context, productIds);
  throw createError({
    statusCode: 403,
    statusMessage: payload.message,
    data: payload,
  });
}

export function isSelfPurchaseDatabaseError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42501' && message.includes('self_purchase_not_allowed');
}
