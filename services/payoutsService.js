import {
  rCreatePayoutBatch,
  rGetAllPayouts,
  rGetPayoutCandidates,
  rGetSellerPayouts,
  rSetPayoutStatus,
} from '../repositories/payoutsRepository'

const PAYOUT_ACTIONS = new Set(['processing', 'paid', 'failed'])

function payoutPeriod(startDate, endDate) {
  if (!startDate || !endDate) throw new Error('Start and end dates are required.')
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  end.setHours(23, 59, 59, 999)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('A valid payout period is required.')
  }
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() }
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
