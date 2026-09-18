import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = readProjectFile('supabase/migrations/0050_refund_payout_and_financial_metrics.sql')

test('refund review reconciles every payout stage instead of rejecting settled orders', () => {
  assert.doesNotMatch(migration, /Seller payout processing has already started for this order/)
  assert.match(migration, /payout\.status = 'pending'/)
  assert.match(migration, /'CANCELLED_BEFORE_SUBMISSION'/)
  assert.match(migration, /payout_status IN \('pending', 'held', 'released'\)/)
  assert.match(migration, /payout\.status = 'paid'[\s\S]*THEN 'released'/)
})

test('active refund requests independently exclude sales from both payout queries', () => {
  const exclusions = migration.match(/refund_request\.status <> 'cancelled'/g) || []
  assert.equal(exclusions.length, 2)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_seller_payout_batch\([\s\S]*?TO service_role/)
})

test('dashboard separates gross volume, refunds, net volume, and retained revenue', () => {
  for (const metric of [
    'gross_gmv',
    'refund_amount',
    'net_gmv',
    'gross_platform_revenue',
    'net_platform_revenue',
    'net_seller_earnings',
  ]) {
    assert.match(migration, new RegExp(`'${metric}'`))
  }

  assert.match(
    migration,
    /WHEN order_item\.seller_id IS NULL THEN order_item\.price[\s\S]*ELSE order_item\.commission_amount/,
  )
})
