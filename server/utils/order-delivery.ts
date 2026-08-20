import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export interface OrderDeliveryResult {
  productIds: string[];
  grantedCount: number;
  cartItemsRemoved: number;
}

export async function grantDigitalAccessForOrder(
  orderId: string,
  profileId: string,
  paidAt = new Date().toISOString(),
): Promise<OrderDeliveryResult> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc('finalize_paid_order', {
    p_order_id: orderId,
    p_profile_id: profileId,
    p_paid_at: paidAt,
  });

  if (error) throw error;

  return {
    productIds: Array.isArray(data?.productIds) ? data.productIds.map(String) : [],
    grantedCount: Number(data?.grantedCount) || 0,
    cartItemsRemoved: Number(data?.cartItemsRemoved) || 0,
  };
}

