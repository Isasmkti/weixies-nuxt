import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const readProjectFile = (path) => readFileSync(join(projectRoot, path), 'utf8')

function sourceFiles(directory) {
  const absoluteDirectory = join(projectRoot, directory)
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(relativePath)
    return ['.js', '.ts', '.vue'].includes(extname(entry.name)) ? [relativePath] : []
  })
}

test('Supabase migrations are unique and sequential', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase/migrations'))
    .filter(name => /^\d{4}_.+\.sql$/.test(name))
    .sort()
  const versions = migrations.map(name => Number(name.slice(0, 4)))

  assert.equal(versions[0], 1)
  assert.equal(new Set(versions).size, versions.length)
  versions.forEach((version, index) => assert.equal(version, index + 1, `migration gap before ${migrations[index]}`))
})

test('browser RPC calls stay inside the authenticated security allowlist', () => {
  const browserDirectories = ['components', 'composables', 'pages', 'repositories', 'services', 'stores', 'utils']
  const rpcPattern = /\.rpc\(\s*['"]([^'"]+)['"]/g
  const browserRpcs = new Set()

  for (const file of browserDirectories.flatMap(sourceFiles)) {
    const source = readProjectFile(file)
    for (const match of source.matchAll(rpcPattern)) browserRpcs.add(match[1])
  }

  const reviewedRpcs = new Set([
    'get_admin_dashboard',
    'get_seller_payout_candidates',
    'moderate_product_release',
    'register_product_file_release',
    'submit_verified_review',
  ])

  assert.deepEqual([...browserRpcs].sort(), [...reviewedRpcs].sort())

  const hardeningMigration = readProjectFile('supabase/migrations/0047_security_advisor_hardening.sql')
  for (const rpcName of browserRpcs) {
    assert.match(
      hardeningMigration,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpcName}\\([\\s\\S]*?\\)\\s+TO[^;]*authenticated`),
      `${rpcName} must be explicitly granted to authenticated`,
    )
  }
})

test('scheduled deployment routes resolve to real protected handlers', () => {
  const deployment = JSON.parse(readProjectFile('vercel.json'))

  for (const cron of deployment.crons || []) {
    const route = cron.path.replace(/^\/api\//, '')
    const handler = readProjectFile(`server/api/${route}.get.ts`)
    assert.match(handler, /verifyXenditCallbackToken\(receivedSecret, cronSecret\)/)
    assert.match(handler, /Cache-Control', 'no-store'/)
  }
})

test('runtime configuration does not depend on the retired schema snapshot', () => {
  const runtimeFiles = [
    'package.json',
    'nuxt.config.ts',
    ...['server', 'repositories', 'services'].flatMap(sourceFiles),
  ]

  for (const file of runtimeFiles) {
    assert.doesNotMatch(readProjectFile(file), /current-sb-schema\.sql/, file)
  }
})
