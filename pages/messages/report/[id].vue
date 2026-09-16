<script setup>
import { onMounted, ref } from 'vue'
import { chatReportCategories, validateChatReport } from '../../../utils/chatReports'
import { chatReportRequest } from '../../../repositories/chatReportsRepository'

const route = useRoute()
const threadId = String(route.params.id)
const category = ref('')
const reason = ref('')
const reports = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const load = async () => {
  loading.value = true
  error.value = ''
  try { reports.value = (await chatReportRequest(`/api/direct-messages/${threadId}/reports`)).reports }
  catch (err) { error.value = err?.data?.statusMessage || err.message }
  finally { loading.value = false }
}
const submit = async () => {
  if (saving.value) return
  const input = validateChatReport({ category: category.value, reason: reason.value })
  error.value = input.error || ''
  success.value = ''
  if (input.error) return
  saving.value = true
  try {
    const { report } = await chatReportRequest(`/api/direct-messages/${threadId}/reports`, { method: 'POST', body: input })
    reports.value.unshift(report)
    category.value = ''
    reason.value = ''
    success.value = 'Report submitted. You can check the review outcome below.'
  } catch (err) { error.value = err?.data?.statusMessage || err.message }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <main class="mx-auto w-full max-w-3xl space-y-6 pb-8">
    <NuxtLink :to="`/messages/${threadId}`" class="inline-flex text-sm font-semibold text-primary hover:underline">← Back to conversation</NuxtLink>
    <header><h1 class="text-2xl font-semibold text-text-main">Report conversation</h1><p class="mt-2 text-sm text-text-muted">Tell us what happened. Our team can review the conversation to investigate your report.</p></header>
    <p v-if="error" role="alert" class="rounded-ui-sm bg-danger/10 p-4 text-sm text-danger">{{ error }}</p>
    <p v-if="success" role="status" class="rounded-ui-sm bg-primary/10 p-4 text-sm text-primary">{{ success }}</p>
    <form class="space-y-5 rounded-ui-lg border border-border bg-surface p-5 sm:p-6" @submit.prevent="submit">
      <label class="block text-sm font-semibold text-text-main">Reason for reporting
        <select v-model="category" required :disabled="saving" class="mt-2 w-full rounded-ui-sm border border-border bg-bg p-3 text-text-main focus:ring-2 focus:ring-primary/30"><option disabled value="">Select a category</option><option v-for="item in chatReportCategories" :key="item.value" :value="item.value">{{ item.label }}</option></select>
      </label>
      <label class="block text-sm font-semibold text-text-main">Describe the issue
        <textarea v-model="reason" required minlength="10" maxlength="2000" rows="6" :disabled="saving" class="mt-2 w-full rounded-ui-sm border border-border bg-bg p-3 text-text-main focus:ring-2 focus:ring-primary/30" placeholder="Describe what happened and identify any relevant messages or dates. Do not include passwords or payment credentials." />
      </label>
      <p class="text-right text-xs text-text-muted">{{ reason.length }} / 2000</p>
      <p class="text-xs leading-5 text-text-muted">Reporting does not automatically block the other person or request a refund. Your report and the review outcome are visible to you and platform administrators.</p>
      <button :disabled="saving || loading" class="w-full rounded-ui-md bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 sm:w-auto">{{ saving ? 'Submitting…' : 'Submit report' }}</button>
    </form>
    <section class="space-y-3" aria-label="Your reports">
      <h2 class="text-lg font-semibold text-text-main">Your reports for this conversation</h2>
      <p v-if="loading" class="text-sm text-text-muted">Loading reports…</p>
      <p v-else-if="!reports.length" class="text-sm text-text-muted">No reports submitted yet.</p>
      <article v-for="report in reports" :key="report.id" class="space-y-3 rounded-ui-lg border border-border bg-surface p-5">
        <div class="flex flex-wrap justify-between gap-2"><span class="text-sm font-semibold text-text-main">{{ chatReportCategories.find(item => item.value === report.category)?.label }}</span><span class="rounded-ui-xs bg-primary/10 px-2 py-1 text-xs capitalize text-primary">{{ report.status === 'open' ? 'Awaiting review' : report.status }}</span></div>
        <p class="whitespace-pre-wrap break-words text-sm text-text-main">{{ report.reason }}</p>
        <p class="text-xs text-text-muted">Submitted {{ new Date(report.created_at).toLocaleString('en-US') }}</p>
        <div v-if="report.resolution_note" class="rounded-ui-sm bg-bg p-3"><p class="text-xs font-semibold text-primary">Review outcome</p><p class="mt-1 whitespace-pre-wrap break-words text-sm text-text-main">{{ report.resolution_note }}</p></div>
      </article>
    </section>
  </main>
</template>
