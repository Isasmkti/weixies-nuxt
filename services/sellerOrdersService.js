import { rGetSellerOrderItems } from '../repositories/sellerOrdersRepository'

export async function getSellerOrderItems(sellerId) {
  if (!sellerId) throw new Error('Seller is required.')
  return rGetSellerOrderItems(sellerId)
}
