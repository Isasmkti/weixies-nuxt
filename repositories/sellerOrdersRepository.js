import { supabase } from '../utils/supabase'

export async function rGetSellerOrderItems(sellerId) {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      price,
      commission_rate_snapshot,
      commission_amount,
      seller_earning,
      payout_status,
      products(id, name, slug, product_images(image_url, is_primary)),
      orders!inner(id, order_number, status, created_at, paid_at)
    `)
    .eq('seller_id', sellerId)
    .order('id', { ascending: false })

  if (error) throw error
  return data || []
}
