import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = readProjectFile('supabase/migrations/0048_system_job_runs.sql')

test('scheduled jobs use a durable service-only execution lease', () => {
  assert.match(migration, /CREATE TABLE public\.system_job_runs/)
  assert.match(migration, /CREATE UNIQUE INDEX system_job_runs_one_running_job_uidx/)
  assert.match(migration, /WHERE status = 'running'/)
  assert.match(migration, /COALESCE\(auth\.role\(\), ''\) <> 'service_role'/)
  assert.match(migration, /REVOKE ALL ON public\.system_job_runs FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /Execution lease expired before the job completed/)
})

test('both production cron endpoints acquire and complete their job run', () => {
  const paymentCron = readProjectFile('server/api/cron/payment-reconciliation.get.ts')
  const payoutCron = readProjectFile('server/api/cron/automated-payouts.get.ts')

  assert.match(paymentCron, /beginSystemJob\('payment_reconciliation'/)
  assert.match(paymentCron, /completeSystemJob\(runId/)
  assert.match(paymentCron, /reason: 'already_running'/)
  assert.match(payoutCron, /beginSystemJob\('seller_payouts'/)
  assert.match(payoutCron, /completeSystemJob\(runId/)
  assert.match(payoutCron, /reason: 'already_running'/)
})
