import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dashboard = await readFile(new URL('../pages/dashboard.vue', import.meta.url), 'utf8')

test('dashboard uses the compact Account Center hierarchy', () => {
  assert.match(dashboard, /Compact account header/)
  assert.match(dashboard, />Quick Actions</)
  assert.match(dashboard, />Account Settings</)
  assert.match(dashboard, />Appearance</)
  assert.match(dashboard, /min-h-24/)
  assert.doesNotMatch(dashboard, /System preferences/)
})

test('all existing account navigation remains available', () => {
  for (const route of ['/purchases', '/wishlist', '/orders', '/messages', '/refunds']) {
    assert.match(dashboard, new RegExp(`to="${route}"`))
  }
  assert.match(dashboard, /to="\/become-seller"/)
})

test('profile state, upload, save and seller states remain wired', () => {
  assert.match(dashboard, /uploadProfileImage\(selectedFile\.value\)/)
  assert.match(dashboard, /updateProfile\(/)
  assert.match(dashboard, /@click="handleUpdate"/)
  assert.match(dashboard, /v-if="showSellerCenter"/)
  assert.match(dashboard, /sellerApplication\.value/)
  assert.match(dashboard, /accountEmail/)
})

test('unimplemented settings are not advertised as working tabs', () => {
  assert.doesNotMatch(dashboard, />Security</)
  assert.doesNotMatch(dashboard, />Notifications</)
})
