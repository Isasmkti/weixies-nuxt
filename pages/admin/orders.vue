<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../../utils/supabase'

const orders = ref([])
const loading = ref(true)
const workingId = ref(null)
const statusFilter = ref('reviewable')
const errorMessage = ref('')
const successMessage = ref('')

const authFetch = async (url, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Administrator session is unavailable.')
  return $fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
}

const refundOf = order => order.order_refund_requests?.[0] || null
const buyerOf = order => Array.isArray(order.buyer) ? order.buyer[0] : order.buyer
const sellerItems = order => (order.order_items || []).filter(item => item.seller_id)
const holdDeadline = (order) => {
  const timestamps = sellerItems(order)
    .map(item => item.available_for_payout_at)
    .filter(Boolean)
    .map(value => new Date(value).getTime())
    .filter(Number.isFinite)
  return timestamps.length ? new Date(Math.min(...timestamps)) : null
}
const canStartRefund = order => order.status === 'paid'
  && sellerItems(order).some(item => item.payout_status === 'held')
const isOnHold = order => sellerItems(order).some(item => item.payout_status === 'refund_review')
const productNames = order => sellerItems(order).map(item => item.product?.name).filter(Boolean).join(', ') || 'Digital product'

const filteredOrders = computed(() => orders.value.filter((order) => {
  if (statusFilter.value === 'all') return true
  if (statusFilter.value === 'on_hold') return isOnHold(order)
  if (statusFilter.value === 'refunded') return order.status === 'refunded'
  return canStartRefund(order) || isOnHold(order)
}))

const formatIDR = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDateTime = value => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
const deadlineLabel = (order) => {
  const deadline = holdDeadline(order)
  if (!deadline) return '-'
  const remaining = deadline.getTime() - Date.now()
  if (remaining <= 0) return 'Eligible for the next automatic run'
  const hours = Math.ceil(remaining / 3600000)
  return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`
}

const loadOrders = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await authFetch('/api/admin/orders')
    orders.value = response.orders || []
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error.message || 'Orders could not be loaded.'
  } finally {
    loading.value = false
  }
}

const requestRefund = async (order) => {
  const reason = window.prompt('Describe the product quality issue. This will immediately hold the seller payout:')
  if (!reason?.trim()) return
  if (!window.confirm(`Place ${order.order_number} on hold and request a full ${formatIDR(order.total_amount)} refund?`)) return

  workingId.value = order.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await authFetch(`/api/admin/orders/${order.id}/refund`, {
      method: 'POST',
      body: { reason: reason.trim() },
    })
    successMessage.value = result.message || 'Refund submitted. Seller funds remain held until Xendit confirms it.'
    await loadOrders()
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error.message || 'Refund review could not be created.'
  } finally {
    workingId.value = null
  }
}

const releaseHold = async (order) => {
  if (!window.confirm(`Release the refund hold for ${order.order_number}? It can be paid automatically on the next run.`)) return
  workingId.value = order.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await authFetch(`/api/admin/orders/${order.id}/refund-hold`, { method: 'DELETE' })
    successMessage.value = 'Refund hold released.'
    await loadOrders()
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error.message || 'Refund hold could not be released.'
  } finally {
    workingId.value = null
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="mx-auto max-w-[1600px] font-poppins">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Order quality & refunds</h1>
        <p class="mt-2 max-w-3xl text-sm text-text-muted">Seller earnings are held for three days. Put a problematic order under review before the deadline to keep it out of automatic payouts.</p>
      </div>
      <button class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary" :disabled="loading" @click="loadOrders">Refresh</button>
    </div>

    <p v-if="errorMessage" class="mt-6 rounded-ui-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mt-6 rounded-ui-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{{ successMessage }}</p>

    <div class="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-ui-md border border-border bg-surface p-1">
      <button v-for="filter in ['reviewable', 'on_hold', 'refunded', 'all']" :key="filter" class="whitespace-nowrap rounded-ui-sm px-4 py-2 text-sm font-semibold capitalize transition" :class="statusFilter === filter ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-alt hover:text-text-main'" @click="statusFilter = filter">{{ filter.replace('_', ' ') }}</button>
    </div>

    <div v-if="loading" class="mt-6 rounded-ui-lg border border-border bg-surface p-12 text-center text-text-muted">Loading orders...</div>
    <div v-else-if="filteredOrders.length === 0" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface p-12 text-center text-text-muted">No orders match this filter.</div>
    <div v-else class="mt-6 overflow-x-auto rounded-ui-lg border border-border bg-surface shadow-elevation-1">
      <table class="w-full min-w-[1120px] text-left">
        <thead class="border-b border-border bg-bg-alt/50 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <tr><th class="p-4">Order</th><th class="p-4">Buyer</th><th class="p-4">Product</th><th class="p-4">Amount</th><th class="p-4">Payout window</th><th class="p-4">Review status</th><th class="p-4 text-right">Action</th></tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="order in filteredOrders" :key="order.id" class="align-top transition hover:bg-bg-alt/30">
            <td class="p-4"><p class="font-bold text-text-main">#{{ order.order_number }}</p><p class="mt-1 text-xs text-text-muted">{{ formatDateTime(order.paid_at) }}</p></td>
            <td class="p-4"><p class="font-semibold text-text-main">{{ buyerOf(order)?.full_name || 'Buyer' }}</p><p class="text-xs text-text-muted">{{ buyerOf(order)?.email || '-' }}</p></td>
            <td class="max-w-64 p-4 text-sm text-text-main">{{ productNames(order) }}</td>
            <td class="p-4 font-bold text-text-main">{{ formatIDR(order.total_amount) }}</td>
            <td class="p-4"><p class="text-sm font-semibold" :class="isOnHold(order) ? 'text-amber-600' : 'text-text-main'">{{ isOnHold(order) ? 'Paused for review' : deadlineLabel(order) }}</p><p class="mt-1 text-xs text-text-muted">{{ formatDateTime(holdDeadline(order)) }}</p></td>
            <td class="p-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="order.status === 'refunded' ? 'bg-sky-100 text-sky-700' : isOnHold(order) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'">{{ refundOf(order)?.status?.replace('_', ' ') || order.status }}</span><p v-if="refundOf(order)?.reason" class="mt-2 max-w-64 text-xs text-text-muted">{{ refundOf(order).reason }}</p><p v-if="refundOf(order)?.provider_failure_code" class="mt-1 text-xs text-danger">{{ refundOf(order).provider_failure_code }}</p></td>
            <td class="p-4 text-right">
              <button v-if="canStartRefund(order)" class="rounded-ui-sm bg-danger px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50" :disabled="workingId === order.id" @click="requestRefund(order)">{{ workingId === order.id ? 'Processing...' : 'Review & refund' }}</button>
              <div v-else-if="isOnHold(order)" class="flex justify-end gap-2">
                <a v-if="['manual_action_required', 'submitted'].includes(refundOf(order)?.status)" href="https://dashboard.xendit.co/transactions" target="_blank" rel="noopener noreferrer" class="rounded-ui-sm bg-primary px-3 py-2 text-xs font-bold text-white">Open Xendit</a>
                <button v-if="refundOf(order)?.status === 'failed'" class="rounded-ui-sm bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-50" :disabled="workingId === order.id" @click="requestRefund(order)">Retry refund</button>
                <button v-if="!['submitted', 'succeeded'].includes(refundOf(order)?.status)" class="rounded-ui-sm border border-border px-3 py-2 text-xs font-bold text-text-main hover:border-primary/40" :disabled="workingId === order.id" @click="releaseHold(order)">Release hold</button>
              </div>
              <span v-else class="text-xs text-text-muted">No action</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
