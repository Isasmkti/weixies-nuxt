<script setup>
import { computed, nextTick, ref } from 'vue'
import PublicPageRichText from '../content/PublicPageRichText.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  maxlength: { type: Number, default: 20000 },
  placeholder: { type: String, default: 'Write the approved content here...' },
})
const emit = defineEmits(['update:modelValue'])

const editor = ref(null)
const mode = ref('write')
const linkOpen = ref(false)
const linkLabel = ref('')
const linkUrl = ref('https://')
const linkError = ref('')
const linkSelection = ref({ start: 0, end: 0 })
const contentValue = computed(() => String(props.modelValue ?? ''))
const characterCount = computed(() => contentValue.value.length)

function commit(value, selectionStart, selectionEnd = selectionStart) {
  emit('update:modelValue', value.slice(0, props.maxlength))
  nextTick(() => {
    editor.value?.focus()
    editor.value?.setSelectionRange(selectionStart, selectionEnd)
  })
}

function wrapSelection(before, after, placeholder) {
  if (props.disabled || !editor.value) return
  const start = editor.value.selectionStart
  const end = editor.value.selectionEnd
  const selected = contentValue.value.slice(start, end) || placeholder
  const replacement = `${before}${selected}${after}`
  commit(
    `${contentValue.value.slice(0, start)}${replacement}${contentValue.value.slice(end)}`,
    start + before.length,
    start + before.length + selected.length,
  )
}

function formatLines(kind) {
  if (props.disabled || !editor.value) return
  const value = contentValue.value
  const start = editor.value.selectionStart
  const end = editor.value.selectionEnd
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const formatted = lines.map((line, index) => {
    if (kind === 'ordered') return `${index + 1}. ${line.replace(/^\d+[.)]\s+/, '')}`
    const prefix = kind === 'heading' ? '### ' : kind === 'quote' ? '> ' : '- '
    const removable = kind === 'heading' ? /^#{2,4}\s+/ : kind === 'quote' ? /^>\s?/ : /^[-*]\s+/
    return `${prefix}${line.replace(removable, '')}`
  }).join('\n')
  commit(`${value.slice(0, lineStart)}${formatted}${value.slice(lineEnd)}`, lineStart, lineStart + formatted.length)
}

function insertDivider() {
  if (props.disabled || !editor.value) return
  const start = editor.value.selectionStart
  const insertion = `${start > 0 ? '\n\n' : ''}---\n\n`
  commit(`${contentValue.value.slice(0, start)}${insertion}${contentValue.value.slice(start)}`, start + insertion.length)
}

function openLinkEditor() {
  if (props.disabled || !editor.value) return
  const start = editor.value.selectionStart
  const end = editor.value.selectionEnd
  const selected = contentValue.value.slice(start, end)
  linkSelection.value = { start, end }
  linkLabel.value = selected || 'Link text'
  linkUrl.value = 'https://'
  linkError.value = ''
  linkOpen.value = true
}

function insertLink() {
  const label = linkLabel.value.trim() || 'Link'
  let url = linkUrl.value.trim()
  if (!/^(https?:\/\/|mailto:)/i.test(url)) url = `https://${url}`
  const isMail = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(url)
  let isWebUrl = false
  try {
    const parsed = new URL(url)
    isWebUrl = ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname)
  } catch {
    isWebUrl = false
  }
  if (!isMail && !isWebUrl) {
    linkError.value = 'Enter a valid http(s) URL or mailto address.'
    return
  }
  const { start, end } = linkSelection.value
  const replacement = `[${label}](${url})`
  commit(
    `${contentValue.value.slice(0, start)}${replacement}${contentValue.value.slice(end)}`,
    start,
    start + replacement.length,
  )
  linkOpen.value = false
}

function handleShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  const formats = {
    b: ['**', '**', 'bold text'],
    i: ['*', '*', 'italic text'],
    u: ['<u>', '</u>', 'underlined text'],
  }
  if (!formats[key]) return
  event.preventDefault()
  wrapSelection(...formats[key])
}
</script>

<template>
  <div class="overflow-hidden rounded-ui-md border border-border bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
    <div class="flex flex-col gap-2 border-b border-border bg-bg-alt/60 p-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Text formatting">
        <button type="button" class="editor-tool" title="Heading" aria-label="Heading" :disabled="disabled" @click="formatLines('heading')">H3</button>
        <span class="mx-1 h-6 w-px bg-border" />
        <button type="button" class="editor-tool font-black" title="Bold (Ctrl+B)" aria-label="Bold" :disabled="disabled" @click="wrapSelection('**', '**', 'bold text')">B</button>
        <button type="button" class="editor-tool italic" title="Italic (Ctrl+I)" aria-label="Italic" :disabled="disabled" @click="wrapSelection('*', '*', 'italic text')">I</button>
        <button type="button" class="editor-tool underline" title="Underline (Ctrl+U)" aria-label="Underline" :disabled="disabled" @click="wrapSelection('<u>', '</u>', 'underlined text')">U</button>
        <button type="button" class="editor-tool line-through" title="Strikethrough" aria-label="Strikethrough" :disabled="disabled" @click="wrapSelection('~~', '~~', 'struck text')">S</button>
        <button type="button" class="editor-tool font-mono" title="Inline code" aria-label="Inline code" :disabled="disabled" @click="wrapSelection('`', '`', 'code')">&lt;/&gt;</button>
        <span class="mx-1 h-6 w-px bg-border" />
        <button type="button" class="editor-tool" title="Bulleted list" aria-label="Bulleted list" :disabled="disabled" @click="formatLines('bullet')">• List</button>
        <button type="button" class="editor-tool" title="Numbered list" aria-label="Numbered list" :disabled="disabled" @click="formatLines('ordered')">1. List</button>
        <button type="button" class="editor-tool" title="Quote" aria-label="Quote" :disabled="disabled" @click="formatLines('quote')">“ Quote</button>
        <button type="button" class="editor-tool" title="Link" aria-label="Link" :disabled="disabled" @click="openLinkEditor">↗ Link</button>
        <button type="button" class="editor-tool" title="Divider" aria-label="Divider" :disabled="disabled" @click="insertDivider">—</button>
      </div>
      <div class="grid grid-cols-2 rounded-ui-sm bg-bg p-1 text-xs font-bold">
        <button type="button" :class="['rounded px-3 py-1.5 transition', mode === 'write' ? 'bg-surface text-primary shadow-sm' : 'text-text-muted']" @click="mode = 'write'">Write</button>
        <button type="button" :class="['rounded px-3 py-1.5 transition', mode === 'preview' ? 'bg-surface text-primary shadow-sm' : 'text-text-muted']" @click="mode = 'preview'">Preview</button>
      </div>
    </div>

    <div v-if="linkOpen" class="grid gap-2 border-b border-border bg-primary/5 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto]">
      <input v-model="linkLabel" maxlength="160" placeholder="Link text" class="min-h-10 rounded-ui-sm border border-border bg-surface px-3 text-sm text-text-main outline-none focus:border-primary">
      <input v-model="linkUrl" type="url" placeholder="https://example.com" class="min-h-10 rounded-ui-sm border border-border bg-surface px-3 text-sm text-text-main outline-none focus:border-primary" @keyup.enter="insertLink">
      <button type="button" class="min-h-10 rounded-ui-sm bg-primary px-4 text-xs font-bold text-white" @click="insertLink">Insert</button>
      <button type="button" class="min-h-10 rounded-ui-sm px-3 text-xs font-bold text-text-muted" @click="linkOpen = false">Cancel</button>
      <p v-if="linkError" class="text-xs font-semibold text-danger sm:col-span-4">{{ linkError }}</p>
    </div>

    <textarea
      v-if="mode === 'write'"
      ref="editor"
      :value="contentValue"
      :disabled="disabled"
      :maxlength="maxlength"
      :placeholder="placeholder"
      rows="10"
      class="block min-h-56 w-full resize-y bg-surface px-4 py-4 font-montserrat text-sm leading-7 text-text-main outline-none placeholder:text-text-muted/70 disabled:opacity-60"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown="handleShortcut"
    />
    <div v-else class="min-h-56 bg-surface px-4 py-4 font-montserrat text-sm leading-7 text-text-muted">
      <PublicPageRichText v-if="contentValue.trim()" :content="contentValue" />
      <p v-else class="text-text-muted/70">Nothing to preview yet.</p>
    </div>

    <div class="flex items-center justify-between border-t border-border bg-bg-alt/40 px-3 py-2 text-[11px] text-text-muted">
      <span>Formatting is stored safely as text.</span>
      <span :class="characterCount > maxlength * 0.9 ? 'font-bold text-warning' : ''">{{ characterCount.toLocaleString() }}/{{ maxlength.toLocaleString() }}</span>
    </div>
  </div>
</template>

<style scoped>
.editor-tool {
  min-height: 2.25rem;
  border-radius: var(--radius-xs);
  padding: 0.35rem 0.6rem;
  color: rgb(var(--color-text-muted));
  font-size: 0.75rem;
  transition: background-color 150ms ease, color 150ms ease;
}

.editor-tool:hover:not(:disabled),
.editor-tool:focus-visible {
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  outline: none;
}

.editor-tool:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
