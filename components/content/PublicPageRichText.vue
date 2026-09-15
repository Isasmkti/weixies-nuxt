<script setup>
import { Fragment, computed, defineComponent, h } from 'vue'
import { parsePublicPageRichText } from '../../utils/publicPageRichText'

const props = defineProps({
  content: { type: String, default: '' },
})

const blocks = computed(() => parsePublicPageRichText(props.content))

const InlineContent = defineComponent({
  name: 'PublicPageInlineContent',
  props: {
    tokens: { type: Array, default: () => [] },
  },
  setup(inlineProps) {
    const renderTokens = tokens => tokens.map((token, index) => {
      const key = `${token.type}-${index}`
      if (token.type === 'text') return token.text
      if (token.type === 'code') return h('code', { key, class: 'rounded bg-bg-alt px-1.5 py-0.5 font-mono text-[0.9em] text-text-main' }, token.text)

      const children = renderTokens(token.children || [])
      if (token.type === 'bold') return h('strong', { key, class: 'font-bold text-text-main' }, children)
      if (token.type === 'italic') return h('em', { key }, children)
      if (token.type === 'underline') return h('u', { key, class: 'decoration-primary/60 decoration-2 underline-offset-2' }, children)
      if (token.type === 'strike') return h('s', { key }, children)
      if (token.type === 'link') {
        const external = token.href?.startsWith('http')
        return h('a', {
          key,
          href: token.href,
          target: external ? '_blank' : undefined,
          rel: external ? 'noopener noreferrer' : undefined,
          class: 'font-semibold text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-primary',
        }, children)
      }
      return h(Fragment, { key }, children)
    })

    return () => h(Fragment, null, renderTokens(inlineProps.tokens))
  },
})
</script>

<template>
  <div class="public-page-rich-text space-y-4">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <h3 v-if="block.type === 'heading' && block.level === 2" class="text-xl font-extrabold text-text-main">
        <InlineContent :tokens="block.content" />
      </h3>
      <h4 v-else-if="block.type === 'heading' && block.level === 3" class="text-lg font-bold text-text-main">
        <InlineContent :tokens="block.content" />
      </h4>
      <h5 v-else-if="block.type === 'heading'" class="text-base font-bold text-text-main">
        <InlineContent :tokens="block.content" />
      </h5>
      <hr v-else-if="block.type === 'divider'" class="border-border">
      <ul v-else-if="block.type === 'unordered-list'" class="ml-5 list-disc space-y-2 marker:text-primary">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><InlineContent :tokens="item" /></li>
      </ul>
      <ol v-else-if="block.type === 'ordered-list'" class="ml-5 list-decimal space-y-2 marker:font-bold marker:text-primary">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><InlineContent :tokens="item" /></li>
      </ol>
      <blockquote v-else-if="block.type === 'quote'" class="border-l-4 border-primary bg-primary/5 px-4 py-3 italic text-text-main">
        <template v-for="(line, lineIndex) in block.lines" :key="lineIndex">
          <InlineContent :tokens="line" /><br v-if="lineIndex < block.lines.length - 1">
        </template>
      </blockquote>
      <p v-else class="leading-7">
        <template v-for="(line, lineIndex) in block.lines" :key="lineIndex">
          <InlineContent :tokens="line" /><br v-if="lineIndex < block.lines.length - 1">
        </template>
      </p>
    </template>
  </div>
</template>
