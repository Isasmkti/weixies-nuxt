import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pendingPage = readFileSync(new URL('../pages/seller/pending.vue', import.meta.url), 'utf8')
const applicationPage = readFileSync(new URL('../pages/become-seller.vue', import.meta.url), 'utf8')

test('rejected seller status header shows store identity and primary feedback', () => {
  assert.match(pendingPage, /seller\.store_image_url/)
  assert.match(pendingPage, /seller\.store_name/)
  assert.match(pendingPage, /seller\.store_slug/)
  assert.match(pendingPage, /Main rejection reason/)
  assert.match(pendingPage, /seller\.rejection_reason/)
  assert.match(pendingPage, /Update and resubmit/)
})

test('resubmission form repeats the rejection context before editable fields', () => {
  const headerEnd = applicationPage.indexOf('<form')
  const header = applicationPage.slice(0, headerEnd)
  assert.match(header, /displayedStoreImage/)
  assert.match(header, /Application rejected/)
  assert.match(header, /Main rejection reason/)
  assert.match(header, /rejectedSeller\.rejection_reason/)
})
