import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  escapePostgresLikePattern,
  mergeUniqueSearchRows,
  normalizeMarketplaceSearchQuery,
} from '../utils/marketplaceSearch.js'

test('marketplace search query is normalized and bounded', () => {
  assert.equal(normalizeMarketplaceSearchQuery('  icon   pack  '), 'icon pack')
  assert.equal(normalizeMarketplaceSearchQuery([' Seller Shop ', 'ignored']), 'Seller Shop')
  assert.equal(normalizeMarketplaceSearchQuery('x'.repeat(120)).length, 80)
})

test('LIKE wildcards are escaped and duplicate result rows are removed', () => {
  assert.equal(escapePostgresLikePattern('50%_off\\sale'), '50\\%\\_off\\\\sale')
  assert.deepEqual(mergeUniqueSearchRows([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map(row => row.id), [1, 2, 3])
})

test('home and legacy search both open the unified product catalog', () => {
  const home = readFileSync(new URL('../pages/index.vue', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../pages/search.vue', import.meta.url), 'utf8')
  const catalog = readFileSync(new URL('../pages/products/index.vue', import.meta.url), 'utf8')

  assert.match(home, /path: '\/products', query: \{ focus: 'search' \}/)
  assert.match(page, /path: '\/products'/)
  assert.match(page, /normalizeMarketplaceSearchQuery\(route\.query\.q\)/)
  assert.match(catalog, /Stores related to/)
  assert.match(catalog, /searchMarketplaceSellers/)
})

test('catalog store lookup uses the approved seller view without duplicating product search', () => {
  const repository = readFileSync(new URL('../repositories/marketplaceSearchRepository.js', import.meta.url), 'utf8')
  const service = readFileSync(new URL('../services/marketplaceSearchService.js', import.meta.url), 'utf8')

  assert.match(repository, /export async function rSearchApprovedSellers/)
  assert.match(repository, /from\('approved_seller_stores'\)/)
  assert.match(service, /export async function searchMarketplaceSellers/)

  const sellerLookup = repository.slice(repository.indexOf('export async function rSearchApprovedSellers'))
  assert.doesNotMatch(sellerLookup, /productQuery\(/)
})
