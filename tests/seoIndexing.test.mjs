import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('public homepage is indexable and included as the primary sitemap URL', () => {
  const app = readFileSync(new URL('../app.vue', import.meta.url), 'utf8')
  const sitemap = readFileSync(new URL('../server/routes/sitemap.xml.ts', import.meta.url), 'utf8')
  assert.match(app, /route\.path === '\/'/)
  assert.match(sitemap, /\{ path: '\/', priority: '1\.0'/)
})

test('account, checkout, seller and admin routes remain outside the public index allowlist', () => {
  const app = readFileSync(new URL('../app.vue', import.meta.url), 'utf8')
  const allowlist = app.slice(app.indexOf('const indexableRoute'), app.indexOf('useHead'))
  for (const privateRoute of ['/login', '/signup', '/dashboard', '/cart', '/orders', '/purchases', '/refunds', '/messages', '/seller', '/admin']) {
    assert.equal(allowlist.includes(`route.path === '${privateRoute}'`), false, privateRoute)
    assert.equal(allowlist.includes(`route.path.startsWith('${privateRoute}/')`), false, privateRoute)
  }
})
