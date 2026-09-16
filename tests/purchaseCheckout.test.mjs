import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const buyerId = '897040cc-6425-4b42-9397-05e8b876e1ff'
const orderId = '03c5d568-1efe-4b63-8fcf-22b5dbb7d312'
const licenseId = 'c64ddf28-eb5e-44ad-b466-868598535b3f'
const checkout = {
  order_id: orderId, order_number: 'ORD-TEST', total_amount: 10000,
  product_name: 'Test product', license_name: 'Personal', resumed: false,
  invoice_creation_token: 'claim', should_create_invoice: true,
}

// Bundle the real endpoint in memory; replace external IO, not checkout logic.
// No HTTP, Supabase, Xendit, filesystem writes, or Nuxt build is performed.
const modules = {
  '~/server/utils/supabase-admin': 'export const useSupabaseAdmin = () => globalThis.__checkoutTest.supabase;',
  '~/server/utils/request-auth': `export const requireRequestUser = async () => ({ user: { id: '${buyerId}', email: 'buyer@example.test', user_metadata: {} } });`,
  '~/server/utils/rate-limit': 'export const enforceRateLimit = async () => {};',
  '~/server/utils/payment-logger': 'export const logPaymentEvent = async value => globalThis.__checkoutTest.logs.push(value);',
  '~/server/utils/payment-integrity': 'export const assertXenditInvoiceBinding = async () => {};',
  '~/server/utils/xendit-payment-processor': 'export const processPendingOrder = (...args) => globalThis.__checkoutTest.reconcile(...args);',
  '~/server/utils/self-purchase': 'export const getCartProductIds = async () => []; export const findSelfPurchaseConflicts = async () => []; export const isSelfPurchaseDatabaseError = () => false; export const throwSelfPurchase = () => { throw Error("Unexpected self-purchase path"); };',
  '~/server/utils/xendit': `
    export class XenditApiError extends Error { get isDefinitiveClientError() { return true; } }
    export const createXenditInvoice = async (...args) => {
      globalThis.__checkoutTest.createCalls++;
      if (globalThis.__checkoutTest.rejectDefinitively) throw new XenditApiError('Rejected test invoice');
      return globalThis.__checkoutTest.createInvoice(...args);
    };
    export const getXenditInvoice = (...args) => globalThis.__checkoutTest.getInvoice(...args);
  `,
}
const compiled = await build({
  stdin: { contents: readFileSync(new URL('../server/api/checkout.post.ts', import.meta.url), 'utf8'), loader: 'ts', resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'mock-purchase-io', setup(builder) {
    builder.onResolve({ filter: /^~\// }, args => ({ path: args.path, namespace: 'purchase-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'purchase-test' }, args => {
      if (modules[args.path]) return { contents: modules[args.path], loader: 'js' }
      return { contents: readFileSync(fileURLToPath(new URL(`../${args.path.slice(2)}`, import.meta.url)) + (args.path.endsWith('.js') ? '' : '.ts'), 'utf8'), loader: args.path.endsWith('.js') ? 'js' : 'ts' }
    })
  } }],
})
globalThis.defineEventHandler = handler => handler
globalThis.createError = values => Object.assign(new Error(values.statusMessage), values)
globalThis.useRuntimeConfig = () => ({ xenditSecretKey: 'test-only', public: { siteUrl: 'https://shop.example.test' } })
globalThis.readBody = async () => ({ product_id: 12, product_license_id: licenseId })
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

function setup(rpcResults = [{ data: [checkout], error: null }]) {
  const runtime = {
    rpcCalls: 0, createCalls: 0, updates: [], upserts: [], logs: [], paymentRows: [],
    createInvoice: async () => ({ id: 'invoice-test', invoice_url: 'https://invoice.example.test/test', status: 'PENDING' }),
    getInvoice: async () => { throw Error('Unexpected provider lookup') },
    reconcile: async () => ({ success: false, error: 'Invoice creation is still unconfirmed.' }),
  }
  runtime.supabase = {
    rpc: async () => rpcResults[runtime.rpcCalls++] || { data: null, error: { message: 'Unexpected additional reservation' } },
    from(table) {
      const query = {
        eq() { return this }, select() { return this },
        order: async () => ({ data: runtime.paymentRows, error: null }),
        then(resolve) { return Promise.resolve({ error: null }).then(resolve) },
      }
      return {
        select: () => query,
        update: values => { runtime.updates.push({ table, values }); return query },
        upsert: async (values, options) => { runtime.upserts.push({ table, values, options }); return { error: null } },
      }
    },
  }
  globalThis.__checkoutTest = runtime
  return runtime
}

test('owned products return a purchase link and never contact create invoice', async () => {
  const runtime = setup([{ data: null, error: { message: 'product_already_purchased', details: JSON.stringify({ product_id: 12, order_id: orderId }) } }])
  await assert.rejects(handler({}), error => error.statusCode === 409 && error.data.code === 'product_already_purchased' && error.data.order_id === orderId)
  assert.equal(runtime.createCalls, 0)
})

test('another license with a live pending invoice cannot create a new payment', async () => {
  const runtime = setup([{ data: null, error: { message: 'product_payment_pending', details: JSON.stringify({ product_id: 12, order_id: orderId }) } }])
  runtime.reconcile = async () => ({ success: true, newStatus: 'pending' })
  await assert.rejects(handler({}), error => error.statusCode === 409 && error.data.code === 'product_payment_pending')
  assert.equal(runtime.createCalls, 0)
  assert.equal(runtime.rpcCalls, 1)
})

test('a lost response is recovered into the existing order instead of another invoice', async () => {
  const runtime = setup([{ data: [{ ...checkout, resumed: true, should_create_invoice: false }], error: null }])
  runtime.reconcile = async () => {
    runtime.paymentRows = [{ provider_invoice_id: 'recovered', status: 'pending', raw_response: { invoice_url: 'https://invoice.example.test/recovered' } }]
    return { success: true, newStatus: 'pending' }
  }
  const response = await handler({})
  assert.equal(response.order_id, orderId)
  assert.equal(response.payment_url, 'https://invoice.example.test/recovered')
  assert.equal(runtime.createCalls, 0)
})

test('unknown create response leaves the pending claim intact', async (t) => {
  t.mock.method(console, 'error', () => {})
  const runtime = setup()
  runtime.createInvoice = async () => { throw new Error('Simulated timeout after provider accepted request') }
  await assert.rejects(handler({}), error => error.statusCode === 409 && error.data.code === 'invoice_creation_pending')
  assert.equal(runtime.createCalls, 1)
  assert.equal(runtime.updates.length, 0)
})

test('definitive provider rejection closes only its pending claim', async (t) => {
  t.mock.method(console, 'error', () => {})
  const runtime = setup()
  runtime.rejectDefinitively = true
  await assert.rejects(handler({}), error => error.statusCode === 502)
  assert.equal(runtime.updates[0].values.status, 'failed')
  assert.equal(runtime.createCalls, 1)
})

test('confirmed expiry permits a fresh reservation for the requested license', async () => {
  const runtime = setup([
    { data: null, error: { message: 'product_payment_pending', details: JSON.stringify({ product_id: 12, order_id: orderId }) } },
    { data: [checkout], error: null },
  ])
  runtime.reconcile = async () => ({ success: true, newStatus: 'expired' })
  const response = await handler({})
  assert.equal(response.payment_url, 'https://invoice.example.test/test')
  assert.equal(runtime.rpcCalls, 2)
  assert.equal(runtime.createCalls, 1)
  assert.equal(runtime.upserts[0].options.ignoreDuplicates, true, 'late pending persistence must not overwrite an earlier paid webhook')
})
