import { supabase } from '../utils/supabase'

export async function rAllSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, payout_recipient_type, payout_account_holder_name, payout_given_name, payout_surname, payout_business_name, payout_routing_type, payout_routing_value, payout_address_line_1, payout_city, payout_province, payout_postal_code, commission_rate, status, rejection_reason, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function rUpdateSellerStatus(sellerId, status, rejectionReason = null) {
  const updatePayload = {
    status,
    rejection_reason: status === 'rejected' ? rejectionReason : null,
  }
  const { data, error } = await supabase
    .from('sellers')
    .update(updatePayload)
    .eq('id', sellerId)
    .select('id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, payout_recipient_type, payout_account_holder_name, payout_given_name, payout_surname, payout_business_name, payout_routing_type, payout_routing_value, payout_address_line_1, payout_city, payout_province, payout_postal_code, commission_rate, status, rejection_reason, created_at')
    .single()

  if (error) throw error
  return data
}

export async function rUpdateSellerCommission(sellerId, commissionRate) {
  const { data, error } = await supabase
    .from('sellers')
    .update({ commission_rate: commissionRate })
    .eq('id', sellerId)
    .select('id, commission_rate')
    .single()

  if (error) throw error
  return data
}
