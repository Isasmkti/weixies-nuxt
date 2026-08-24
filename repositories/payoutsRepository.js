import { supabase } from '../utils/supabase'

const PAYOUT_SELECT = `
  id,
  seller_id,
  amount,
  gross_amount,
  adjustment_amount,
  status,
  period_start,
  period_end,
  paid_at,
  reference_no,
  bank_name_snapshot,
  bank_account_snapshot,
  account_holder_name_snapshot,
  provider,
  provider_payout_id,
  provider_reference_id,
  provider_status,
  provider_failure_code,
  provider_submitted_at,
  provider_updated_at,
  provider_submission_attempts,
  reversed_at,
  created_at,
  seller:sellers(id, store_name, store_slug, bank_name, bank_account, payout_account_holder_name),
  seller_payout_items(id, order_item_id)
`

export async function rGetSellerPayouts(sellerId) {
  const { data, error } = await supabase
    .from('seller_payouts')
    .select(PAYOUT_SELECT)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function rGetAllPayouts() {
  const { data, error } = await supabase
    .from('seller_payouts')
    .select(PAYOUT_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function rGetPayoutCandidates(periodStart, periodEnd) {
  const { data, error } = await supabase.rpc('get_seller_payout_candidates', {
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })
  if (error) throw error
  return data || []
}

export async function rCreatePayoutBatch(sellerId, periodStart, periodEnd) {
  const { data, error } = await supabase.rpc('create_seller_payout_batch', {
    p_seller_id: sellerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function rSetPayoutStatus(payoutId, status, referenceNo = null) {
  const { data, error } = await supabase.rpc('set_seller_payout_status', {
    p_payout_id: payoutId,
    p_status: status,
    p_reference_no: referenceNo,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}
