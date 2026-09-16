import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public pages migration creates admin-managed pages without seeded content', async () => {
  const sql = await read('supabase/migrations/0045_public_pages.sql')
  assert.match(sql, /CREATE TABLE public\.public_pages/)
  assert.match(sql, /status = 'published'/)
  assert.match(sql, /is_seller_platform_admin\(\)/)
  assert.doesNotMatch(sql, /INSERT INTO public\.public_pages/)
})

test('content-field migration adds typed contact facts without seeding legal copy', async () => {
  const sql = await read('supabase/migrations/0046_public_page_content_fields.sql')
  assert.match(sql, /ADD COLUMN page_type text/)
  assert.match(sql, /ADD COLUMN contact_details jsonb/)
  assert.match(sql, /public_pages_legal_effective_date_check/)
  assert.doesNotMatch(sql, /INSERT INTO public\.public_pages/)
})

test('public renderer exposes only published records', async () => {
  const endpoint = await read('server/api/public-pages.get.ts')
  const page = await read('pages/[...content].vue')
  const layout = await read('layouts/public.vue')
  assert.match(endpoint, /\.eq\('status', 'published'\)/)
  assert.match(page, /layout: 'public'/)
  assert.match(page, /whitespace-pre-line/)
  assert.match(page, /Contact information/)
  assert.match(page, /Back to Welcome/)
  assert.match(page, /Mobile page sections/)
  assert.match(page, /Browse Catalog/)
  assert.match(layout, /to="\/welcome"/)
  assert.match(layout, /id="public-page-content"/)
  assert.doesNotMatch(page, /v-html/)
})

test('admin editor offers page-specific guides and structured contact fields', async () => {
  const editor = await read('pages/admin/public-pages.vue')
  const templates = await read('utils/publicPageTemplates.js')
  assert.match(editor, /Load section guide/)
  assert.match(editor, /CONTACT_DETAIL_TYPES/)
  assert.match(templates, /legal_privacy/)
  assert.match(templates, /legal_refund/)
  assert.match(templates, /legal_license/)
  assert.match(templates, /What to include|Data we collect/)
})

test('admin public-page mutations require platform admin access', async () => {
  for (const file of [
    'server/api/admin/public-pages/index.get.ts',
    'server/api/admin/public-pages/index.post.ts',
    'server/api/admin/public-pages/[id].put.ts',
    'server/api/admin/public-pages/[id].delete.ts',
  ]) {
    assert.match(await read(file), /requirePlatformAdmin\(event\)/)
  }
})

test('footer hides placeholder and unpublished managed links', async () => {
  const footer = await read('components/Footer.vue')
  assert.match(footer, /url === '#'/)
  assert.match(footer, /publishedPaths\.value\.has\(url\)/)
})
