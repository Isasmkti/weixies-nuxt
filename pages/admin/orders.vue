<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '../../utils/supabase'
import { confirmAction, showAlert, showErrorDialog, showSuccess } from '../../utils/sweetAlert'

const orders = ref([])
const loading = ref(true)
const workingId = ref(null)
const statusFilter = ref('reviewable')
const errorMessage = ref('')

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
const downloadedItems = order => (order.order_items || []).filter(item => item.is_downloaded)
const downloadSummary = (order) => {
  const downloaded = downloadedItems(order)
  if (!downloaded.length) return 'Not downloaded'
  const totalAccesses = downloaded.reduce((sum, item) => sum + Number(item.download_count || 0), 0)
  const latest = downloaded.map(item => item.downloaded_at).filter(Boolean).sort().at(-1)
  return `${totalAccesses || downloaded.length} access${(totalAccesses || downloaded.length) === 1 ? '' : 'es'} · ${formatDateTime(latest)}`
}

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
  const currentReason = refundOf(order)?.reason || ''
  const dialog = await showAlert({
    icon: 'warning',
    title: `Review order #${order.order_number}`,
    text: `A full ${formatIDR(order.total_amount)} refund will be requested and the seller payout will remain on hold.`,
    input: 'textarea',
    inputValue: currentReason,
    inputLabel: 'Product quality issue',
    inputPlaceholder: 'Describe the issue clearly for the audit record...',
    inputAttributes: {
      maxlength: '1000',
      'aria-label': 'Product quality issue',
    },
    showCancelButton: true,
    cancelButtonText: 'Keep order',
    confirmButtonText: currentReason ? 'Retry refund' : 'Hold & refund',
    confirmButtonColor: 'rgb(var(--color-danger))',
    focusCancel: true,
    inputValidator: (value) => {
      const length = String(value || '').trim().length
      if (length < 5) return 'Please describe the issue in at least 5 characters.'
      if (length > 1000) return 'The reason cannot exceed 1,000 characters.'
      return undefined
    },
  })
  if (!dialog.isConfirmed) return
  const reason = String(dialog.value || '').trim()

  workingId.value = order.id
  errorMessage.value = ''
  try {
    const result = await authFetch(`/api/admin/orders/${order.id}/refund`, {
      method: 'POST',
      body: { reason: reason.trim() },
    })
    await loadOrders()
    await showSuccess(
      result.status === 'manual_action_required' ? 'Seller payout is on hold' : 'Refund submitted',
      result.message || 'Seller funds remain held until Xendit confirms the refund.',
    )
  } catch (error) {
    await showErrorDialog('Refund could not be submitted', error?.data?.statusMessage || error.message || 'Refund review could not be created.')
  } finally {
    workingId.value = null
  }
}

const releaseHold = async (order) => {
  const confirmed = await confirmAction({
    title: 'Release refund hold?',
    text: `Order #${order.order_number} will become eligible for the next automatic seller payout run.`,
    confirmButtonText: 'Release hold',
  })
  if (!confirmed) return
  workingId.value = order.id
  errorMessage.value = ''
  try {
    await authFetch(`/api/admin/orders/${order.id}/refund-hold`, { method: 'DELETE' })
    await loadOrders()
    await showSuccess('Refund hold released', `Order #${order.order_number} can enter the next automatic payout run.`)
  } catch (error) {
    await showErrorDialog('Hold could not be released', error?.data?.statusMessage || error.message || 'Refund hold could not be released.')
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
      <button class="w-full rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary sm:w-auto" :disabled="loading" @click="loadOrders">Refresh</button>
    </div>

    <p v-if="errorMessage" class="mt-6 rounded-ui-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{{ errorMessage }}</p>
    <div class="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-ui-md border border-border bg-surface p-1">
      <button v-for="filter in ['reviewable', 'on_hold', 'refunded', 'all']" :key="filter" class="whitespace-nowrap rounded-ui-sm px-4 py-2 text-sm font-semibold capitalize transition" :class="statusFilter === filter ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-alt hover:text-text-main'" @click="statusFilter = filter">{{ filter.replace('_', ' ') }}</button>
    </div>

    <div v-if="loading" class="mt-6 rounded-ui-lg border border-border bg-surface p-12 text-center text-text-muted">Loading orders...</div>
    <div v-else-if="filteredOrders.length === 0" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface p-12 text-center text-text-muted">No orders match this filter.</div>
    <div v-else class="mt-6 overflow-hidden rounded-ui-lg border border-border bg-surface shadow-elevation-1">
      <div class="divide-y divide-border md:hidden">
        <article v-for="order in filteredOrders" :key="`mobile-${order.id}`" class="space-y-4 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-bold text-text-main">#{{ order.order_number }}</p>
              <p class="mt-1 text-xs text-text-muted">{{ formatDateTime(order.paid_at) }}</p>
            </div>
            <span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize" :class="order.status === 'refunded' ? 'bg-sky-100 text-sky-700' : isOnHold(order) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'">{{ refundOf(order)?.status?.replace('_', ' ') || order.status }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div class="min-w-0 rounded-ui-sm bg-bg p-3"><dt class="text-xs text-text-muted">Buyer</dt><dd class="mt-1 truncate font-semibold text-text-main">{{ buyerOf(order)?.full_name || 'Buyer' }}</dd></div>
            <div class="rounded-ui-sm bg-bg p-3"><dt class="text-xs text-text-muted">Amount</dt><dd class="mt-1 font-bold text-text-main">{{ formatIDR(order.total_amount) }}</dd></div>
            <div class="col-span-2 min-w-0 rounded-ui-sm bg-bg p-3"><dt class="text-xs text-text-muted">Products</dt><dd class="mt-1 text-text-main">{{ productNames(order) }}</dd><p class="mt-1 text-xs font-semibold" :class="downloadedItems(order).length ? 'text-emerald-600' : 'text-text-muted'">{{ downloadSummary(order) }}</p></div>
            <div class="col-span-2 rounded-ui-sm bg-bg p-3"><dt class="text-xs text-text-muted">Payout window</dt><dd class="mt-1 font-semibold" :class="isOnHold(order) ? 'text-amber-600' : 'text-text-main'">{{ isOnHold(order) ? 'Paused for review' : deadlineLabel(order) }}</dd><p class="mt-1 text-xs text-text-muted">{{ formatDateTime(holdDeadline(order)) }}</p></div>
          </dl>
          <p v-if="refundOf(order)?.reason" class="rounded-ui-sm border border-border p-3 text-xs text-text-muted">{{ refundOf(order).reason }}</p>
          <div class="flex flex-wrap gap-2">
            <button v-if="canStartRefund(order)" class="min-h-10 flex-1 rounded-ui-sm bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-50" :disabled="workingId === order.id" @click="requestRefund(order)">{{ workingId === order.id ? 'Processing...' : 'Review & refund' }}</button>
            <template v-else-if="isOnHold(order)">
              <a v-if="['manual_action_required', 'submitted'].includes(refundOf(order)?.status)" href="https://dashboard.xendit.co/transactions" target="_blank" rel="noopener noreferrer" class="min-h-10 flex-1 rounded-ui-sm bg-primary px-3 py-2.5 text-center text-xs font-bold text-white">Open Xendit</a>
              <button v-if="refundOf(order)?.status === 'failed'" class="min-h-10 flex-1 rounded-ui-sm bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-50" :disabled="workingId === order.id" @click="requestRefund(order)">Retry refund</button>
              <button v-if="!['submitted', 'succeeded'].includes(refundOf(order)?.status)" class="min-h-10 flex-1 rounded-ui-sm border border-border px-3 py-2 text-xs font-bold text-text-main" :disabled="workingId === order.id" @click="releaseHold(order)">Release hold</button>
            </template>
          </div>
        </article>
      </div>
      <div class="hidden overflow-x-auto md:block">
      <table class="w-full min-w-[1120px] text-left">
        <thead class="border-b border-border bg-bg-alt/50 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <tr><th class="p-4">Order</th><th class="p-4">Buyer</th><th class="p-4">Product</th><th class="p-4">Amount</th><th class="p-4">Payout window</th><th class="p-4">Review status</th><th class="p-4 text-right">Action</th></tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="order in filteredOrders" :key="order.id" class="align-top transition hover:bg-bg-alt/30">
            <td class="p-4"><p class="font-bold text-text-main">#{{ order.order_number }}</p><p class="mt-1 text-xs text-text-muted">{{ formatDateTime(order.paid_at) }}</p></td>
            <td class="p-4"><p class="font-semibold text-text-main">{{ buyerOf(order)?.full_name || 'Buyer' }}</p><p class="text-xs text-text-muted">{{ buyerOf(order)?.email || '-' }}</p></td>
            <td class="max-w-64 p-4 text-sm text-text-main"><p>{{ productNames(order) }}</p><p class="mt-1 text-xs font-semibold" :class="downloadedItems(order).length ? 'text-emerald-600' : 'text-text-muted'">{{ downloadSummary(order) }}</p></td>
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
  </div>
</template>
