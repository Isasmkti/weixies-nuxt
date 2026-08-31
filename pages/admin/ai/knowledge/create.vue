<script setup>
import { ref } from 'vue'
import AiKnowledgeArticleForm from '~/components/admin/AiKnowledgeArticleForm.vue'
import { createAiKnowledgeArticle } from '~/services/aiKnowledgeService'

const router = useRouter()
const saving = ref(false)
const errorMessage = ref('')

const saveArticle = async (form) => {
  saving.value = true
  errorMessage.value = ''
  try {
    const article = await createAiKnowledgeArticle(form)
    await router.push(`/admin/ai/knowledge/${article.id}/edit?created=1`)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'The knowledge article could not be created.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl font-poppins">
    <NuxtLink to="/admin/ai/knowledge" class="inline-flex items-center gap-2 text-sm font-bold text-text-muted transition hover:text-primary">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7" /></svg>
      Back to AI Knowledge
    </NuxtLink>

    <header class="mb-8 mt-6">
      <p class="text-xs font-black uppercase tracking-[0.22em] text-primary">New verified source</p>
      <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Create Knowledge Article</h1>
      <p class="mt-2 text-text-muted">Save the article, then index it from the knowledge-base list when its content is ready.</p>
    </header>

    <p v-if="errorMessage" class="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-700 dark:text-red-300" role="alert">{{ errorMessage }}</p>

    <AiKnowledgeArticleForm :submitting="saving" submit-label="Create Article" @submit="saveArticle" />
  </div>
</template>

