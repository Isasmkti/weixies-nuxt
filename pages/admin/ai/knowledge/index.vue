<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  deleteAiKnowledgeArticle,
  getAiKnowledgeArticles,
  indexAiKnowledgeArticle,
  indexAiProducts,
  updateAiKnowledgeArticle,
} from '~/services/aiKnowledgeService'
import { confirmAction } from '~/utils/sweetAlert'

const articles = ref([])
const loading = ref(true)
const workingId = ref(null)
const indexingProducts = ref(false)
const search = ref('')
const statusFilter = ref('all')
const indexFilter = ref('all')
const errorMessage = ref('')
const successMessage = ref('')

const statusClasses = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  archived: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
}

const articleIsIndexed = (article) => Boolean(article.embedded_at && article.content_hash && article.embedding_model)

const filteredArticles = computed(() => {
  const query = search.value.trim().toLowerCase()

  return articles.value.filter((article) => {
    const matchesStatus = statusFilter.value === 'all' || article.status === statusFilter.value
    const indexed = articleIsIndexed(article)
    const matchesIndex = indexFilter.value === 'all'
      || (indexFilter.value === 'indexed' && indexed)
      || (indexFilter.value === 'needs_indexing' && !indexed)
    const searchable = [
      article.title,
      article.slug,
      article.excerpt,
      article.category,
      article.source_type,
      ...(article.tags || []),
    ].filter(Boolean).join(' ').toLowerCase()

    return matchesStatus && matchesIndex && (!query || searchable.includes(query))
  })
})

const publishedCount = computed(() => articles.value.filter((article) => article.status === 'published').length)
const indexedCount = computed(() => articles.value.filter(articleIsIndexed).length)

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'

const errorText = (error, fallback) => error?.data?.statusMessage
  || error?.data?.message
  || error?.message
  || fallback

const replaceArticle = (updated) => {
  if (!updated?.id) return
  const index = articles.value.findIndex((article) => article.id === updated.id)
  if (index !== -1) articles.value[index] = { ...articles.value[index], ...updated }
}

const loadArticles = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    articles.value = await getAiKnowledgeArticles()
  } catch (error) {
    errorMessage.value = errorText(error, 'Knowledge articles could not be loaded.')
  } finally {
    loading.value = false
  }
}

const changeStatus = async (article, status) => {
  const action = status === 'published' ? 'publish' : 'archive'
  const confirmed = await confirmAction({
    title: `${action === 'publish' ? 'Publish' : 'Archive'} article?`,
    text: `This will ${action} "${article.title}".`,
    confirmButtonText: action === 'publish' ? 'Publish article' : 'Archive article',
  })
  if (!confirmed) return

  workingId.value = `status:${article.id}`
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const updated = await updateAiKnowledgeArticle(article.id, { status })
    replaceArticle(updated)
    successMessage.value = status === 'published'
      ? 'The article is published. Index it before relying on it in AI answers.'
      : 'The article has been archived and will not be used for retrieval.'
  } catch (error) {
    errorMessage.value = errorText(error, 'The article status could not be updated.')
  } finally {
    workingId.value = null
  }
}

const indexArticle = async (article) => {
  if (articleIsIndexed(article)) {
    const confirmed = await confirmAction({
      title: 'Reindex article?',
      text: `The current AI index for "${article.title}" will be replaced.`,
      confirmButtonText: 'Reindex article',
    })
    if (!confirmed) return
  }

  workingId.value = `index:${article.id}`
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const updated = await indexAiKnowledgeArticle(article.id)
    replaceArticle(updated)
    successMessage.value = `"${article.title}" is ready for AI retrieval.`
  } catch (error) {
    errorMessage.value = errorText(error, 'The article could not be indexed.')
  } finally {
    workingId.value = null
  }
}

const removeArticle = async (article) => {
  const confirmed = await confirmAction({
    title: 'Delete knowledge article?',
    text: `"${article.title}" will be permanently deleted. This action cannot be undone.`,
    confirmButtonText: 'Delete article',
    confirmButtonColor: 'rgb(var(--color-danger))',
  })
  if (!confirmed) return

  workingId.value = `delete:${article.id}`
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await deleteAiKnowledgeArticle(article.id)
    articles.value = articles.value.filter((item) => item.id !== article.id)
    successMessage.value = 'The knowledge article has been deleted.'
  } catch (error) {
    errorMessage.value = errorText(error, 'The article could not be deleted.')
  } finally {
    workingId.value = null
  }
}

const summarizeProductIndexing = (response) => {
  const counts = response?.counts || response?.result || response || {}
  const labels = [
    ['processed', counts.processed ?? counts.scanned ?? counts.total],
    ['indexed', counts.indexed ?? counts.created ?? counts.updated],
    ['skipped', counts.skipped],
    ['failed', counts.failed ?? counts.errors],
  ].filter(([, value]) => Number.isFinite(Number(value)))

  if (!labels.length) return 'Product indexing request completed.'
  return `Product indexing completed: ${labels.map(([label, value]) => `${Number(value)} ${label}`).join(', ')}.`
}

const indexProducts = async () => {
  indexingProducts.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await indexAiProducts({ limit: 25, force: false })
    successMessage.value = summarizeProductIndexing(result)
  } catch (error) {
    errorMessage.value = errorText(error, 'Products could not be indexed for AI retrieval.')
  } finally {
    indexingProducts.value = false
  }
}

const rowIsWorking = (articleId) => workingId.value?.endsWith(`:${articleId}`)

onMounted(loadArticles)
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] font-poppins">
    <header class="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.22em] text-primary">AI support content</p>
        <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">AI Knowledge Base</h1>
        <p class="mt-2 max-w-2xl font-montserrat text-sm text-text-muted sm:text-base">Manage verified policies, FAQs, and guides used by the customer-service assistant.</p>
        <div class="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span class="rounded-full border border-bg-alt bg-surface px-3 py-1.5 text-text-muted">{{ articles.length }} articles</span>
          <span class="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">{{ publishedCount }} published</span>
          <span class="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{{ indexedCount }} indexed</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="indexingProducts"
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-surface px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60"
          @click="indexProducts"
        >
          <svg class="h-4 w-4" :class="{ 'animate-spin': indexingProducts }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {{ indexingProducts ? 'Indexing Products...' : 'Index Products' }}
        </button>
        <NuxtLink to="/admin/ai/knowledge/create" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          Add Article
        </NuxtLink>
      </div>
    </header>

    <div v-if="errorMessage" class="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-700 dark:text-red-300" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="shrink-0 underline underline-offset-4" @click="errorMessage = ''">Dismiss</button>
    </div>
    <div v-if="successMessage" class="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300" role="status">
      <span>{{ successMessage }}</span>
      <button type="button" class="shrink-0 underline underline-offset-4" @click="successMessage = ''">Dismiss</button>
    </div>

    <section class="mb-6 grid gap-3 rounded-2xl border border-bg-alt bg-surface p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_190px_190px_auto]">
      <label class="text-xs font-bold uppercase tracking-wider text-text-muted">
        Search
        <span class="relative mt-2 block">
          <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
          <input v-model="search" type="search" class="w-full rounded-xl border border-bg-alt bg-bg py-3 pl-10 pr-4 text-sm font-medium normal-case tracking-normal text-text-main outline-none focus:border-primary" placeholder="Title, slug, category, or tag">
        </span>
      </label>
      <label class="text-xs font-bold uppercase tracking-wider text-text-muted">
        Status
        <select v-model="statusFilter" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm font-semibold normal-case tracking-normal text-text-main outline-none focus:border-primary">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label class="text-xs font-bold uppercase tracking-wider text-text-muted">
        AI index
        <select v-model="indexFilter" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm font-semibold normal-case tracking-normal text-text-main outline-none focus:border-primary">
          <option value="all">All index states</option>
          <option value="indexed">Indexed</option>
          <option value="needs_indexing">Needs indexing</option>
        </select>
      </label>
      <button type="button" :disabled="loading" class="self-end rounded-xl border border-bg-alt bg-bg px-5 py-3 text-sm font-bold text-text-main transition hover:border-primary/30 hover:text-primary disabled:opacity-60" @click="loadArticles">
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </section>

    <div class="overflow-hidden rounded-2xl border border-bg-alt bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr class="bg-bg-alt/50 text-xs uppercase tracking-wider text-text-muted">
              <th class="p-5 font-bold">Article</th>
              <th class="p-5 font-bold">Source</th>
              <th class="p-5 font-bold">Status</th>
              <th class="p-5 font-bold">AI Index</th>
              <th class="p-5 font-bold">Updated</th>
              <th class="p-5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-bg-alt">
            <tr v-if="loading">
              <td colspan="6" class="p-12 text-center text-text-muted">Loading knowledge articles...</td>
            </tr>
            <tr v-else-if="filteredArticles.length === 0">
              <td colspan="6" class="p-12 text-center">
                <p class="text-lg font-black text-text-main">No knowledge articles found</p>
                <p class="mt-1 text-sm text-text-muted">Adjust the filters or add the first verified article.</p>
              </td>
            </tr>
            <tr v-for="article in filteredArticles" :key="article.id" class="align-top transition hover:bg-bg-alt/30">
              <td class="p-5">
                <p class="max-w-sm font-black text-text-main">{{ article.title }}</p>
                <p class="mt-1 max-w-sm truncate font-mono text-xs text-primary">{{ article.slug }}</p>
                <p v-if="article.excerpt" class="mt-2 max-w-sm line-clamp-2 text-xs leading-5 text-text-muted">{{ article.excerpt }}</p>
                <div v-if="article.tags?.length" class="mt-3 flex max-w-sm flex-wrap gap-1.5">
                  <span v-for="tag in article.tags.slice(0, 4)" :key="tag" class="rounded-md bg-bg-alt px-2 py-1 text-[10px] font-bold text-text-muted">{{ tag }}</span>
                  <span v-if="article.tags.length > 4" class="px-1 py-1 text-[10px] font-bold text-text-muted">+{{ article.tags.length - 4 }}</span>
                </div>
              </td>
              <td class="p-5">
                <span class="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase text-primary">{{ article.source_type }}</span>
                <p class="mt-2 max-w-[180px] truncate text-xs font-semibold text-text-muted">{{ article.category || 'Uncategorized' }}</p>
              </td>
              <td class="p-5">
                <span class="rounded-full px-3 py-1 text-xs font-bold capitalize" :class="statusClasses[article.status] || 'bg-bg-alt text-text-muted'">{{ article.status }}</span>
                <p v-if="article.published_at" class="mt-2 text-[11px] text-text-muted">Published {{ formatDateTime(article.published_at) }}</p>
              </td>
              <td class="p-5">
                <span v-if="workingId === `index:${article.id}`" class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <span class="h-2 w-2 animate-pulse rounded-full bg-primary" /> Indexing
                </span>
                <span v-else-if="articleIsIndexed(article)" class="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span class="h-2 w-2 rounded-full bg-emerald-500" /> Indexed
                </span>
                <span v-else class="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span class="h-2 w-2 rounded-full bg-amber-500" /> Needs indexing
                </span>
                <p v-if="article.embedding_model" class="mt-2 max-w-[170px] truncate font-mono text-[10px] text-text-muted">{{ article.embedding_model }}</p>
                <p v-if="article.embedded_at" class="mt-1 text-[10px] text-text-muted">{{ formatDateTime(article.embedded_at) }}</p>
              </td>
              <td class="whitespace-nowrap p-5 text-xs text-text-muted">{{ formatDateTime(article.updated_at) }}</td>
              <td class="p-5">
                <div class="flex min-w-[285px] flex-wrap justify-end gap-2">
                  <NuxtLink :to="`/admin/ai/knowledge/${article.id}/edit`" class="rounded-lg border border-bg-alt px-3 py-2 text-xs font-bold text-text-main transition hover:border-primary/30 hover:text-primary">Edit</NuxtLink>
                  <button
                    type="button"
                    :disabled="rowIsWorking(article.id)"
                    class="rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/5 disabled:opacity-50"
                    @click="indexArticle(article)"
                  >{{ articleIsIndexed(article) ? 'Reindex' : 'Index' }}</button>
                  <button
                    v-if="article.status !== 'published'"
                    type="button"
                    :disabled="rowIsWorking(article.id)"
                    class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    @click="changeStatus(article, 'published')"
                  >Publish</button>
                  <button
                    v-else
                    type="button"
                    :disabled="rowIsWorking(article.id)"
                    class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    @click="changeStatus(article, 'archived')"
                  >Archive</button>
                  <button
                    type="button"
                    :disabled="rowIsWorking(article.id)"
                    class="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
                    @click="removeArticle(article)"
                  >Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
