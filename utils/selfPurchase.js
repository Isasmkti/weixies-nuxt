export const SELF_PURCHASE_ERROR = 'self_purchase_not_allowed'

export const SELF_PURCHASE_MESSAGES = Object.freeze({
  cart: 'You cannot add a product from your own store to the cart.',
  wishlist: 'You cannot add a product from your own store to the wishlist.',
  checkout: 'Checkout was cancelled because your cart contains a product from your own store.',
})

export function isOwnSellerProduct(productSellerId, ownSellerId) {
  if (productSellerId === null || productSellerId === undefined || !ownSellerId) return false
  return String(productSellerId) === String(ownSellerId)
}

export function findSelfPurchaseProductIds(items, ownSellerId) {
  if (!ownSellerId) return []

  return [...new Set((items || [])
    .filter((item) => isOwnSellerProduct(item?.product?.seller_id ?? item?.seller_id, ownSellerId))
    .map((item) => Number(item?.product_id ?? item?.product?.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0))]
}

export function selfPurchasePayload(context, productIds = []) {
  return {
    error: SELF_PURCHASE_ERROR,
    message: SELF_PURCHASE_MESSAGES[context] || SELF_PURCHASE_MESSAGES.checkout,
    conflicting_product_ids: [...new Set(productIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))],
  }
}
