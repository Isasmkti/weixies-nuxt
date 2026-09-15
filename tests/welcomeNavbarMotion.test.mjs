import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navbar = readFileSync(new URL('../components/Navbar.vue', import.meta.url), 'utf8')

test('welcome navbar keeps its original motion timing without discontinuous geometry', () => {
  assert.match(navbar, /transition-duration:\s*1000ms/)
  assert.match(navbar, /transition-timing-function:\s*ease-in-out/)
  assert.doesNotMatch(navbar, /transition-all/)
  assert.doesNotMatch(navbar, /max-w-6xl/)
  assert.doesNotMatch(navbar, /-translate-x-1\/2/)
  assert.match(navbar, /left:\s*max\(2\.5%,\s*calc\(50% - 36rem\)\)/)
  assert.match(navbar, /right:\s*max\(2\.5%,\s*calc\(50% - 36rem\)\)/)
})

test('welcome navbar batches scroll updates and prevents threshold flicker', () => {
  assert.match(navbar, /NAVBAR_COLLAPSE_AT = 100/)
  assert.match(navbar, /NAVBAR_EXPAND_AT = 72/)
  assert.match(navbar, /window\.requestAnimationFrame/)
  assert.match(navbar, /\{ passive: true \}/)
  assert.match(navbar, /window\.cancelAnimationFrame/)
})
