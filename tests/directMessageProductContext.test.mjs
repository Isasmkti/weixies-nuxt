import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('conversation details include product image, categories, and ratings', () => {
  const utility = readProjectFile('server/utils/direct-messages.ts')
  const detailEndpoint = readProjectFile('server/api/direct-messages/[id].get.ts')

  assert.match(utility, /DIRECT_THREAD_DETAIL_SELECT/)
  assert.match(utility, /product_images\(id, image_url, is_primary\)/)
  assert.match(utility, /product_categories\(categories\(id, name, slug\)\)/)
  assert.match(utility, /reviews\(rating\)/)
  assert.match(detailEndpoint, /includeProductDetails: true/)
})

test('conversation list keeps the lightweight product projection', () => {
  const utility = readProjectFile('server/utils/direct-messages.ts')
  const listEndpoint = readProjectFile('server/api/direct-messages/threads.get.ts')
  const listProjection = utility.slice(
    utility.indexOf('export const DIRECT_THREAD_LIST_SELECT'),
    utility.indexOf('export const DIRECT_THREAD_DETAIL_SELECT'),
  )

  assert.match(listEndpoint, /DIRECT_THREAD_LIST_SELECT/)
  assert.match(listProjection, /product:products[^\n]*\(id, name, slug\)/)
  assert.doesNotMatch(listProjection, /reviews\(rating\)/)
})

test('conversation page renders the product context bar below its header', () => {
  const page = readProjectFile('pages/messages/[id].vue')
  const headerEnd = page.indexOf('</header>')
  const productBar = page.indexOf('aria-label="Conversation product"')

  assert.ok(headerEnd >= 0 && productBar > headerEnd)
  assert.match(page, /productCategoryLabel/)
  assert.match(page, /productAverageRating/)
  assert.match(page, /productPrimaryImage/)
})
