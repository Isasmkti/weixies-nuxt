const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function purchaseConflictPayload(code, productId, orderId) {
  if (!['product_already_purchased', 'product_payment_pending', 'invoice_creation_pending'].includes(code)) return null
  const id = Number(productId)
  const validProductId = Number.isSafeInteger(id) && id > 0 ? id : null
  const validOrderId = UUID.test(String(orderId || '')) ? String(orderId) : null
  const messages = {
    product_already_purchased: 'You already own this product. Open My Purchases to access it.',
    product_payment_pending: 'A payment for this product is already pending. Resume the existing order before choosing another license.',
    invoice_creation_pending: 'Your payment link is still being verified. Check the existing order shortly; do not create another payment.',
  }
  return {
    code,
    error: code,
    message: messages[code],
    product_id: validProductId,
    order_id: validOrderId,
    purchase_url: validProductId ? `/purchases?product=${validProductId}` : '/purchases',
    order_url: validOrderId ? `/orders/${validOrderId}` : '/orders',
  }
}

export function purchaseDatabaseConflict(error, fallbackProductId) {
  const message = String(error?.message || '')
  const code = ['product_already_purchased', 'product_payment_pending'].find(value => message === value || message.startsWith(`${value}:`))
  if (!code) return null
  let detail = {}
  try { detail = JSON.parse(error?.details || '{}') } catch { /* Do not expose unstructured database details. */ }
  return purchaseConflictPayload(code, detail?.product_id ?? fallbackProductId, detail?.order_id)
}
