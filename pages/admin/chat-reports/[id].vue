<script setup>
import { onMounted, ref } from 'vue'
import { chatReportRequest } from '../../../repositories/chatReportsRepository'
import { validateReportReview } from '../../../utils/chatReports'
const route = useRoute()
const report = ref(null)
const messages = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const decision = ref('reviewed')
const note = ref('')
const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await chatReportRequest(`/api/admin/chat-reports/${route.params.id}`, { query: { page: page.value } })
    report.value = data.report; messages.value = data.messages; total.value = data.totalMessages
  } catch (err) { error.value = err?.data?.statusMessage || err.message }
  finally { loading.value = false }
}
const save = async () => {
  if (saving.value) return
  const input = validateReportReview({ status: decision.value, resolution_note: note.value })
  error.value = input.error || ''
  if (input.error) return
  saving.value = true
  try {
    await chatReportRequest(`/api/admin/chat-reports/${route.params.id}`, { method: 'PATCH', body: input })
    success.value = 'Review saved. The reporter can now see your decision.'
    await load()
  } catch (err) { error.value = err?.data?.statusMessage || err.message }
  finally { saving.value = false }
}
const move = (offset) => { page.value += offset; load() }
onMounted(load)
</script>

<template>
  <main class="mx-auto w-full max-w-5xl space-y-5">
    <NuxtLink to="/admin/chat-reports" class="text-sm font-semibold text-primary hover:underline">← Back to reports</NuxtLink>
    <h1 class="text-2xl font-semibold text-text-main">Review chat report</h1>
    <p v-if="error" role="alert" class="rounded-ui-sm bg-danger/10 p-4 text-sm text-danger">{{ error }} <button class="underline" @click="load">Reload</button></p>
    <p v-if="success" role="status" class="text-sm text-primary">{{ success }}</p>
    <p v-if="loading" class="text-sm text-text-muted">Loading report…</p>
    <template v-else-if="report">
      <section class="space-y-3 rounded-ui-lg border border-border bg-surface p-5"><div class="flex flex-wrap justify-between gap-2"><h2 class="font-semibold text-text-main">{{ report.reporter?.full_name || 'Marketplace user' }}</h2><span class="text-sm capitalize text-primary">{{ report.status }}</span></div><p class="text-xs text-text-muted">{{ report.category.replaceAll('_', ' ') }} · {{ new Date(report.created_at).toLocaleString('en-US') }}</p><p class="whitespace-pre-wrap break-words text-sm text-text-main">{{ report.reason }}</p><p class="break-all text-xs text-text-muted">Report reference: {{ report.id }}</p></section>
      <div class="grid items-start gap-5 lg:grid-cols-2">
        <section class="min-w-0 rounded-ui-lg border border-border bg-surface p-5"><h2 class="font-semibold text-text-main">Conversation evidence</h2><p class="mt-1 text-xs text-text-muted">Newest messages first. Messages sent after the report may also appear.</p><p v-if="!messages.length" class="mt-4 text-sm text-text-muted">No messages available.</p><div class="mt-4 max-h-[32rem] space-y-3 overflow-y-auto"><article v-for="message in messages" :key="message.id" class="rounded-ui-sm bg-bg p-3"><p class="text-xs font-semibold text-primary">{{ message.sender?.full_name || 'Participant' }}{{ message.sender_profile_id === report.reported_by ? ' (Reporter)' : '' }}</p><p class="mt-2 whitespace-pre-wrap break-words text-sm text-text-main">{{ message.content }}</p><p class="mt-2 text-xs text-text-muted">{{ new Date(message.created_at).toLocaleString('en-US') }}</p></article></div><div class="mt-4 flex justify-between text-sm text-primary"><button :disabled="page <= 1" class="disabled:opacity-40" @click="move(-1)">Newer messages</button><button :disabled="page * 50 >= total" class="disabled:opacity-40" @click="move(1)">Older messages</button></div></section>
        <form v-if="report.status === 'open'" class="space-y-4 rounded-ui-lg border border-border bg-surface p-5" @submit.prevent="save"><h2 class="font-semibold text-text-main">Review decision</h2><label class="block text-sm text-text-main">Decision<select v-model="decision" :disabled="saving" class="mt-2 w-full rounded-ui-sm border border-border bg-bg p-3"><option value="reviewed">Reviewed — concern acknowledged</option><option value="dismissed">Dismissed — no action warranted</option></select></label><label class="block text-sm text-text-main">Response to the reporter<textarea v-model="note" :disabled="saving" required minlength="10" maxlength="2000" rows="6" class="mt-2 w-full rounded-ui-sm border border-border bg-bg p-3" /></label><p class="text-xs text-text-muted">This response is visible to the reporter. Saving a decision does not block an account, close the conversation, or issue a refund.</p><button :disabled="saving" class="w-full rounded-ui-md bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">{{ saving ? 'Saving…' : 'Save decision' }}</button></form>
        <section v-else class="space-y-3 rounded-ui-lg border border-border bg-surface p-5"><h2 class="font-semibold text-text-main">Review outcome</h2><p class="whitespace-pre-wrap break-words text-sm text-text-main">{{ report.resolution_note || 'No response was recorded for this legacy report.' }}</p><p class="text-xs text-text-muted">{{ report.reviewer?.full_name || 'Administrator' }}<span v-if="report.reviewed_at"> · {{ new Date(report.reviewed_at).toLocaleString('en-US') }}</span></p></section>
      </div>
    </template>
  </main>
</template>
