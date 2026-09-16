import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { validateChatReport, validateReportReview } from '../utils/chatReports.js'

test('report validation rejects malformed categories and bounded reasons', () => {
  assert.ok(validateChatReport({ category: 'fraud', reason: {} }).error)
  assert.ok(validateChatReport({ category: 'invalid', reason: 'A detailed concern' }).error)
  assert.ok(validateChatReport({ category: 'spam', reason: 'a'.repeat(2001) }).error)
  assert.deepEqual(validateChatReport({ category: 'spam', reason: '  Repeated promotional messages  ', status: 'reviewed' }), { category: 'spam', reason: 'Repeated promotional messages' })
  assert.ok(validateReportReview({ status: 'open', resolution_note: 'A valid explanation' }).error)
  assert.ok(validateReportReview({ status: 'reviewed', resolution_note: 'short' }).error)
})

async function handler(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '')
  const compiled = transformSync(source, { loader: 'ts', format: 'cjs' }).code
  const module = { exports: {} }
  const environment = {
    defineEventHandler: fn => fn,
    createError: value => Object.assign(new Error(value.statusMessage), value),
    getRouterParam: () => 'report-or-thread-id',
    readBody: async () => ({}),
    setResponseHeader: () => {},
    validateChatReport,
    validateReportReview,
    ...dependencies,
  }
  new Function('module', ...Object.keys(environment), compiled)(module, ...Object.values(environment))
  return module.exports.default
}

test('non-participants cannot submit reports through the privileged database client', async () => {
  let accessedDatabase = false
  const run = await handler('server/api/direct-messages/[id]/reports.post.ts', {
    requireRequestUser: async () => ({ user: { id: 'outsider' } }),
    readBody: async () => ({ category: 'fraud', reason: 'Suspicious payment request' }),
    getDirectThreadForUser: async () => { throw Object.assign(new Error('Not found'), { statusCode: 404 }) },
    enforceRateLimit: async () => {},
    useSupabaseAdmin: () => { accessedDatabase = true },
  })
  await assert.rejects(run({}), { statusCode: 404 })
  assert.equal(accessedDatabase, false)
})

test('admin decisions are conditional on open status and cannot overwrite another review', async () => {
  const filters = []
  let written
  const query = {
    update(value) { written = value; return this },
    eq(...args) { filters.push(args); return this },
    select() { return this },
    async maybeSingle() { return { data: null, error: null } },
  }
  const run = await handler('server/api/admin/chat-reports/[id].patch.ts', {
    requirePlatformAdmin: async () => ({ user: { id: 'verified-admin' } }),
    readBody: async () => ({ status: 'reviewed', resolution_note: 'We reviewed the conversation.', reviewed_by: 'forged-admin' }),
    useSupabaseAdmin: () => ({ from: () => query }),
  })
  await assert.rejects(run({}), { statusCode: 409 })
  assert.equal(written.reviewed_by, 'verified-admin')
  assert.ok(filters.some(([key, value]) => key === 'status' && value === 'open'))
})

test('non-admins cannot read reported conversation evidence', async () => {
  let accessedDatabase = false
  const run = await handler('server/api/admin/chat-reports/[id].get.ts', {
    requirePlatformAdmin: async () => { throw Object.assign(new Error('Forbidden'), { statusCode: 403 }) },
    useSupabaseAdmin: () => { accessedDatabase = true },
  })
  await assert.rejects(run({}), { statusCode: 403 })
  assert.equal(accessedDatabase, false)
})
