import {
  rCreatePayoutBatch,
  rGetAllPayouts,
  rGetPayoutCandidates,
  rGetSellerPayouts,
  rSetPayoutStatus,
} from '../repositories/payoutsRepository'
import { supabase } from '../utils/supabase'

const PAYOUT_ACTIONS = new Set(['processing', 'paid', 'failed'])

function payoutPeriod(startDate, endDate) {
  if (!startDate || !endDate) throw new Error('Start and end dates are required.')
  const start = new Date(`${startDate}T00:00:00`)
  const endExclusive = new Date(`${endDate}T00:00:00`)
  endExclusive.setDate(endExclusive.getDate() + 1)
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime()) || start >= endExclusive) {
    throw new Error('A valid payout period is required.')
  }
  return { periodStart: start.toISOString(), periodEnd: endExclusive.toISOString() }
}

export const getSellerPayouts = (sellerId) => rGetSellerPayouts(sellerId)
export const getAllPayouts = () => rGetAllPayouts()

export async function getPayoutCandidates(startDate, endDate) {
  const { periodStart, periodEnd } = payoutPeriod(startDate, endDate)
  return rGetPayoutCandidates(periodStart, periodEnd)
}

export async function createPayoutBatch(sellerId, startDate, endDate) {
  const { periodStart, periodEnd } = payoutPeriod(startDate, endDate)
  return rCreatePayoutBatch(sellerId, periodStart, periodEnd)
}

export async function setPayoutStatus(payoutId, status, referenceNo = null) {
  if (!PAYOUT_ACTIONS.has(status)) throw new Error('Invalid payout status.')
  if (status === 'paid' && !String(referenceNo || '').trim()) throw new Error('A payment reference is required.')
  return rSetPayoutStatus(payoutId, status, String(referenceNo || '').trim() || null)
}

async function callPayoutApi(payoutId, action) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('You must be signed in as an administrator.')

  return $fetch(`/api/admin/payouts/${encodeURIComponent(payoutId)}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}

export const sendPayoutViaXendit = (payoutId) => callPayoutApi(payoutId, 'send')
export const syncXenditPayout = (payoutId) => callPayoutApi(payoutId, 'sync')
