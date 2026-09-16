<script setup>
import { onMounted, ref, watch } from 'vue'
import { chatReportRequest } from '../../../repositories/chatReportsRepository'
const status = ref('open')
const page = ref(1)
const reports = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
let requestId = 0
const load = async () => {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = await chatReportRequest('/api/admin/chat-reports', { query: { status: status.value, page: page.value } })
    if (id !== requestId) return
    reports.value = data.reports
    total.value = data.total
  } catch (err) { if (id === requestId) error.value = err?.data?.statusMessage || err.message }
  finally { if (id === requestId) loading.value = false }
}
watch(status, () => { page.value = 1; load() })
const move = (offset) => { page.value += offset; load() }
onMounted(load)
</script>

<template>
  <main class="mx-auto w-full max-w-5xl space-y-6">
    <header><h1 class="text-2xl font-semibold text-text-main">Chat reports</h1><p class="mt-2 text-sm text-text-muted">Review concerns from buyers and sellers and share your decision with the reporter.</p></header>
    <div class="flex flex-wrap items-center gap-3"><label class="text-sm text-text-main">Status <select v-model="status" class="ml-2 rounded-ui-sm border border-border bg-surface p-2"><option value="open">Awaiting review</option><option value="reviewed">Reviewed</option><option value="dismissed">Dismissed</option><option value="all">All reports</option></select></label><button :disabled="loading" class="rounded-ui-sm border border-border px-4 py-2 text-sm text-primary disabled:opacity-50" @click="load">Refresh</button></div>
    <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
    <p v-if="loading" class="text-sm text-text-muted">Loading reports…</p>
    <p v-else-if="!reports.length && !error" class="rounded-ui-lg border border-border bg-surface p-8 text-center text-text-muted">No reports match this filter.</p>
    <div v-else-if="!error" class="divide-y divide-border overflow-hidden rounded-ui-lg border border-border bg-surface">
      <NuxtLink v-for="report in reports" :key="report.id" :to="`/admin/chat-reports/${report.id}`" class="block space-y-2 p-5 transition hover:bg-bg-alt">
        <div class="flex flex-wrap justify-between gap-2"><span class="font-semibold text-text-main">{{ report.reporter?.full_name || 'Marketplace user' }}</span><span class="text-xs capitalize text-primary">{{ report.status }}</span></div>
        <p class="line-clamp-2 break-words text-sm text-text-main">{{ report.reason }}</p><p class="text-xs text-text-muted">{{ report.category.replaceAll('_', ' ') }} · {{ new Date(report.created_at).toLocaleString('en-US') }}</p>
      </NuxtLink>
    </div>
    <nav class="flex items-center justify-between gap-3 text-sm text-text-main" aria-label="Report pagination"><button :disabled="loading || page <= 1" class="rounded-ui-sm border border-border px-4 py-2 disabled:opacity-40" @click="move(-1)">Previous</button><span>Page {{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span><button :disabled="loading || page * 20 >= total" class="rounded-ui-sm border border-border px-4 py-2 disabled:opacity-40" @click="move(1)">Next</button></nav>
  </main>
</template>
