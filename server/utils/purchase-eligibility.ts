import { purchaseConflictPayload, purchaseDatabaseConflict } from '~/utils/purchaseEligibility.js';

export function throwPurchaseConflict(payload: any): never {
  throw createError({ statusCode: 409, statusMessage: payload.message, data: payload });
}

export async function requireUnpurchasedProduct(supabase: any, profileId: string, productId: number) {
  const { data: orderId, error } = await supabase.rpc('get_purchase_order_id', {
    p_profile_id: profileId,
    p_product_id: productId,
  });
  if (error) throw error;
  if (orderId) throwPurchaseConflict(purchaseConflictPayload('product_already_purchased', productId, orderId));
}

export function throwPurchaseDatabaseConflict(error: any, productId: number) {
  const payload = purchaseDatabaseConflict(error, productId);
  if (payload) throwPurchaseConflict(payload);
}
