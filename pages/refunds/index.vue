<script setup>
import { computed, onMounted, ref } from 'vue'
import RefundStatusBadge from '../../components/refunds/RefundStatusBadge.vue'
import RefundTimeline from '../../components/refunds/RefundTimeline.vue'
import { getBuyerRefunds } from '../../services/refundsService'
import { formatIDR } from '../../utils/currency'

const route = useRoute()
const refunds = ref([])
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const activeFilter = ref('all')

useHead({ title: 'My Refunds' })

const inProgressStatuses = ['requested', 'manual_action_required', 'submitted']
const filterOptions = computed(() => [
  { value: 'all', label: 'All', count: refunds.value.length },
  { value: 'in_progress', label: 'In progress', count: refunds.value.filter(item => inProgressStatuses.includes(item.status)).length },
  { value: 'succeeded', label: 'Processed', count: refunds.value.filter(item => item.status === 'succeeded').length },
  { value: 'failed', label: 'Needs attention', count: refunds.value.filter(item => item.status === 'failed').length },
  { value: 'cancelled', label: 'Cancelled', count: refunds.value.filter(item => item.status === 'cancelled').length },
])

const requestedOrderId = computed(() => String(route.query.order || '').trim())
const visibleRefunds = computed(() => refunds.value.filter((refund) => {
  if (requestedOrderId.value && refund.order?.id !== requestedOrderId.value) return false
  if (activeFilter.value === 'all') return true
  if (activeFilter.value === 'in_progress') return inProgressStatuses.includes(refund.status)
  return refund.status === activeFilter.value
}))

const totalProcessed = computed(() => refunds.value
  .filter(refund => refund.status === 'succeeded')
  .reduce((sum, refund) => sum + Number(refund.amount || 0), 0))
const inProgressCount = computed(() => refunds.value.filter(refund => inProgressStatuses.includes(refund.status)).length)
const needsAttentionCount = computed(() => refunds.value.filter(refund => refund.status === 'failed').length)

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'
const paymentMethod = value => String(value || 'Original payment method').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const storeNames = refund => [...new Set(refund.items.map(item => item.store?.name).filter(Boolean))].join(', ') || 'Weixies seller'

const statusMessage = (refund) => ({
  requested: 'The review has been recorded and the seller payout is currently held.',
  manual_action_required: 'The seller payout is held while an administrator completes the refund through the payment provider.',
  submitted: 'The refund request has been sent to Xendit and is waiting for its final webhook status.',
  succeeded: 'Xendit and the payment channel processed this refund. The time until funds appear in your account depends on your bank or payment channel.',
  failed: 'The provider could not process this refund. The seller payout remains held while an administrator reviews or retries it.',
  cancelled: 'The refund review was cancelled before a refund was completed.',
}[refund.status] || 'The latest refund status is shown here.')

const loadRefunds = async ({ silent = false } = {}) => {
  if (silent) refreshing.value = true
  else loading.value = true
  errorMessage.value = ''
  try {
    refunds.value = await getBuyerRefunds()
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error.message || 'Your refund information could not be loaded.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(loadRefunds)
</script>

<template>
  <div class="mx-auto max-w-[1440px] py-4 md:py-6">
    <header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">Purchase protection</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight text-text-main">My refunds</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Track refund reasons, processing progress, returned amounts, and the original orders.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/orders" class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary">My orders</NuxtLink>
        <button type="button" :disabled="loading || refreshing" class="rounded-ui-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60" @click="loadRefunds({ silent: true })">{{ refreshing ? 'Refreshing...' : 'Refresh status' }}</button>
      </div>
    </header>

    <section class="mt-6 grid gap-4 sm:grid-cols-3">
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-medium text-text-muted">Processed amount</p><p class="mt-2 text-2xl font-semibold text-emerald-600">{{ formatIDR(totalProcessed) }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-medium text-text-muted">In progress</p><p class="mt-2 text-2xl font-semibold text-primary">{{ inProgressCount }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-medium text-text-muted">Needs attention</p><p class="mt-2 text-2xl font-semibold" :class="needsAttentionCount ? 'text-danger' : 'text-text-main'">{{ needsAttentionCount }}</p></article>
    </section>

    <div class="mt-6 rounded-ui-md border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-text-muted">
      <strong class="text-text-main">When is the money returned?</strong>
      A processed status means Xendit has passed the refund to the original payment channel. Your bank or payment provider determines when it appears in your account.
    </div>

    <div v-if="requestedOrderId" class="mt-5 flex items-center justify-between gap-4 rounded-ui-md border border-border bg-surface px-4 py-3 text-sm">
      <span class="text-text-muted">Showing the refund linked from your selected order.</span>
      <NuxtLink to="/refunds" class="font-semibold text-primary hover:underline">Show all</NuxtLink>
    </div>

    <div v-if="!loading && refunds.length" class="no-scrollbar mt-6 overflow-x-auto">
      <div class="inline-flex min-w-max gap-1 rounded-ui-full border border-border bg-bg-alt p-1">
        <button v-for="filter in filterOptions" :key="filter.value" type="button" class="rounded-ui-full px-4 py-2 text-sm font-medium transition" :class="activeFilter === filter.value ? 'bg-surface text-primary shadow-elevation-1' : 'text-text-muted hover:text-text-main'" @click="activeFilter = filter.value">{{ filter.label }} <span class="ml-1 text-xs">{{ filter.count }}</span></button>
      </div>
    </div>

    <div v-if="loading" class="mt-6 space-y-4"><div v-for="index in 3" :key="index" class="h-72 animate-pulse rounded-ui-lg border border-border bg-surface"></div></div>
    <div v-else-if="errorMessage" class="mt-6 rounded-ui-lg border border-danger/20 bg-danger/10 p-6 text-danger"><p class="font-semibold">Refund information is unavailable</p><p class="mt-1 text-sm">{{ errorMessage }}</p><button class="mt-4 text-sm font-bold underline" @click="loadRefunds()">Try again</button></div>
    <div v-else-if="!refunds.length" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface px-6 py-16 text-center"><span class="mx-auto flex h-14 w-14 items-center justify-center rounded-ui-full bg-primary/10 text-primary"><svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 10h14a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H8m-5-8 4-4m-4 4 4 4" /></svg></span><h2 class="mt-4 text-xl font-semibold text-text-main">No refund activity</h2><p class="mt-2 text-sm text-text-muted">Refund reviews and completed returns will appear here.</p></div>
    <div v-else-if="!visibleRefunds.length" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-text-muted">No refunds match this view.</div>

    <section v-else class="mt-6 space-y-5">
      <article v-for="refund in visibleRefunds" :key="refund.id" class="overflow-hidden rounded-ui-lg border border-border bg-surface shadow-elevation-1">
        <div class="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
          <div><p class="font-mono text-sm font-bold text-text-main">#{{ refund.order?.order_number || 'Order' }}</p><p class="mt-1 text-xs text-text-muted">Requested {{ formatDate(refund.requested_at) }} · {{ storeNames(refund) }}</p></div>
          <div class="flex flex-wrap items-center gap-3 sm:justify-end"><RefundStatusBadge :status="refund.status" /><p class="text-lg font-semibold text-text-main">{{ formatIDR(refund.amount) }}</p></div>
        </div>

        <div class="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div class="min-w-0 space-y-5">
            <div><p class="text-xs font-bold uppercase tracking-wider text-text-muted">Reason for refund</p><p class="mt-2 whitespace-pre-line text-sm leading-6 text-text-main">{{ refund.reason }}</p></div>
            <div class="rounded-ui-md border border-border bg-bg/60 p-4 text-sm leading-6 text-text-muted">{{ statusMessage(refund) }}<p v-if="refund.failure_code" class="mt-2 font-mono text-xs text-danger">Provider code: {{ refund.failure_code }}</p></div>
            <RefundTimeline :status="refund.status" :requested-at="refund.requested_at" :submitted-at="refund.submitted_at" :resolved-at="refund.resolved_at" />
          </div>

          <aside class="rounded-ui-md border border-border bg-bg/40 p-4">
            <p class="text-xs font-bold uppercase tracking-wider text-text-muted">Refund details</p>
            <dl class="mt-4 space-y-3 text-sm"><div><dt class="text-xs text-text-muted">Return destination</dt><dd class="mt-1 font-semibold text-text-main">{{ paymentMethod(refund.payment_method) }}</dd></div><div><dt class="text-xs text-text-muted">Reference</dt><dd class="mt-1 break-all font-mono text-xs text-text-main">{{ refund.reference || '-' }}</dd></div><div><dt class="text-xs text-text-muted">Last update</dt><dd class="mt-1 font-semibold text-text-main">{{ formatDate(refund.updated_at) }}</dd></div></dl>
            <NuxtLink v-if="refund.order?.id" :to="`/orders/${refund.order.id}`" class="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">Open order details <span aria-hidden="true">→</span></NuxtLink>
          </aside>
        </div>

        <div v-if="refund.items.length" class="border-t border-border px-5 py-4"><p class="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Products</p><div class="flex flex-wrap gap-3"><NuxtLink v-for="item in refund.items" :key="item.id" :to="item.product?.slug ? `/products/${item.product.slug}` : '/products'" class="flex min-w-0 items-center gap-3 rounded-ui-md border border-border bg-bg/40 p-2 pr-4 transition hover:border-primary/30"><span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-ui-sm bg-bg-alt text-xs font-bold text-text-muted"><img v-if="item.product?.image_url" :src="item.product.image_url" :alt="item.product.name" class="h-full w-full object-cover"><span v-else>{{ item.product?.name?.charAt(0) || 'P' }}</span></span><span class="min-w-0"><span class="block max-w-48 truncate text-sm font-semibold text-text-main">{{ item.product?.name || 'Product' }}</span><span class="block text-xs text-text-muted">{{ item.store?.name || 'Store' }}</span></span></NuxtLink></div></div>
      </article>
    </section>
  </div>
</template>
