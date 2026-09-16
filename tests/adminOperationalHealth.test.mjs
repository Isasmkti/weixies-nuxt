import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('operational health endpoint is admin-only and never cacheable', () => {
  const endpoint = readProjectFile('server/api/admin/operations/health.get.ts')
  const repository = readProjectFile('repositories/adminOperationsRepository.js')

  assert.match(endpoint, /await requirePlatformAdmin\(event\)/)
  assert.match(endpoint, /Cache-Control', 'no-store'/)
  assert.match(endpoint, /useSupabaseAdmin\(\)/)
  assert.match(repository, /supabase\.auth\.getSession\(\)/)
  assert.match(repository, /Authorization: `Bearer \$\{session\.access_token\}`/)
})

test('operational health covers stale payments, refund action, and payout exceptions', () => {
  const endpoint = readProjectFile('server/api/admin/operations/health.get.ts')

  assert.match(endpoint, /\.from\('orders'\)[\s\S]*\.eq\('status', 'pending'\)/)
  assert.match(endpoint, /\.from\('payment_logs'\)[\s\S]*\.eq\('event_type', 'error'\)/)
  assert.match(endpoint, /\.from\('order_refund_requests'\)[\s\S]*'manual_action_required'/)
  assert.match(endpoint, /\.from\('seller_payouts'\)[\s\S]*'reversed'/)
  assert.match(endpoint, /stalledPayouts/)
  assert.match(endpoint, /\.from\('system_job_runs'\)/)
  assert.match(endpoint, /automationAttention/)
})

test('admin dashboard loads analytics and operations independently', () => {
  const dashboard = readProjectFile('pages/admin/index.vue')

  assert.match(dashboard, /Promise\.allSettled/)
  assert.match(dashboard, /getAdminOperationsHealth/)
  assert.match(dashboard, /Operational health/)
  assert.match(dashboard, /Refund attention/)
  assert.match(dashboard, /Payout attention/)
  assert.match(dashboard, /Automation jobs/)
})
