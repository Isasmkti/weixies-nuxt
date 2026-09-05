import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import test from 'node:test'
import { ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'

async function loadModule(path, dependencies, globals = {}) {
  const context = createContext({ console, ...globals })
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context })
  await module.link(specifier => {
    const exports = dependencies[specifier]
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('profile callers share one request and a late response cannot restore a logged-out profile', async () => {
  const states = new Map()
  const response = deferred()
  let calls = 0
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'buyer-a' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => { calls++; return response.promise } }) }) }),
  }
  const { useAuth } = await loadModule('../composables/useAuth.js', { '../utils/supabase': { supabase } }, {
    useState: (key, init) => {
      if (!states.has(key)) states.set(key, ref(init()))
      return states.get(key)
    },
  })
  const first = useAuth()
  const second = useAuth()
  const pending = [first.fetchProfile(), second.fetchProfile()]
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 1)
  first.resetProfile()
  response.resolve({ data: { id: 'buyer-a', full_name: 'Buyer A' }, error: null })
  await Promise.all(pending)
  assert.equal(first.profile.value, null)
  await first.fetchProfile()
  await second.fetchProfile()
  assert.equal(calls, 2, 'the successful profile is reused on subsequent mounts')
})

test('categories coalesce concurrent requests, cache the result and allow a forced refresh', async () => {
  setActivePinia(createPinia())
  const response = deferred()
  let calls = 0
  const { useCategoriesStore } = await loadModule('../stores/categoriesStore.js', {
    pinia: { defineStore },
    '../services/categoriesService': { sAll: () => { calls++; return response.promise } },
  })
  const store = useCategoriesStore()
  const pending = [store.fetchCategories(), store.fetchCategories()]
  assert.equal(calls, 1)
  response.resolve([{ id: 1, name: 'Design' }])
  await Promise.all(pending)
  await store.fetchCategories()
  assert.equal(calls, 1)
  await store.fetchCategories({ force: true })
  assert.equal(calls, 2)
  assert.equal(store.loading, false)
})

for (const kind of ['cart', 'wishlist']) {
  test(`${kind} reads coalesce and do not repopulate state after logout reset`, async () => {
    setActivePinia(createPinia())
    const response = deferred()
    let calls = 0
    const isCart = kind === 'cart'
    const action = isCart ? 'stGetCart' : 'stGetWishlists'
    const service = isCart ? 'sGetCart' : 'sGetWishlists'
    const namespace = await loadModule(`../stores/${kind}Store.js`, {
      pinia: { defineStore },
      [`../services/${kind}Service`]: { [service]: () => { calls++; return response.promise } },
    })
    const store = namespace[isCart ? 'useCartStore' : 'useWishlistStore']()
    const pending = [store[action]('buyer-a'), store[action]('buyer-a')]
    assert.equal(calls, 1)
    store.$reset()
    response.resolve(isCart ? { cart: { id: 1 }, items: [{ id: 1 }] } : [{ id: 1 }])
    await Promise.all(pending)
    assert.equal(store.items.length, 0)
    assert.equal(store.loading, false)
  })
}
