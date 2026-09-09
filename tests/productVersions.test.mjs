import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { latestProductRelease, nextProductVersion, productVersionLabel } from '../utils/productVersions.js'

test('single-digit release numbers roll from 1.9 to 2.0 without floating point math', () => {
  assert.equal(productVersionLabel(10), '1.0')
  assert.equal(productVersionLabel(19), '1.9')
  assert.equal(productVersionLabel(20), '2.0')
  assert.equal(nextProductVersion([{ version_sequence: 19, release_status: 'published' }]), '2.0')
})

test('only approved releases can become the buyer-facing latest file', () => {
  const files = [
    { id: 'approved', version_sequence: 11, release_status: 'published' },
    { id: 'pending', created_at: '2026-09-09', release_status: 'pending_review' },
  ]
  assert.equal(latestProductRelease(files).id, 'approved')
  assert.equal(nextProductVersion(files), '1.2')
})

test('version migration pins sessions and uses a per-file allowance', () => {
  const migration = readFileSync(new URL('../supabase/migrations/0044_product_file_versions.sql', import.meta.url), 'utf8')
  for (const required of [
    'order_item_file_downloads',
    'product_file_id_at_purchase',
    'register_product_file_release',
    'moderate_product_release',
    'start_product_version_download',
    "release_status = 'published'",
  ]) assert.equal(migration.includes(required), true, required)
})
