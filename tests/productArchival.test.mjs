import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('product removal archives the product instead of hard deleting it', () => {
  const repository = readProjectFile('repositories/productsRepository.js')
  const service = readProjectFile('services/productsService.js')
  const store = readProjectFile('stores/productsStore.js')

  assert.match(repository, /export async function rArchive\(id\)/)
  assert.match(repository, /\.update\(\{ status: 'suspended' \}\)/)
  assert.doesNotMatch(repository, /export async function rDelete\(id\)/)
  assert.match(service, /export async function sArchive\(id\)/)
  assert.match(store, /async archiveProduct\(id\)/)
})

test('database policies deny hard deletion to marketplace clients', () => {
  const migration = readProjectFile('supabase/migrations/0043_safe_product_archival.sql')

  assert.match(migration, /DROP POLICY IF EXISTS "Platform admins can manage all products"/)
  assert.match(migration, /FOR SELECT/)
  assert.match(migration, /FOR INSERT/)
  assert.match(migration, /FOR UPDATE/)
  assert.doesNotMatch(migration, /FOR DELETE/)
  assert.doesNotMatch(migration, /FOR ALL/)
})

test('admin removal copy describes archival and preserved transaction history', () => {
  const page = readProjectFile('pages/admin/products/index.vue')

  assert.match(page, /Archive product\?/)
  assert.match(page, /history remains available/)
  assert.doesNotMatch(page, /permanently deleted/)
})
