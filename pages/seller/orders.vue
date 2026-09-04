<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../services/sellerService'
import { getSellerOrderItems } from '../../services/sellerOrdersService'

const orderItems = ref([])
const loading = ref(true)
const errorMessage = ref('')
const statusFilter = ref('all')

const orderOf = (item) => Array.isArray(item.orders) ? item.orders[0] : item.orders
const productOf = (item) => Array.isArray(item.products) ? item.products[0] : item.products
const productImage = (item) => {
  const images = productOf(item)?.product_images || []
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
}
const visibleItems = computed(() => statusFilter.value === 'all'
  ? orderItems.value
  : orderItems.value.filter((item) => orderOf(item)?.status === statusFilter.value))
const totalPaidEarning = computed(() => orderItems.value
  .filter((item) => orderOf(item)?.status === 'paid')
  .reduce((sum, item) => sum + (Number(item.seller_earning) || 0), 0))
const pendingPayout = computed(() => orderItems.value
  .filter((item) => orderOf(item)?.status === 'paid' && ['pending', 'held'].includes(item.payout_status))
  .reduce((sum, item) => sum + (Number(item.seller_earning) || 0), 0))
const refundReview = computed(() => orderItems.value
  .filter((item) => orderOf(item)?.status === 'paid' && item.payout_status === 'refund_review')
  .reduce((sum, item) => sum + (Number(item.seller_earning) || 0), 0))
const payoutStatusLabel = status => ({
  held: '3-day protection',
  refund_review: 'Quality review',
  released: 'Paid out',
}[status] || status)

const formatIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
const orderStatusClass = (status) => ({
  paid: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700', expired: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-slate-200 text-slate-700', refunded: 'bg-blue-100 text-blue-700',
}[status] || 'bg-bg-alt text-text-muted')

onMounted(async () => {
  try {
    const seller = await getCurrentSeller()
    if (!seller) throw new Error('Seller account was not found.')
    orderItems.value = await getSellerOrderItems(seller.id)
  } catch (error) {
    errorMessage.value = error.message || 'Seller orders could not be loaded.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-6xl py-6 font-poppins">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Seller workspace</p><h1 class="mt-2 text-3xl font-black text-text-main">Store orders</h1><p class="mt-2 text-text-muted">Only items attributed to your store are shown.</p></div>
      <NuxtLink to="/seller" class="rounded-xl border border-bg-alt bg-surface px-4 py-2.5 text-sm font-bold text-text-main hover:text-primary">Back to dashboard</NuxtLink>
    </div>

    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <article class="rounded-2xl border border-bg-alt bg-surface p-5"><p class="text-sm font-semibold text-text-muted">Paid earnings</p><p class="mt-2 text-2xl font-black text-text-main">{{ formatIDR(totalPaidEarning) }}</p></article>
      <article class="rounded-2xl border border-bg-alt bg-surface p-5"><p class="text-sm font-semibold text-text-muted">Awaiting payout</p><p class="mt-2 text-2xl font-black text-primary">{{ formatIDR(pendingPayout) }}</p></article>
      <article class="rounded-2xl border border-bg-alt bg-surface p-5"><p class="text-sm font-semibold text-text-muted">Quality review hold</p><p class="mt-2 text-2xl font-black text-amber-600">{{ formatIDR(refundReview) }}</p></article>
    </div>

    <div class="mb-5 flex flex-wrap gap-2">
      <button v-for="status in ['all', 'paid', 'pending', 'refunded', 'cancelled']" :key="status" class="rounded-xl px-4 py-2 text-sm font-bold capitalize" :class="statusFilter === status ? 'bg-primary text-white' : 'border border-bg-alt bg-surface text-text-muted'" @click="statusFilter = status">{{ status }}</button>
    </div>

    <div v-if="loading" class="rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading store orders...</div>
    <p v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{{ errorMessage }}</p>
    <div v-else-if="visibleItems.length === 0" class="rounded-2xl border border-dashed border-bg-alt bg-surface p-10 text-center text-text-muted">No matching order items.</div>
    <div v-else class="overflow-hidden rounded-2xl border border-bg-alt bg-surface">
      <div v-for="item in visibleItems" :key="item.id" class="flex flex-col gap-4 border-b border-bg-alt p-5 last:border-b-0 lg:flex-row lg:items-center">
        <div class="flex min-w-0 flex-1 items-center gap-4">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-alt font-black text-text-muted"><img v-if="productImage(item)" :src="productImage(item)" :alt="productOf(item)?.name" class="h-full w-full object-cover"><span v-else>{{ productOf(item)?.name?.charAt(0) || 'P' }}</span></div>
          <div class="min-w-0"><NuxtLink :to="`/products/${productOf(item)?.slug || ''}`" class="truncate font-black text-text-main hover:text-primary">{{ productOf(item)?.name || 'Product' }}</NuxtLink><p class="mt-1 font-mono text-xs text-text-muted">{{ orderOf(item)?.order_number }}</p><p class="mt-1 text-xs text-text-muted">{{ formatDate(orderOf(item)?.created_at) }}</p></div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:min-w-[520px]">
          <div><p class="text-xs font-bold uppercase text-text-muted">Price</p><p class="mt-1 font-bold text-text-main">{{ formatIDR(item.price) }}</p></div>
          <div><p class="text-xs font-bold uppercase text-text-muted">Platform commission</p><p class="mt-1 font-bold text-red-600">-{{ formatIDR(item.commission_amount) }}</p><p class="mt-1 text-[11px] text-text-muted">{{ (Number(item.commission_rate_snapshot || 0) * 100).toFixed(2).replace(/\.00$/, '') }}% snapshot</p></div>
          <div><p class="text-xs font-bold uppercase text-text-muted">Your earning</p><p class="mt-1 font-black text-primary">{{ formatIDR(item.seller_earning) }}</p></div>
          <div><p class="text-xs font-bold uppercase text-text-muted">Status</p><span class="mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold capitalize" :class="orderStatusClass(orderOf(item)?.status)">{{ orderOf(item)?.status }}</span><p class="mt-1 text-[10px] text-text-muted">Payout: {{ payoutStatusLabel(item.payout_status) }}</p></div>
        </div>
      </div>
    </div>
  </div>
</template>
