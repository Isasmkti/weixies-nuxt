<script setup>
import { reactive, ref, watch } from 'vue'
import { slugifyAiKnowledgeTitle } from '../../services/aiKnowledgeService'

const props = defineProps({
  initialArticle: {
    type: Object,
    default: () => ({}),
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  submitLabel: {
    type: String,
    default: 'Save Article',
  },
  cancelTo: {
    type: String,
    default: '/admin/ai/knowledge',
  },
})

const emit = defineEmits(['submit'])

const emptyForm = () => ({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  source_type: 'faq',
  source_reference: '',
  category: '',
  status: 'draft',
})

const form = reactive(emptyForm())
const tagsText = ref('')
const slugEdited = ref(false)

const hydrateForm = (article = {}) => {
  Object.assign(form, emptyForm(), {
    title: article.title || '',
    slug: article.slug || '',
    excerpt: article.excerpt || '',
    content: article.content || '',
    source_type: article.source_type || 'faq',
    source_reference: article.source_reference || '',
    category: article.category || '',
    status: article.status || 'draft',
  })
  tagsText.value = Array.isArray(article.tags) ? article.tags.join(', ') : ''
  slugEdited.value = Boolean(article.slug)
}

watch(() => props.initialArticle, hydrateForm, { immediate: true })

watch(() => form.title, (title) => {
  if (!slugEdited.value) form.slug = slugifyAiKnowledgeTitle(title)
})

const markSlugEdited = () => {
  slugEdited.value = true
}

const normalizeSlug = () => {
  form.slug = slugifyAiKnowledgeTitle(form.slug || form.title)
}

const submit = () => {
  normalizeSlug()
  emit('submit', {
    ...form,
    tags: tagsText.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <section class="rounded-3xl border border-bg-alt bg-surface p-6 shadow-sm sm:p-8">
      <div class="mb-6">
        <h2 class="text-xl font-black text-text-main">Article content</h2>
        <p class="mt-1 text-sm text-text-muted">Write verified information that the AI support assistant may use in its answers.</p>
      </div>

      <div class="space-y-5">
        <label class="block text-sm font-bold text-text-main">
          Title
          <input
            v-model="form.title"
            type="text"
            required
            maxlength="240"
            autocomplete="off"
            class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="e.g. Refund policy for digital products"
          >
        </label>

        <label class="block text-sm font-bold text-text-main">
          Slug
          <input
            v-model="form.slug"
            type="text"
            required
            maxlength="160"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            autocomplete="off"
            class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 font-mono text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="refund-policy-digital-products"
            @input="markSlugEdited"
            @blur="normalizeSlug"
          >
          <span class="mt-1 block text-xs font-normal text-text-muted">Lowercase letters, numbers, and hyphens only.</span>
        </label>

        <label class="block text-sm font-bold text-text-main">
          Short excerpt
          <textarea
            v-model="form.excerpt"
            rows="3"
            maxlength="500"
            class="mt-2 w-full resize-y rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="A concise summary for administrators and retrieval context."
          />
          <span class="mt-1 block text-right text-xs font-normal text-text-muted">{{ form.excerpt.length }} / 500</span>
        </label>

        <label class="block text-sm font-bold text-text-main">
          Article content
          <textarea
            v-model="form.content"
            rows="16"
            required
            maxlength="100000"
            class="mt-2 w-full resize-y rounded-xl border border-bg-alt bg-bg px-4 py-3 font-montserrat text-sm leading-7 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Enter the complete, verified answer or policy here..."
          />
          <span class="mt-1 block text-right text-xs font-normal text-text-muted">{{ form.content.length.toLocaleString('en-US') }} / 100,000</span>
        </label>
      </div>
    </section>

    <section class="rounded-3xl border border-bg-alt bg-surface p-6 shadow-sm sm:p-8">
      <div class="mb-6">
        <h2 class="text-xl font-black text-text-main">Classification and publishing</h2>
        <p class="mt-1 text-sm text-text-muted">These fields help administrators organize and safely publish retrieval content.</p>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <label class="block text-sm font-bold text-text-main">
          Source type
          <select v-model="form.source_type" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="faq">FAQ</option>
            <option value="policy">Policy</option>
            <option value="guide">Guide</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label class="block text-sm font-bold text-text-main">
          Status
          <select v-model="form.status" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label class="block text-sm font-bold text-text-main">
          Category
          <input
            v-model="form.category"
            type="text"
            maxlength="160"
            class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="e.g. Payments"
          >
        </label>

        <label class="block text-sm font-bold text-text-main">
          Source reference
          <input
            v-model="form.source_reference"
            type="text"
            maxlength="2000"
            class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Internal document name or source URL"
          >
        </label>

        <label class="block text-sm font-bold text-text-main md:col-span-2">
          Tags
          <input
            v-model="tagsText"
            type="text"
            class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="refund, digital product, payment"
          >
          <span class="mt-1 block text-xs font-normal text-text-muted">Separate up to 20 tags with commas.</span>
        </label>
      </div>
    </section>

    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <NuxtLink :to="cancelTo" class="inline-flex items-center justify-center rounded-xl border border-bg-alt bg-surface px-6 py-3 text-sm font-bold text-text-main transition hover:border-primary/30 hover:text-primary">
        Cancel
      </NuxtLink>
      <button
        type="submit"
        :disabled="submitting"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
      >
        <svg v-if="submitting" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ submitting ? 'Saving...' : submitLabel }}
      </button>
    </div>
  </form>
</template>

