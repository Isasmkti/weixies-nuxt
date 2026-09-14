import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../pages/purchases/index.vue', import.meta.url), 'utf8')

test('purchase library uses a compact responsive list', () => {
  assert.match(page, /aria-label="Purchased products"/)
  assert.match(page, /class="mt-5 space-y-3"/)
  assert.match(page, /sm:grid-cols-\[10rem_minmax\(0,1fr\)\]/)
  assert.match(page, /relative aspect-video/)
  assert.doesNotMatch(page, /aspect-\[4\/3\]/)
})

test('purchase download and version behavior stays connected', () => {
  assert.match(page, /downloadPurchase\(\{ orderId: purchase\.order_id, productId: purchase\.product_id \}\)/)
  assert.match(page, /purchases\.applyDownload/)
  assert.match(page, /purchase\.downloads_remaining/)
  assert.match(page, /purchase\.update_available/)
  assert.match(page, /purchase\.latest_version/)
})

test('license, order and product destinations remain available', () => {
  assert.match(page, /purchase\.license\.usage_terms/)
  assert.match(page, /`\/orders\/\$\{purchase\.order_id\}`/)
  assert.match(page, /`\/products\/\$\{purchase\.product\.slug\}`/)
})
