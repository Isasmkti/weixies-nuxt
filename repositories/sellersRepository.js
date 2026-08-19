import { supabase } from '../utils/supabase'

export async function rAllSellers() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, store_name, store_slug, store_description, commission_rate, status, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function rUpdateSellerStatus(sellerId, status) {
  const { data, error } = await supabase
    .from('sellers')
    .update({ status })
    .eq('id', sellerId)
    .select('id, store_name, store_slug, store_description, commission_rate, status, created_at')
    .single()

  if (error) throw error
  return data
}
