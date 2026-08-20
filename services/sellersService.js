import { rAllSellers, rUpdateSellerCommission, rUpdateSellerStatus } from '../repositories/sellersRepository'

const SELLER_STATUSES = new Set(['pending', 'approved', 'suspended', 'rejected'])

export async function sAllSellers() {
  return rAllSellers()
}

export async function sUpdateSellerStatus(sellerId, status, rejectionReason = null) {
  if (!SELLER_STATUSES.has(status)) {
    throw new Error('Invalid seller status.')
  }

  const normalizedReason = String(rejectionReason || '').trim()
  if (status === 'rejected' && !normalizedReason) {
    throw new Error('A rejection reason is required.')
  }

  return rUpdateSellerStatus(sellerId, status, normalizedReason || null)
}

export async function sUpdateSellerCommission(sellerId, commissionPercent) {
  const percent = Number(commissionPercent)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Commission must be between 0 and 100 percent.')
  }
  return rUpdateSellerCommission(sellerId, percent / 100)
}
