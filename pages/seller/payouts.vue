<script setup>
import { computed, onMounted, ref } from 'vue'
import { getSellerPayouts } from '../../services/payoutsService'
import { getCurrentSeller } from '../../services/sellerService'

const payouts = ref([])
const loading = ref(true)
const errorMessage = ref('')
const totalPaid = computed(() => payouts.value.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0))
const inProgress = computed(() => payouts.value.filter((payout) => ['pending', 'processing'].includes(payout.status)).reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0))
const sellerOf = (payout) => Array.isArray(payout.seller) ? payout.seller[0] : payout.seller
const payoutBank = (payout) => ({
  name: payout.bank_name_snapshot || sellerOf(payout)?.bank_name || '',
  account: payout.bank_account_snapshot || sellerOf(payout)?.bank_account || '',
})
const formatIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-'
const formatPeriodEnd = (value) => value ? formatDate(new Date(new Date(value).getTime() - 1)) : '-'
const statusClass = (status) => ({ pending: 'bg-amber-100 text-amber-800', processing: 'bg-blue-100 text-blue-700', paid: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-700', reversed: 'bg-purple-100 text-purple-700' }[status] || 'bg-bg-alt text-text-muted')

onMounted(async () => {
  try {
    const seller = await getCurrentSeller()
    if (!seller) throw new Error('Seller account was not found.')
    payouts.value = await getSellerPayouts(seller.id)
  } catch (error) {
    errorMessage.value = error.message || 'Payout history could not be loaded.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-6xl py-6 font-poppins">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Seller workspace</p><h1 class="mt-2 text-3xl font-black text-text-main">Payouts</h1><p class="mt-2 text-text-muted">Read-only history of transfers from the platform.</p></div><NuxtLink to="/seller" class="rounded-xl border border-bg-alt bg-surface px-4 py-2.5 text-sm font-bold text-text-main hover:text-primary">Back to dashboard</NuxtLink></div>
    <div class="mb-6 grid gap-4 sm:grid-cols-2"><article class="rounded-2xl border border-bg-alt bg-surface p-5"><p class="text-sm font-semibold text-text-muted">Total paid</p><p class="mt-2 text-2xl font-black text-emerald-600">{{ formatIDR(totalPaid) }}</p></article><article class="rounded-2xl border border-bg-alt bg-surface p-5"><p class="text-sm font-semibold text-text-muted">In progress</p><p class="mt-2 text-2xl font-black text-primary">{{ formatIDR(inProgress) }}</p></article></div>
    <div v-if="loading" class="rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading payouts...</div>
    <p v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{{ errorMessage }}</p>
    <div v-else-if="payouts.length === 0" class="rounded-2xl border border-dashed border-bg-alt bg-surface p-10 text-center"><h2 class="text-xl font-bold text-text-main">No payouts yet</h2><p class="mt-2 text-sm text-text-muted">Payout batches created by the platform will appear here.</p></div>
    <div v-else class="overflow-x-auto rounded-2xl border border-bg-alt bg-surface"><table class="w-full min-w-[920px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-5">Period</th><th class="p-5">Net amount</th><th class="p-5">Items</th><th class="p-5">Destination</th><th class="p-5">Reference</th><th class="p-5">Status</th></tr></thead><tbody class="divide-y divide-bg-alt"><tr v-for="payout in payouts" :key="payout.id"><td class="p-5 text-sm text-text-muted">{{ formatDate(payout.period_start) }} – {{ formatPeriodEnd(payout.period_end) }}</td><td class="p-5"><p class="font-black text-text-main">{{ formatIDR(payout.amount) }}</p><p v-if="Number(payout.adjustment_amount)" class="mt-1 text-xs text-text-muted">Includes {{ formatIDR(payout.adjustment_amount) }} adjustment</p></td><td class="p-5 text-sm text-text-muted">{{ payout.seller_payout_items?.length || 0 }}</td><td class="p-5 text-sm text-text-main">{{ payoutBank(payout).name || 'Not provided' }}<p class="font-mono text-xs text-text-muted">{{ payoutBank(payout).account || '-' }}</p></td><td class="p-5 font-mono text-xs text-text-muted">{{ payout.reference_no || payout.provider_payout_id || '-' }}</td><td class="p-5"><span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="statusClass(payout.status)">{{ payout.status }}</span><p v-if="payout.provider_status" class="mt-2 text-xs font-semibold text-text-muted">Xendit: {{ payout.provider_status }}</p><p v-if="payout.provider_failure_code" class="mt-1 max-w-48 text-xs text-red-600">{{ payout.provider_failure_code }}</p><p v-if="payout.paid_at" class="mt-1 text-xs text-text-muted">{{ formatDate(payout.paid_at) }}</p></td></tr></tbody></table></div>
  </div>
</template>
