<script setup>
import { computed, onMounted, ref } from 'vue'
import AiKnowledgeArticleForm from '~/components/admin/AiKnowledgeArticleForm.vue'
import { getAiKnowledgeArticle, updateAiKnowledgeArticle } from '~/services/aiKnowledgeService'

const route = useRoute()
const articleId = computed(() => Array.isArray(route.params.id) ? route.params.id[0] : route.params.id)
const article = ref(null)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref(route.query.created === '1' ? 'Knowledge article created successfully.' : '')

const loadArticle = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    article.value = await getAiKnowledgeArticle(articleId.value)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'The knowledge article could not be loaded.'
  } finally {
    loading.value = false
  }
}

const saveArticle = async (form) => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    article.value = await updateAiKnowledgeArticle(articleId.value, form)
    successMessage.value = article.value.embedded_at
      ? 'Article saved. Its current AI index remains valid.'
      : 'Article saved. Index or reindex it from the knowledge-base list before using it for AI retrieval.'
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'The knowledge article could not be saved.'
  } finally {
    saving.value = false
  }
}

onMounted(loadArticle)
</script>

<template>
  <div class="mx-auto max-w-4xl font-poppins">
    <NuxtLink to="/admin/ai/knowledge" class="inline-flex items-center gap-2 text-sm font-bold text-text-muted transition hover:text-primary">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7" /></svg>
      Back to AI Knowledge
    </NuxtLink>

    <header class="mb-8 mt-6">
      <p class="text-xs font-black uppercase tracking-[0.22em] text-primary">Verified support source</p>
      <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Edit Knowledge Article</h1>
      <p class="mt-2 text-text-muted">Changes to the title or article content invalidate the previous AI index automatically.</p>
    </header>

    <p v-if="errorMessage" class="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-700 dark:text-red-300" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300" role="status">{{ successMessage }}</p>

    <div v-if="loading" class="flex min-h-[360px] items-center justify-center rounded-3xl border border-bg-alt bg-surface">
      <div class="text-center">
        <span class="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p class="mt-4 font-semibold text-text-muted">Loading knowledge article...</p>
      </div>
    </div>

    <AiKnowledgeArticleForm
      v-else-if="article"
      :initial-article="article"
      :submitting="saving"
      submit-label="Save Changes"
      @submit="saveArticle"
    />
  </div>
</template>

