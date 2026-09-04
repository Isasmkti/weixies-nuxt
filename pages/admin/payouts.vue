<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAllPayouts, getPayoutCandidates } from '../../services/payoutsService'

const payouts = ref([])
const candidates = ref([])
const loading = ref(true)
const errorMessage = ref('')

const sellerOf = payout => Array.isArray(payout.seller) ? payout.seller[0] : payout.seller
const payoutBank = payout => ({
  name: payout.bank_name_snapshot || sellerOf(payout)?.bank_name || '',
  account: payout.bank_account_snapshot || sellerOf(payout)?.bank_account || '',
})
const formatIDR = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDate = value => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '-'
const formatPeriodEnd = value => value ? formatDate(new Date(new Date(value).getTime() - 1)) : '-'
const statusClass = status => ({ pending: 'bg-amber-100 text-amber-800', processing: 'bg-blue-100 text-blue-700', paid: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-700', reversed: 'bg-purple-100 text-purple-700' }[status] || 'bg-bg-alt text-text-muted')

const paidTotal = computed(() => payouts.value.filter(item => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0))
const processingTotal = computed(() => payouts.value.filter(item => ['pending', 'processing'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0))
const failedCount = computed(() => payouts.value.filter(item => ['failed', 'reversed'].includes(item.status)).length)
const readyTotal = computed(() => candidates.value.filter(item => item.payout_ready).reduce((sum, item) => sum + Number(item.amount || 0), 0))

const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const loadMonitor = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [history, queue] = await Promise.all([
      getAllPayouts(),
      getPayoutCandidates('2000-01-01', localDate(new Date())),
    ])
    payouts.value = history
    candidates.value = queue
  } catch (error) {
    errorMessage.value = error.message || 'Payout monitoring data could not be loaded.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMonitor)
</script>

<template>
  <div class="mx-auto max-w-[1600px] font-poppins">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Automatic seller payouts</h1><p class="mt-2 max-w-3xl text-sm text-text-muted">Paid seller earnings are protected for three days, then submitted to Xendit by the daily settlement job. This page is monitoring-only.</p></div>
      <button class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary disabled:opacity-50" :disabled="loading" @click="loadMonitor">{{ loading ? 'Refreshing...' : 'Refresh' }}</button>
    </div>

    <p v-if="errorMessage" class="mt-6 rounded-ui-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{{ errorMessage }}</p>

    <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-semibold text-text-muted">Ready next run</p><p class="mt-2 text-2xl font-black text-primary">{{ formatIDR(readyTotal) }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-semibold text-text-muted">Processing</p><p class="mt-2 text-2xl font-black text-blue-600">{{ formatIDR(processingTotal) }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-semibold text-text-muted">Total paid</p><p class="mt-2 text-2xl font-black text-emerald-600">{{ formatIDR(paidTotal) }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-semibold text-text-muted">Needs attention</p><p class="mt-2 text-2xl font-black" :class="failedCount ? 'text-danger' : 'text-text-main'">{{ failedCount }}</p></article>
    </section>

    <section class="mt-7 rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1 sm:p-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 class="text-xl font-black text-text-main">Next automatic queue</h2><p class="mt-1 text-sm text-text-muted">The production cron is scheduled daily at 02:00 UTC (09:00 Jakarta hour). Refund-review orders are excluded from this queue.</p></div><NuxtLink to="/admin/orders" class="text-sm font-bold text-primary hover:underline">Manage quality refunds</NuxtLink></div>
      <div v-if="loading" class="mt-5 py-8 text-center text-text-muted">Calculating queue...</div>
      <p v-else-if="candidates.length === 0" class="mt-5 rounded-ui-md border border-dashed border-border p-8 text-center text-sm text-text-muted">No mature seller balance is waiting.</p>
      <div v-else class="mt-5 overflow-x-auto rounded-ui-md border border-border"><table class="w-full min-w-[760px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-4">Seller</th><th class="p-4">Destination</th><th class="p-4">Items</th><th class="p-4">Amount</th><th class="p-4">Readiness</th></tr></thead><tbody class="divide-y divide-border"><tr v-for="candidate in candidates" :key="candidate.seller_id"><td class="p-4 font-bold text-text-main">{{ candidate.store_name }}</td><td class="p-4 text-sm text-text-main">{{ candidate.bank_name || 'Bank missing' }}<p class="font-mono text-xs text-text-muted">{{ candidate.bank_account || '-' }}</p></td><td class="p-4 text-sm text-text-muted">{{ candidate.item_count }}</td><td class="p-4 font-black text-text-main">{{ formatIDR(candidate.amount) }}</td><td class="p-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="candidate.payout_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">{{ candidate.payout_ready ? 'Ready' : 'Beneficiary incomplete' }}</span></td></tr></tbody></table></div>
    </section>

    <section class="mt-7"><div class="mb-4"><h2 class="text-2xl font-black text-text-main">Payout history</h2><p class="mt-1 text-sm text-text-muted">Provider status is the source of truth; pending and processing rows are synchronized by the same daily job.</p></div>
      <div v-if="loading" class="rounded-ui-lg border border-border bg-surface p-10 text-center text-text-muted">Loading payouts...</div>
      <div v-else-if="payouts.length === 0" class="rounded-ui-lg border border-dashed border-border bg-surface p-10 text-center text-text-muted">No payout batches yet.</div>
      <div v-else class="overflow-x-auto rounded-ui-lg border border-border bg-surface shadow-elevation-1"><table class="w-full min-w-[1080px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-5">Seller</th><th class="p-5">Period</th><th class="p-5">Net amount</th><th class="p-5">Items</th><th class="p-5">Reference</th><th class="p-5">Status</th></tr></thead><tbody class="divide-y divide-border"><tr v-for="payout in payouts" :key="payout.id"><td class="p-5"><p class="font-bold text-text-main">{{ sellerOf(payout)?.store_name || 'Seller' }}</p><p class="text-xs text-text-muted">{{ payoutBank(payout).name || '-' }} · {{ payoutBank(payout).account || '-' }}</p></td><td class="p-5 text-sm text-text-muted">{{ formatDate(payout.period_start) }} – {{ formatPeriodEnd(payout.period_end) }}</td><td class="p-5"><p class="font-black text-text-main">{{ formatIDR(payout.amount) }}</p><p v-if="Number(payout.adjustment_amount)" class="mt-1 text-xs text-text-muted">Gross {{ formatIDR(payout.gross_amount) }} · adjustment {{ formatIDR(payout.adjustment_amount) }}</p></td><td class="p-5 text-sm text-text-muted">{{ payout.seller_payout_items?.length || 0 }}</td><td class="p-5"><p class="font-mono text-xs text-text-muted">{{ payout.reference_no || payout.provider_payout_id || '-' }}</p><p v-if="payout.provider_reference_id" class="mt-1 font-mono text-[10px] text-text-muted">{{ payout.provider_reference_id }}</p></td><td class="p-5"><span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="statusClass(payout.status)">{{ payout.status }}</span><p v-if="payout.provider_status" class="mt-2 text-xs font-semibold text-text-muted">Xendit: {{ payout.provider_status }}</p><p v-if="payout.provider_failure_code" class="mt-1 max-w-52 text-xs text-danger">{{ payout.provider_failure_code }}</p></td></tr></tbody></table></div>
    </section>
  </div>
</template>
