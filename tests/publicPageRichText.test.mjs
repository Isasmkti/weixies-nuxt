import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  parsePublicPageRichText,
  publicPageRichTextToPlainText,
} from '../utils/publicPageRichText.js'

test('public-page rich text supports the admin formatting controls', () => {
  const blocks = parsePublicPageRichText([
    '### Details',
    '',
    '**Bold**, *italic*, <u>underlined</u>, ~~removed~~ and `code`.',
    '',
    '- First item',
    '- [Safe link](https://example.com)',
    '',
    '> Important note',
  ].join('\n'))

  assert.deepEqual(blocks.map(block => block.type), ['heading', 'paragraph', 'unordered-list', 'quote'])
  assert.deepEqual(blocks[1].lines[0].filter(token => token.type !== 'text').map(token => token.type), [
    'bold', 'italic', 'underline', 'strike', 'code',
  ])
  assert.equal(blocks[2].items[1][0].href, 'https://example.com')
})

test('unsafe links remain text instead of becoming clickable content', () => {
  const blocks = parsePublicPageRichText('[Unsafe](javascript:alert(1))')
  assert.equal(blocks[0].lines[0].every(token => token.type === 'text'), true)
})

test('rich formatting is removed from SEO fallback text', () => {
  assert.equal(
    publicPageRichTextToPlainText('### Intro\n**Secure** <u>content</u> [Docs](https://example.com)'),
    'Intro Secure content Docs',
  )
})

test('admin editor and public renderer never inject stored HTML directly', () => {
  const editor = readFileSync(new URL('../components/admin/PublicPageRichTextEditor.vue', import.meta.url), 'utf8')
  const renderer = readFileSync(new URL('../components/content/PublicPageRichText.vue', import.meta.url), 'utf8')
  assert.match(editor, /aria-label="Bold"/)
  assert.match(editor, /aria-label="Italic"/)
  assert.match(editor, /aria-label="Underline"/)
  assert.match(editor, />Preview<\/button>/)
  assert.doesNotMatch(renderer, /v-html/)
})
