<script setup>
import { onMounted, ref } from 'vue'
import { createPayoutBatch, getAllPayouts, getPayoutCandidates, setPayoutStatus } from '../../services/payoutsService'

const today = new Date()
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const periodStart = ref(localDate(new Date(today.getFullYear(), today.getMonth(), 1)))
const periodEnd = ref(localDate(today))
const candidates = ref([])
const payouts = ref([])
const loadingCandidates = ref(false)
const loadingPayouts = ref(true)
const workingId = ref(null)
const errorMessage = ref('')
const successMessage = ref('')

const sellerOf = (payout) => Array.isArray(payout.seller) ? payout.seller[0] : payout.seller
const payoutBank = (payout) => ({
  name: payout.bank_name_snapshot || sellerOf(payout)?.bank_name || '',
  account: payout.bank_account_snapshot || sellerOf(payout)?.bank_account || '',
})
const formatIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-'
const statusClass = (status) => ({ pending: 'bg-amber-100 text-amber-800', processing: 'bg-blue-100 text-blue-700', paid: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-700' }[status] || 'bg-bg-alt text-text-muted')

const loadPayouts = async () => {
  loadingPayouts.value = true
  try {
    payouts.value = await getAllPayouts()
  } catch (error) {
    errorMessage.value = error.message || 'Payout history could not be loaded.'
  } finally {
    loadingPayouts.value = false
  }
}

const findCandidates = async () => {
  loadingCandidates.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    candidates.value = await getPayoutCandidates(periodStart.value, periodEnd.value)
  } catch (error) {
    errorMessage.value = error.message || 'Payout candidates could not be calculated.'
  } finally {
    loadingCandidates.value = false
  }
}

const createBatch = async (candidate) => {
  if (!candidate.bank_name || !candidate.bank_account) {
    errorMessage.value = `${candidate.store_name} must add a payout bank account first.`
    return
  }
  if (!confirm(`Create a ${formatIDR(candidate.amount)} payout for ${candidate.store_name}?`)) return
  workingId.value = candidate.seller_id
  errorMessage.value = ''
  try {
    await createPayoutBatch(candidate.seller_id, periodStart.value, periodEnd.value)
    successMessage.value = `Payout batch created for ${candidate.store_name}.`
    await Promise.all([findCandidates(), loadPayouts()])
  } catch (error) {
    errorMessage.value = error.message || 'Payout batch could not be created.'
  } finally {
    workingId.value = null
  }
}

const updatePayout = async (payout, status) => {
  let referenceNo = null
  if (status === 'paid') {
    referenceNo = window.prompt('Enter bank transfer/reference number:')
    if (!referenceNo?.trim()) return
  } else if (!confirm(`Mark this payout as ${status}?`)) return

  workingId.value = payout.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await setPayoutStatus(payout.id, status, referenceNo)
    successMessage.value = `Payout marked as ${status}.`
    await Promise.all([loadPayouts(), findCandidates()])
  } catch (error) {
    errorMessage.value = error.message || 'Payout status could not be updated.'
  } finally {
    workingId.value = null
  }
}

onMounted(loadPayouts)
</script>

<template>
  <div class="mx-auto max-w-[1600px] font-poppins">
    <div class="mb-8"><h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Seller Payouts</h1><p class="mt-2 text-text-muted">Create payout batches after the seven-day refund hold has ended.</p></div>
    <p v-if="errorMessage" class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{{ successMessage }}</p>

    <section class="rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm sm:p-6">
      <h2 class="text-xl font-black text-text-main">Create payout batches</h2><p class="mt-1 text-sm text-text-muted">The end date is inclusive. Refund debt and existing active payout items are calculated automatically.</p>
      <form class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" @submit.prevent="findCandidates"><label class="flex-1 text-sm font-bold text-text-main">Period start<input v-model="periodStart" type="date" required class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:border-primary"></label><label class="flex-1 text-sm font-bold text-text-main">Period end<input v-model="periodEnd" type="date" required class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:border-primary"></label><button class="rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60" :disabled="loadingCandidates">{{ loadingCandidates ? 'Calculating...' : 'Calculate eligible payouts' }}</button></form>

      <div v-if="candidates.length" class="mt-6 overflow-x-auto rounded-xl border border-bg-alt"><table class="w-full min-w-[760px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-4">Seller</th><th class="p-4">Bank</th><th class="p-4">Items</th><th class="p-4">Amount</th><th class="p-4 text-right">Action</th></tr></thead><tbody class="divide-y divide-bg-alt"><tr v-for="candidate in candidates" :key="candidate.seller_id"><td class="p-4 font-bold text-text-main">{{ candidate.store_name }}</td><td class="p-4 text-sm"><span :class="candidate.bank_name && candidate.bank_account ? 'text-text-main' : 'text-red-600 font-semibold'">{{ candidate.bank_name || 'Bank missing' }}</span><p class="font-mono text-xs text-text-muted">{{ candidate.bank_account || '-' }}</p></td><td class="p-4 text-sm text-text-muted">{{ candidate.item_count }}</td><td class="p-4 font-black text-text-main">{{ formatIDR(candidate.amount) }}</td><td class="p-4 text-right"><button class="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark disabled:opacity-50" :disabled="workingId === candidate.seller_id || !candidate.bank_name || !candidate.bank_account" @click="createBatch(candidate)">{{ workingId === candidate.seller_id ? 'Creating...' : 'Create batch' }}</button></td></tr></tbody></table></div>
      <p v-else-if="!loadingCandidates" class="mt-5 text-sm text-text-muted">Choose a period and calculate eligible payouts.</p>
    </section>

    <section class="mt-7"><div class="mb-4 flex items-center justify-between"><h2 class="text-2xl font-black text-text-main">Payout history</h2><button class="text-sm font-bold text-primary hover:underline" :disabled="loadingPayouts" @click="loadPayouts">Refresh</button></div>
      <div v-if="loadingPayouts" class="rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading payouts...</div>
      <div v-else-if="payouts.length === 0" class="rounded-2xl border border-dashed border-bg-alt bg-surface p-10 text-center text-text-muted">No payout batches yet.</div>
      <div v-else class="overflow-x-auto rounded-2xl border border-bg-alt bg-surface"><table class="w-full min-w-[1120px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-5">Seller</th><th class="p-5">Period</th><th class="p-5">Net amount</th><th class="p-5">Items</th><th class="p-5">Reference</th><th class="p-5">Status</th><th class="p-5 text-right">Actions</th></tr></thead><tbody class="divide-y divide-bg-alt"><tr v-for="payout in payouts" :key="payout.id"><td class="p-5"><p class="font-bold text-text-main">{{ sellerOf(payout)?.store_name || 'Seller' }}</p><p class="text-xs text-text-muted">{{ payoutBank(payout).name || '-' }} · {{ payoutBank(payout).account || '-' }}</p></td><td class="p-5 text-sm text-text-muted">{{ formatDate(payout.period_start) }} – {{ formatDate(payout.period_end) }}</td><td class="p-5"><p class="font-black text-text-main">{{ formatIDR(payout.amount) }}</p><p v-if="Number(payout.adjustment_amount)" class="mt-1 text-xs text-text-muted">Gross {{ formatIDR(payout.gross_amount) }} · adjustment {{ formatIDR(payout.adjustment_amount) }}</p></td><td class="p-5 text-sm text-text-muted">{{ payout.seller_payout_items?.length || 0 }}</td><td class="p-5 font-mono text-xs text-text-muted">{{ payout.reference_no || '-' }}</td><td class="p-5"><span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="statusClass(payout.status)">{{ payout.status }}</span></td><td class="p-5"><div v-if="!['paid', 'failed'].includes(payout.status)" class="flex justify-end gap-2"><button v-if="payout.status === 'pending'" class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="updatePayout(payout, 'processing')">Start processing</button><button v-if="payout.status === 'processing'" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="updatePayout(payout, 'paid')">Mark paid</button><button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="updatePayout(payout, 'failed')">Mark failed</button></div><span v-else class="block text-right text-xs text-text-muted">Completed</span></td></tr></tbody></table></div>
    </section>
  </div>
</template>
