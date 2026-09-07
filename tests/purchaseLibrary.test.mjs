import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { ref, computed } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { positivePurchaseId, purchaseResponse } from '../utils/purchaseResponse.js'

const purchase = (overrides = {}) => ({
  id: 'ownership-a', product_id: 7, order_id: 'order-a', created_at: '2026-09-07',
  profile_id: 'buyer-secret',
  product: {
    id: 7, name: 'Asset', slug: 'asset', status: 'published', file_url: 'secret-storage-path',
    product_images: [{ image_url: '/preview.webp', is_primary: true }],
    product_files: [{ file_name: 'asset.zip', file_url: '7/another-secret-path.zip', created_at: '2026-09-07' }],
    seller: { id: 'seller-a', store_name: 'Studio', store_slug: 'studio', bank_account_number: 'secret-bank-account' },
  },
  order: {
    status: 'paid', profile_id: 'buyer-secret', raw_response: { secret: 'provider-secret' },
    order_items: [{ id: 2, product_id: 7, download_count: 2, download_limit: 3, is_downloaded: true }],
  },
  ...overrides,
})

test('purchase projection excludes storage paths, account IDs and seller/provider secrets', () => {
  const result = purchaseResponse(purchase())
  const serialized = JSON.stringify(result)
  assert.equal(result.downloads_remaining, 1)
  assert.equal(result.can_download, true)
  for (const secret of ['file_url', 'profile_id', 'bank_account_number', 'raw_response', 'secret-storage-path', 'another-secret-path']) {
    assert.equal(serialized.includes(secret), false, secret)
  }
})

test('exhausted and historical over-limit purchases remain in the library without download access', () => {
  for (const count of [3, 8]) {
    const row = purchase()
    row.order.order_items[0].download_count = count
    const result = purchaseResponse(row)
    assert.equal(result.download_count, count)
    assert.equal(result.downloads_remaining, 0)
    assert.equal(result.can_download, false)
    assert.equal(result.product.name, 'Asset')
  }
})

test('unpublished ownership retains downloads while withholding its public product link', () => {
  const row = purchase()
  row.product.status = 'draft'
  const result = purchaseResponse(row)
  assert.equal(result.can_download, true)
  assert.equal(result.public_product_available, false)
  assert.equal(result.product.slug, null)
})

test('duplicate-payment conflicts never enable access to a library item', () => {
  const row = purchase()
  row.order.purchase_conflict = true
  const result = purchaseResponse(row)
  assert.equal(result.has_access, false)
  assert.equal(result.can_download, false)
})

test('ZIP availability uses the private stored path rather than the display filename', () => {
  const row = purchase()
  row.product.product_files[0].file_name = 'Asset collection'
  assert.equal(purchaseResponse(row).file_available, true)
  row.product.product_files[0].file_url = '8/other-buyers-product.zip'
  assert.equal(purchaseResponse(row).file_available, false)
})

test('missing file or mismatched canonical order item never enables a download', () => {
  const missingFile = purchase()
  missingFile.product.product_files = []
  assert.equal(purchaseResponse(missingFile).can_download, false)
  const wrongItem = purchase()
  wrongItem.order.order_items[0].product_id = 9
  assert.equal(purchaseResponse(wrongItem).can_download, false)
})

test('product ID validation handles bigint bounds without rounding', () => {
  assert.equal(positivePurchaseId('9223372036854775807'), '9223372036854775807')
  for (const invalid of ['9223372036854775808', '1.2', '1 or 1=1', '-1', '0', '']) assert.equal(positivePurchaseId(invalid), null)
})

const storeSource = readFileSync(new URL('../stores/purchasesStore.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace('export const usePurchasesStore', 'const usePurchasesStore')

function createStore(dependencies) {
  setActivePinia(createPinia())
  const useStore = vm.runInNewContext(`${storeSource}\nusePurchasesStore`, {
    ref, computed, defineStore, getUser: dependencies.getUser,
    getPurchases: dependencies.getPurchases || (async () => ({ items: [], total: 0, page: 1, pageSize: 12 })),
    getPurchaseOwnership: dependencies.getPurchaseOwnership || (async () => []),
  })
  return useStore()
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('concurrent library ownership checks coalesce overlapping products', async () => {
  const response = deferred()
  const started = deferred()
  let calls = 0
  const store = createStore({
    getUser: async () => ({ id: 'buyer-a' }),
    getPurchaseOwnership: async (_profile, ids) => { calls += 1; started.resolve(); await response.promise; return [{ product_id: ids[0], order_id: 'order-a' }] },
  })
  const first = store.loadOwnership([7])
  await started.promise
  const second = store.loadOwnership([7])
  response.resolve()
  await Promise.all([first, second])
  assert.equal(calls, 1)
  assert.equal(store.isPurchased(7), true)
})

test('old-account responses cannot repopulate ownership after sign-out and account switch', async () => {
  const response = deferred()
  const started = deferred()
  let currentUser = 'buyer-a'
  const store = createStore({
    getUser: async () => ({ id: currentUser }),
    getPurchaseOwnership: async profile => {
      if (profile === 'buyer-a') { started.resolve(); await response.promise; return [{ product_id: 7, order_id: 'order-a' }] }
      return []
    },
  })
  const previous = store.loadOwnership([7])
  await started.promise
  store.$reset()
  currentUser = 'buyer-b'
  await store.loadOwnership([7])
  response.resolve()
  await previous
  assert.equal(store.profileId, 'buyer-b')
  assert.equal(store.isPurchased(7), false)
})

test('latest search response wins over a slower previous purchase list request', async () => {
  const older = deferred()
  const started = deferred()
  const store = createStore({
    getUser: async () => ({ id: 'buyer-a' }),
    getPurchases: async (_profile, filters) => {
      if (filters.search === 'old') { started.resolve(); await older.promise }
      return { items: [{ product_id: filters.search === 'old' ? 1 : 2 }], total: 1, page: 1, pageSize: 12 }
    },
  })
  const oldRequest = store.fetchPurchases({ search: 'old' })
  await started.promise
  await store.fetchPurchases({ search: 'new' })
  older.resolve()
  await oldRequest
  assert.equal(store.items[0].product_id, 2)
  assert.equal(store.loading, false)
})
