<script setup>
import { computed, onMounted, ref } from 'vue'
import RefundStatusBadge from '../../components/refunds/RefundStatusBadge.vue'
import RefundTimeline from '../../components/refunds/RefundTimeline.vue'
import { getSellerRefunds } from '../../services/refundsService'
import { formatIDR } from '../../utils/currency'

const seller = ref(null)
const refunds = ref([])
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const activeFilter = ref('all')

useHead({ title: 'Store Refunds' })

const activeStatuses = ['requested', 'manual_action_required', 'submitted', 'failed']
const visibleRefunds = computed(() => activeFilter.value === 'all'
  ? refunds.value
  : activeFilter.value === 'active'
    ? refunds.value.filter(refund => activeStatuses.includes(refund.status))
    : refunds.value.filter(refund => refund.status === activeFilter.value))
const activeHolds = computed(() => refunds.value.filter(refund => activeStatuses.includes(refund.status)))
const heldImpact = computed(() => activeHolds.value.reduce((sum, refund) => sum + Number(refund.seller_impact || 0), 0))
const refundedImpact = computed(() => refunds.value.filter(refund => refund.status === 'succeeded').reduce((sum, refund) => sum + Number(refund.seller_impact || 0), 0))
const failedCount = computed(() => refunds.value.filter(refund => refund.status === 'failed').length)
const filterOptions = computed(() => [
  { value: 'all', label: 'All', count: refunds.value.length },
  { value: 'active', label: 'Active holds', count: activeHolds.value.length },
  { value: 'succeeded', label: 'Refunded', count: refunds.value.filter(refund => refund.status === 'succeeded').length },
  { value: 'cancelled', label: 'Cancelled', count: refunds.value.filter(refund => refund.status === 'cancelled').length },
])

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'
const payoutMessage = (refund) => {
  if (refund.status === 'succeeded') return 'This earning was removed from payout eligibility. If it had already been paid, the amount is carried as a balance adjustment into a later payout.'
  if (refund.status === 'cancelled') return 'The hold was released. Eligible earnings can return to the automatic payout queue.'
  if (refund.status === 'failed') return 'The provider attempt failed, but the earning remains held until an administrator resolves the refund.'
  return 'This earning is excluded from automatic payouts while the refund is being reviewed or processed.'
}

const loadRefunds = async ({ silent = false } = {}) => {
  if (silent) refreshing.value = true
  else loading.value = true
  errorMessage.value = ''
  try {
    const response = await getSellerRefunds()
    seller.value = response.seller
    refunds.value = response.refunds
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error.message || 'Store refund information could not be loaded.'
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
      <div><p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">Seller workspace</p><h1 class="mt-2 text-3xl font-semibold tracking-tight text-text-main">Store refunds</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">See why an order was refunded and how each case affects your protected earnings and future payouts.</p></div>
      <div class="flex flex-wrap gap-2"><NuxtLink to="/seller/orders" class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary">Store orders</NuxtLink><NuxtLink to="/seller/payouts" class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary">Payouts</NuxtLink><button type="button" :disabled="loading || refreshing" class="rounded-ui-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60" @click="loadRefunds({ silent: true })">{{ refreshing ? 'Refreshing...' : 'Refresh status' }}</button></div>
    </header>

    <section class="mt-6 grid gap-4 sm:grid-cols-3">
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-medium text-text-muted">Currently held</p><p class="mt-2 text-2xl font-semibold text-amber-600">{{ formatIDR(heldImpact) }}</p><p class="mt-1 text-xs text-text-muted">{{ activeHolds.length }} active cases</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-medium text-text-muted">Refunded earnings</p><p class="mt-2 text-2xl font-semibold text-primary">{{ formatIDR(refundedImpact) }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1"><p class="text-sm font-medium text-text-muted">Provider issues</p><p class="mt-2 text-2xl font-semibold" :class="failedCount ? 'text-danger' : 'text-text-main'">{{ failedCount }}</p></article>
    </section>

    <div class="mt-6 rounded-ui-md border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-text-muted"><strong class="text-text-main">How payout protection works:</strong> earnings stay protected for three days. A refund review pauses that earning before automatic payout; a completed refund removes it from your balance.</div>

    <div v-if="!loading && refunds.length" class="no-scrollbar mt-6 overflow-x-auto"><div class="inline-flex min-w-max gap-1 rounded-ui-full border border-border bg-bg-alt p-1"><button v-for="filter in filterOptions" :key="filter.value" type="button" class="rounded-ui-full px-4 py-2 text-sm font-medium transition" :class="activeFilter === filter.value ? 'bg-surface text-primary shadow-elevation-1' : 'text-text-muted hover:text-text-main'" @click="activeFilter = filter.value">{{ filter.label }} <span class="ml-1 text-xs">{{ filter.count }}</span></button></div></div>

    <div v-if="loading" class="mt-6 space-y-4"><div v-for="index in 3" :key="index" class="h-72 animate-pulse rounded-ui-lg border border-border bg-surface"></div></div>
    <div v-else-if="errorMessage" class="mt-6 rounded-ui-lg border border-danger/20 bg-danger/10 p-6 text-danger"><p class="font-semibold">Store refunds are unavailable</p><p class="mt-1 text-sm">{{ errorMessage }}</p><button class="mt-4 text-sm font-bold underline" @click="loadRefunds()">Try again</button></div>
    <div v-else-if="!refunds.length" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface px-6 py-16 text-center"><span class="mx-auto flex h-14 w-14 items-center justify-center rounded-ui-full bg-primary/10 text-primary"><svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 10h14a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H8m-5-8 4-4m-4 4 4 4" /></svg></span><h2 class="mt-4 text-xl font-semibold text-text-main">No store refunds</h2><p class="mt-2 text-sm text-text-muted">Quality reviews involving {{ seller?.store_name || 'your store' }} will appear here.</p></div>
    <div v-else-if="!visibleRefunds.length" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-text-muted">No refunds match this filter.</div>

    <section v-else class="mt-6 space-y-5">
      <article v-for="refund in visibleRefunds" :key="refund.id" class="overflow-hidden rounded-ui-lg border border-border bg-surface shadow-elevation-1">
        <div class="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between"><div><p class="font-mono text-sm font-bold text-text-main">#{{ refund.order?.order_number || 'Order' }}</p><p class="mt-1 text-xs text-text-muted">Review opened {{ formatDate(refund.requested_at) }}</p></div><div class="flex flex-wrap items-center gap-3 sm:justify-end"><RefundStatusBadge :status="refund.status" /><div class="text-right"><p class="text-xs text-text-muted">Your earning affected</p><p class="font-semibold text-text-main">{{ formatIDR(refund.seller_impact) }}</p></div></div></div>
        <div class="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div class="space-y-5"><div><p class="text-xs font-bold uppercase tracking-wider text-text-muted">Reason recorded by the administrator</p><p class="mt-2 whitespace-pre-line text-sm leading-6 text-text-main">{{ refund.reason }}</p></div><div class="rounded-ui-md border border-border bg-bg/60 p-4 text-sm leading-6 text-text-muted">{{ payoutMessage(refund) }}<p v-if="refund.failure_code" class="mt-2 font-mono text-xs text-danger">Provider code: {{ refund.failure_code }}</p></div><RefundTimeline :status="refund.status" :requested-at="refund.requested_at" :submitted-at="refund.submitted_at" :resolved-at="refund.resolved_at" /></div>
          <aside class="rounded-ui-md border border-border bg-bg/40 p-4"><p class="text-xs font-bold uppercase tracking-wider text-text-muted">Financial details</p><dl class="mt-4 space-y-3 text-sm"><div><dt class="text-xs text-text-muted">Your store item total</dt><dd class="mt-1 font-semibold text-text-main">{{ formatIDR(refund.store_item_total) }}</dd></div><div><dt class="text-xs text-text-muted">Your earning impact</dt><dd class="mt-1 font-semibold text-text-main">{{ formatIDR(refund.seller_impact) }}</dd></div><div><dt class="text-xs text-text-muted">Reference</dt><dd class="mt-1 break-all font-mono text-xs text-text-main">{{ refund.reference || '-' }}</dd></div><div><dt class="text-xs text-text-muted">Last update</dt><dd class="mt-1 font-semibold text-text-main">{{ formatDate(refund.updated_at) }}</dd></div></dl></aside>
        </div>
        <div v-if="refund.items.length" class="border-t border-border px-5 py-4"><p class="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Your store items</p><div class="grid gap-3 sm:grid-cols-2"><NuxtLink v-for="item in refund.items" :key="item.id" :to="item.product?.slug ? `/products/${item.product.slug}` : '/seller/products'" class="flex items-center gap-3 rounded-ui-md border border-border bg-bg/40 p-3 transition hover:border-primary/30"><span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-ui-sm bg-bg-alt text-xs font-bold text-text-muted"><img v-if="item.product?.image_url" :src="item.product.image_url" :alt="item.product.name" class="h-full w-full object-cover"><span v-else>{{ item.product?.name?.charAt(0) || 'P' }}</span></span><span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold text-text-main">{{ item.product?.name || 'Product' }}</span><span class="mt-0.5 block text-xs text-text-muted">Payout: {{ String(item.payout_status).replaceAll('_', ' ') }} · {{ formatIDR(item.seller_earning) }}</span></span></NuxtLink></div></div>
      </article>
    </section>
  </div>
</template>
