import { supabase } from '../utils/supabase'

export async function rGetAdminSeller(sellerId) {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, commission_rate, status, rejection_reason, created_at')
    .eq('id', sellerId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function rGetAdminSellerProducts(sellerId) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, price, status, created_at, product_images(image_url, is_primary)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function rGetAdminSellerPayouts(sellerId) {
  const { data, error } = await supabase
    .from('seller_payouts')
    .select('id, amount, status, period_start, period_end, paid_at, reference_no, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
