import { rAllSellers, rUpdateSellerStatus } from '../repositories/sellersRepository'

const SELLER_STATUSES = new Set(['pending', 'approved', 'suspended', 'rejected'])

export async function sAllSellers() {
  return rAllSellers()
}

export async function sUpdateSellerStatus(sellerId, status) {
  if (!SELLER_STATUSES.has(status)) {
    throw new Error('Invalid seller status.')
  }

  return rUpdateSellerStatus(sellerId, status)
}
