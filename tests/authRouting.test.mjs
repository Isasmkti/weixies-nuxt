import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
const middleware = readFileSync(new URL('../middleware/auth.global.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../app.vue', import.meta.url), 'utf8')

const privateRoutes = [
  '/dashboard',
  '/cart',
  '/wishlist',
  '/purchases',
  '/orders',
  '/messages',
  '/refunds',
  '/become-seller',
  '/seller',
  '/admin',
]

test('all private account routes are guarded by the global auth middleware', () => {
  const prefixes = middleware.slice(
    middleware.indexOf('const AUTH_ROUTE_PREFIXES'),
    middleware.indexOf('const matchesPrefix'),
  )

  for (const route of privateRoutes) {
    assert.match(prefixes, new RegExp(`['\"]${route.replace('/', '\\/')}['\"]`), route)
  }
})

test('private routes are client-rendered while auth remains browser-session based', () => {
  for (const route of privateRoutes) {
    assert.match(config, new RegExp(`['\"]${route.replace('/', '\\/')}['\"]\\s*:\\s*\\{\\s*ssr:\\s*false`), route)
  }

  for (const nestedRoute of ['/purchases/**', '/orders/**', '/messages/**', '/refunds/**', '/seller/**', '/admin/**']) {
    assert.match(config, new RegExp(`['\"]${nestedRoute.replaceAll('/', '\\/').replaceAll('*', '\\*')}['\"]\\s*:\\s*\\{\\s*ssr:\\s*false`), nestedRoute)
  }
})

test('role redirects replace protected history entries', () => {
  assert.match(middleware, /navigateTo\(path, \{ replace: true \}\)/)
})

test('SSR public entry pages redirect only after their original markup hydrates', () => {
  assert.match(middleware, /nuxtApp\.isHydrating/)
  assert.match(middleware, /nuxtApp\.payload\.serverRendered/)
  assert.match(app, /redirectInitialPublicRoute/)
  assert.match(app, /router\.replace\('\/welcome'\)/)
  assert.match(app, /router\.replace\('\/'\)/)
})
