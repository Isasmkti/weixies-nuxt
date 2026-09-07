import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

test('changed Vue, JavaScript and TypeScript files parse without a Nuxt build', () => {
  const tracked = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split(/\r?\n/)
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split(/\r?\n/)
  for (const file of new Set([...tracked, ...added].filter(name => /\.(vue|ts|js)$/.test(name)))) {
    const source = readFileSync(file, 'utf8')
    if (file.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: file })
      assert.deepEqual(errors, [], file)
      if (descriptor.script || descriptor.scriptSetup) compileScript(descriptor, { id: file })
      if (descriptor.template) {
        const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file })
        assert.deepEqual(result.errors, [], file)
      }
    } else {
      assert.doesNotThrow(() => transformSync(source, { loader: file.endsWith('.ts') ? 'ts' : 'js', target: 'esnext', format: 'esm' }), file)
    }
  }
})
