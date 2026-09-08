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

test('home search opens the dedicated marketplace search route', () => {
  const home = readFileSync(new URL('../pages/index.vue', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../pages/search.vue', import.meta.url), 'utf8')

  assert.match(home, /router\.push\('\/search'\)/)
  assert.match(page, /Find products and sellers/)
  assert.match(page, /robots: 'noindex, follow'/)
})
