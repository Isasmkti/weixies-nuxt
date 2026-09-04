import {
  rGetAllPayouts,
  rGetPayoutCandidates,
  rGetSellerPayouts,
} from '../repositories/payoutsRepository'

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
