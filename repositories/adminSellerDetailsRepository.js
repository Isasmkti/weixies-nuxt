import { supabase } from '../utils/supabase'

export async function rGetAdminSeller(sellerId) {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, payout_recipient_type, payout_account_holder_name, payout_given_name, payout_surname, payout_business_name, payout_routing_type, payout_routing_value, payout_address_line_1, payout_city, payout_province, payout_postal_code, commission_rate, status, rejection_reason, created_at')
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
    .select('id, amount, status, period_start, period_end, paid_at, reference_no, provider, provider_payout_id, provider_status, provider_failure_code, reversed_at, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
