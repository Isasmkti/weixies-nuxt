import { supabase } from '../utils/supabase'

const SELLER_SALE_SELECT = `
  id,
  price,
  seller_earning,
  commission_amount,
  payout_status,
  products(
    id,
    name,
    slug,
    product_images(image_url, is_primary)
  ),
  orders!inner(
    id,
    order_number,
    status,
    created_at
  )
`

export async function rGetSellerDashboardProducts(sellerId) {
  const { data, error } = await supabase
    .from('products')
    .select('id, status, created_at')
    .eq('seller_id', sellerId)

  if (error) throw error
  return data || []
}

export async function rGetSellerPaidSales(sellerId) {
  const { data, error } = await supabase
    .from('order_items')
    .select(SELLER_SALE_SELECT)
    .eq('seller_id', sellerId)
    .eq('orders.status', 'paid')

  if (error) throw error
  return data || []
}

