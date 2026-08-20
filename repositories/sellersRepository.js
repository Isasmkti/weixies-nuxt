import { supabase } from '../utils/supabase'

export async function rAllSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, commission_rate, status, rejection_reason, created_at')
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
    .select('id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, commission_rate, status, rejection_reason, created_at')
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
