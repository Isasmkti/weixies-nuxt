import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export interface OrderDeliveryResult {
  productIds: string[];
  grantedCount: number;
  cartItemsRemoved: number;
}

export async function grantDigitalAccessForOrder(orderId: string, profileId: string): Promise<OrderDeliveryResult> {
  const supabase = useSupabaseAdmin();

  const { data: orderItems, error: orderItemsError } = await supabase
    .from('order_items')
    .select('product_id')
    .eq('order_id', orderId);

  if (orderItemsError) {
    throw orderItemsError;
  }

  const productIds = (orderItems || []).map((item) => item.product_id).filter(Boolean);

  if (productIds.length === 0) {
    return { productIds: [], grantedCount: 0, cartItemsRemoved: 0 };
  }

  const { error: ownershipError } = await supabase.from('user_products').upsert(
    productIds.map((productId) => ({
      profile_id: profileId,
      product_id: productId,
      order_id: orderId,
      created_at: new Date().toISOString(),
    })),
    { onConflict: 'profile_id,product_id' },
  );

  if (ownershipError) {
    throw ownershipError;
  }

  const { data: cart, error: cartError } = await supabase
    .from('cart')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (cartError) {
    throw cartError;
  }

  let cartItemsRemoved = 0;
  if (cart) {
    const { data: deletedItems, error: cartDeleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .in('product_id', productIds)
      .select('id');

    if (cartDeleteError) {
      throw cartDeleteError;
    }

    cartItemsRemoved = deletedItems?.length || 0;
  }

  return {
    productIds,
    grantedCount: productIds.length,
    cartItemsRemoved,
  };
}

