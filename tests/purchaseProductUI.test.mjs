import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import test from 'node:test'
import { ref, computed, watch } from 'vue'

async function productUI({ purchased = false, user = { id: 'buyer' }, fail = false, licenses = [{ id: 'license', is_active: true, price: 1000 }] } = {}) {
  const calls = { cart: 0, ownership: 0, navigation: [], alerts: [] }
  const context = createContext({ console })
  const dependencies = {
    vue: { ref, computed, watch, onMounted: () => {} },
    'vue-router': { useRouter: () => ({ push: async path => calls.navigation.push(path) }), useRoute: () => ({ params: { slug: 'asset' } }) },
    '../stores/productsStore': { useProductsStore: () => ({ products: [], _mapProduct: product => product }) },
    '../stores/cartStore': { useCartStore: () => ({ stAddToCart: async () => { calls.cart += 1; if (fail) throw new Error('Already purchased on another tab') } }) },
    '../stores/purchasesStore': { usePurchasesStore: () => ({ isPurchased: () => purchased, loadOwnership: async () => { calls.ownership += 1 } }) },
    '../services/authService': { getUser: async () => user },
    '../utils/currency': { formatIDR: value => String(value) },
    '../utils/sweetAlert': { showErrorDialog: async (...args) => calls.alerts.push(args) },
  }
  const module = new SourceTextModule(await readFile(new URL('../composables/useProductDetailUI.js', import.meta.url), 'utf8'), { context })
  await module.link(specifier => {
    const exports = dependencies[specifier]
    assert.ok(exports, `Unexpected dependency ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  const ui = module.namespace.useProductDetailUI('asset', { id: 7, slug: 'asset', product_licenses: licenses })
  return { ui, calls }
}

test('product detail exposes explicit success only after the cart request succeeds', async () => {
  const { ui, calls } = await productUI()
  assert.equal(await ui.addToCart(), true)
  assert.equal(calls.cart, 1)
  assert.equal(ui.addingToCart.value, null)
})

test('failed add cannot be treated as buy-now success and refreshes purchase state', async () => {
  const { ui, calls } = await productUI({ fail: true })
  assert.equal(await ui.addToCart(), false)
  assert.equal(calls.cart, 1)
  assert.equal(calls.ownership, 1)
  assert.equal(calls.alerts.length, 1)
  assert.equal(calls.navigation.length, 0)
  assert.equal(ui.addingToCart.value, null)
})

test('an already purchased product links to My Purchases without creating a cart item', async () => {
  const { ui, calls } = await productUI({ purchased: true })
  assert.equal(await ui.addToCart(), false)
  assert.equal(calls.cart, 0)
  assert.deepEqual(calls.navigation, ['/purchases?product=7'])
})

test('guest add requests sign-in without reporting a successful add', async () => {
  const { ui, calls } = await productUI({ user: null })
  assert.equal(await ui.addToCart(), false)
  assert.equal(calls.cart, 0)
  assert.deepEqual(calls.navigation, ['/login'])
})

test('a missing active license reports a UI error and cannot navigate to checkout', async () => {
  const { ui, calls } = await productUI({ licenses: [] })
  assert.equal(await ui.addToCart(), false)
  assert.equal(calls.cart, 0)
  assert.equal(calls.alerts.length, 1)
})
