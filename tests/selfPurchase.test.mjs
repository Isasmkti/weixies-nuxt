import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SELF_PURCHASE_ERROR,
  SELF_PURCHASE_MESSAGES,
  findSelfPurchaseProductIds,
  isOwnSellerProduct,
  selfPurchasePayload,
} from '../utils/selfPurchase.js'

test('a seller product is identified without relying on object identity', () => {
  assert.equal(isOwnSellerProduct('seller-a', 'seller-a'), true)
  assert.equal(isOwnSellerProduct('seller-b', 'seller-a'), false)
  assert.equal(isOwnSellerProduct(null, 'seller-a'), false)
})

test('an old cart item is revalidated after its buyer becomes the seller', () => {
  const items = [{ product_id: 7, product: { seller_id: 'new-seller-id' } }]
  assert.deepEqual(findSelfPurchaseProductIds(items, 'new-seller-id'), [7])
})

test('mixed checkout is rejected with every conflicting product id and no duplicates', () => {
  const items = [
    { product_id: 7, product: { seller_id: 'own-store' } },
    { product_id: 8, product: { seller_id: 'another-store' } },
    { product_id: 7, product: { seller_id: 'own-store' } },
  ]
  const conflicts = findSelfPurchaseProductIds(items, 'own-store')
  const payload = selfPurchasePayload('checkout', conflicts)

  assert.deepEqual(conflicts, [7])
  assert.equal(payload.error, SELF_PURCHASE_ERROR)
  assert.equal(payload.message, SELF_PURCHASE_MESSAGES.checkout)
  assert.deepEqual(payload.conflicting_product_ids, [7])
})

test('cart and wishlist API payloads expose clear context-specific messages', () => {
  assert.equal(selfPurchasePayload('cart', [10]).message, SELF_PURCHASE_MESSAGES.cart)
  assert.equal(selfPurchasePayload('wishlist', [10]).message, SELF_PURCHASE_MESSAGES.wishlist)
})
