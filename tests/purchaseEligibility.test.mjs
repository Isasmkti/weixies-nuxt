import assert from 'node:assert/strict'
import test from 'node:test'
import { purchaseConflictPayload, purchaseDatabaseConflict } from '../utils/purchaseEligibility.js'

const orderId = '03c5d568-1efe-4b63-8fcf-22b5dbb7d312'

test('paid-product conflict returns the original purchase without mixing seller self-purchase IDs', () => {
  const payload = purchaseDatabaseConflict({ message: 'product_already_purchased', details: JSON.stringify({ product_id: 12, order_id: orderId }) }, 8)
  assert.equal(payload.code, 'product_already_purchased')
  assert.equal(payload.product_id, 12)
  assert.equal(payload.order_id, orderId)
  assert.equal(payload.purchase_url, '/purchases?product=12')
  assert.equal(payload.order_url, `/orders/${orderId}`)
  assert.equal(payload.conflicting_product_ids, undefined)
})

test('a different tier of a pending product points to the existing invoice order', () => {
  const payload = purchaseDatabaseConflict({ message: 'product_payment_pending', details: JSON.stringify({ product_id: 5, order_id: orderId }) })
  assert.equal(payload.code, 'product_payment_pending')
  assert.equal(payload.order_url, `/orders/${orderId}`)
  assert.match(payload.message, /another license/)
})

test('uncertain invoice creation remains pending with a recovery link', () => {
  const payload = purchaseConflictPayload('invoice_creation_pending', 5, orderId)
  assert.equal(payload.error, 'invoice_creation_pending')
  assert.equal(payload.order_url, `/orders/${orderId}`)
  assert.match(payload.message, /do not create another payment/)
})

test('malformed database details cannot leak internals or manufacture navigation URLs', () => {
  const payload = purchaseDatabaseConflict({ message: 'product_already_purchased', details: 'private internal SQL text' }, 7)
  assert.equal(payload.product_id, 7)
  assert.equal(payload.order_url, '/orders')
  assert.doesNotMatch(JSON.stringify(payload), /private internal/)
  assert.equal(purchaseConflictPayload('product_already_purchased', 'invalid', 'https://example.com').order_id, null)
})

test('non-purchase and unknown errors remain available to their original handlers', () => {
  assert.equal(purchaseDatabaseConflict({ message: 'self_purchase_not_allowed' }, 5), null)
  assert.equal(purchaseConflictPayload('unknown', 5, orderId), null)
})
