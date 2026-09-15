import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import test from 'node:test'

async function loadAuthService(supabase) {
  const context = createContext({ console, Promise })
  const module = new SourceTextModule(
    await readFile(new URL('../services/authService.js', import.meta.url), 'utf8'),
    { context },
  )
  await module.link(() => new SyntheticModule(['supabase'], function () {
    this.setExport('supabase', supabase)
  }, { context }))
  await module.evaluate()
  return module.namespace
}

test('logout clears the browser session without waiting for remote revocation', async () => {
  let removeCalls = 0
  let revokeCalls = 0
  const neverFinishes = new Promise(() => {})
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'access-token' } } }),
      _removeSession: async () => { removeCalls += 1 },
      admin: {
        signOut: () => {
          revokeCalls += 1
          return neverFinishes
        },
      },
    },
  }
  const { signOut } = await loadAuthService(supabase)

  await signOut()

  assert.equal(removeCalls, 1)
  assert.equal(revokeCalls, 1)
})

test('logout fallback uses local scope rather than signing out every device', async () => {
  let receivedOptions = null
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signOut: async (options) => {
        receivedOptions = options
        return { error: null }
      },
    },
  }
  const { signOut } = await loadAuthService(supabase)

  await signOut()

  assert.equal(receivedOptions.scope, 'local')
})
