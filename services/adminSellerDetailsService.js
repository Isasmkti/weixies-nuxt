import {
  rGetAdminSeller,
  rGetAdminSellerPayouts,
  rGetAdminSellerProducts,
} from '../repositories/adminSellerDetailsRepository'

export async function getAdminSellerDetails(sellerId) {
  const [seller, products, payouts] = await Promise.all([
    rGetAdminSeller(sellerId),
    rGetAdminSellerProducts(sellerId),
    rGetAdminSellerPayouts(sellerId),
  ])
  if (!seller) throw new Error('Seller was not found.')
  return { seller, products, payouts }
}
