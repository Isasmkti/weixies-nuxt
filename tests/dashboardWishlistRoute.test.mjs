import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('user dashboard exposes the authenticated wishlist shortcut', async () => {
  const dashboard = await readFile(new URL('../pages/dashboard.vue', import.meta.url), 'utf8')
  assert.match(dashboard, /<NuxtLink to="\/wishlist"/)
  assert.match(dashboard, />Wishlist</)
  assert.match(dashboard, /xl:grid-cols-5/)
})
