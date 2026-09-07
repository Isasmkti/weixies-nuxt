import { rGetPurchases, rGetPurchaseOwnership } from '../repositories/purchasesRepository'

export async function getPurchases(profileId, { page = 1, pageSize = 12, search = '', productId = null } = {}) {
  const response = await rGetPurchases(profileId, {
    page,
    page_size: pageSize,
    search: search.trim(),
    ...(productId ? { product_id: productId } : {}),
  })
  return {
    items: Array.isArray(response?.purchases) ? response.purchases : [],
    total: Math.max(0, Number(response?.total) || 0),
    page: Number(response?.page) || 1,
    pageSize: Number(response?.page_size) || pageSize,
  }
}

export async function getPurchaseOwnership(profileId, ids) {
  const response = await rGetPurchaseOwnership(profileId, ids)
  return Array.isArray(response?.ownership) ? response.ownership : []
}
