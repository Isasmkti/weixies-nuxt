import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('conversation occupies the mobile layout without being covered by bottom navigation', async () => {
  const layout = await read('layouts/default.vue')
  assert.match(layout, /h-\[100dvh\]/)
  assert.match(layout, /profile && !isConversationPage/)
  assert.match(layout, /'h-full min-h-0 p-0 md:p-8'/)
})

test('message list can shrink and composer respects mobile safe areas', async () => {
  const conversation = await read('pages/messages/[id].vue')
  assert.match(conversation, /min-h-0 flex-1 space-y-3 overflow-y-auto/)
  assert.match(conversation, /conversation-composer shrink-0/)
  assert.match(conversation, /env\(safe-area-inset-bottom\)/)
  assert.match(conversation, /@focus="handleComposerFocus"/)
})
