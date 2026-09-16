import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Vercel reconciles pending payments before the automatic payout run', () => {
  const deployment = JSON.parse(readProjectFile('vercel.json'))
  const reconciliation = deployment.crons.find(entry => entry.path === '/api/cron/payment-reconciliation')
  const payout = deployment.crons.find(entry => entry.path === '/api/cron/automated-payouts')

  assert.deepEqual(reconciliation, {
    path: '/api/cron/payment-reconciliation',
    schedule: '0 0 * * *',
  })
  assert.equal(payout?.schedule, '0 2 * * *')
})

test('payment reconciliation cron requires the shared secret and checks stale pending orders', () => {
  const endpoint = readProjectFile('server/api/cron/payment-reconciliation.get.ts')

  assert.match(endpoint, /verifyXenditCallbackToken\(receivedSecret, cronSecret\)/)
  assert.match(endpoint, /processPendingOrders\(secretKey/)
  assert.match(endpoint, /maxOrders: 100/)
  assert.match(endpoint, /olderThanMinutes: 15/)
  assert.match(endpoint, /Cache-Control', 'no-store'/)
})

test('all invoice persistence paths reject cross-order provider bindings', () => {
  const integrity = readProjectFile('server/utils/payment-integrity.ts')
  const checkout = readProjectFile('server/api/checkout.post.ts')
  const webhook = readProjectFile('server/api/webhook/xendit.post.ts')
  const processor = readProjectFile('server/utils/xendit-payment-processor.ts')

  assert.match(integrity, /existingPayment\.order_id/)
  assert.match(integrity, /already attached to another order/)
  assert.match(checkout, /assertXenditInvoiceBinding\(supabase, invoice\.id, orderId\)/)
  assert.match(webhook, /assertXenditInvoiceBinding\(supabase, invoice\.id, order\.id\)/)
  assert.match(processor, /assertXenditInvoiceBinding\(supabase, invoice\.id, order\.id\)/)
})
