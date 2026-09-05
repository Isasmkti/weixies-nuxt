import { rGetBuyerRefunds, rGetSellerRefunds } from '../repositories/refundsRepository'

export async function getBuyerRefunds() {
  const response = await rGetBuyerRefunds()
  return Array.isArray(response?.refunds) ? response.refunds : []
}

export async function getSellerRefunds() {
  const response = await rGetSellerRefunds()
  return {
    seller: response?.seller || null,
    refunds: Array.isArray(response?.refunds) ? response.refunds : [],
  }
}
