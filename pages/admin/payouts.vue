<script setup>
import { onMounted, ref } from 'vue'
import {
  createPayoutBatch,
  getAllPayouts,
  getPayoutCandidates,
  sendPayoutViaXendit,
  setPayoutStatus,
  syncXenditPayout,
} from '../../services/payoutsService'

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
const formatPeriodEnd = (value) => value ? formatDate(new Date(new Date(value).getTime() - 1)) : '-'
const statusClass = (status) => ({ pending: 'bg-amber-100 text-amber-800', processing: 'bg-blue-100 text-blue-700', paid: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-700', reversed: 'bg-purple-100 text-purple-700' }[status] || 'bg-bg-alt text-text-muted')

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
  if (!candidate.payout_ready) {
    errorMessage.value = `${candidate.store_name} must complete all Xendit beneficiary fields first.`
    return
  }
  if (!confirm(`Create and send a ${formatIDR(candidate.amount)} Xendit payout for ${candidate.store_name}?`)) return
  workingId.value = candidate.seller_id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payout = await createPayoutBatch(candidate.seller_id, periodStart.value, periodEnd.value)
    await sendPayoutViaXendit(payout.id)
    successMessage.value = `Payout for ${candidate.store_name} was submitted to Xendit.`
  } catch (error) {
    errorMessage.value = error.data?.statusMessage || error.message || 'Payout could not be submitted to Xendit.'
  } finally {
    await Promise.allSettled([findCandidates(), loadPayouts()])
    workingId.value = null
  }
}

const submitPayout = async (payout) => {
  if (!confirm(`Submit ${formatIDR(payout.amount)} to Xendit?`)) return
  workingId.value = payout.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await sendPayoutViaXendit(payout.id)
    successMessage.value = payout.provider_payout_id
      ? 'The latest Xendit payout status has been applied.'
      : 'Payout submitted to Xendit.'
  } catch (error) {
    errorMessage.value = error.data?.statusMessage || error.message || 'Xendit payout submission failed.'
  } finally {
    await Promise.allSettled([loadPayouts(), findCandidates()])
    workingId.value = null
  }
}

const syncPayout = async (payout) => {
  workingId.value = payout.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await syncXenditPayout(payout.id)
    successMessage.value = 'The latest Xendit payout status has been applied.'
  } catch (error) {
    errorMessage.value = error.data?.statusMessage || error.message || 'Xendit payout status could not be synchronized.'
  } finally {
    await Promise.allSettled([loadPayouts(), findCandidates()])
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
    <div class="mb-8"><h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Seller Payouts</h1><p class="mt-2 text-text-muted">Send mature seller balances through Xendit and reconcile their final status automatically.</p></div>
    <p v-if="errorMessage" class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{{ successMessage }}</p>

    <section class="rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm sm:p-6">
      <h2 class="text-xl font-black text-text-main">Create and send payouts</h2><p class="mt-1 text-sm text-text-muted">The end date is inclusive. Mature unpaid balances from earlier periods, refund debt, and balance corrections are carried forward automatically.</p>
      <form class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" @submit.prevent="findCandidates"><label class="flex-1 text-sm font-bold text-text-main">Period start<input v-model="periodStart" type="date" required class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:border-primary"></label><label class="flex-1 text-sm font-bold text-text-main">Period end<input v-model="periodEnd" type="date" required class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:border-primary"></label><button class="rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60" :disabled="loadingCandidates">{{ loadingCandidates ? 'Calculating...' : 'Calculate eligible payouts' }}</button></form>

      <div v-if="candidates.length" class="mt-6 overflow-x-auto rounded-xl border border-bg-alt"><table class="w-full min-w-[760px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-4">Seller</th><th class="p-4">Destination</th><th class="p-4">Items</th><th class="p-4">Amount</th><th class="p-4 text-right">Action</th></tr></thead><tbody class="divide-y divide-bg-alt"><tr v-for="candidate in candidates" :key="candidate.seller_id"><td class="p-4 font-bold text-text-main">{{ candidate.store_name }}</td><td class="p-4 text-sm"><span :class="candidate.payout_ready ? 'text-text-main' : 'font-semibold text-red-600'">{{ candidate.bank_name || 'Bank missing' }}</span><p class="font-mono text-xs text-text-muted">{{ candidate.bank_account || '-' }}</p><p v-if="!candidate.payout_ready" class="mt-1 text-xs font-semibold text-red-600">Beneficiary profile incomplete</p></td><td class="p-4 text-sm text-text-muted">{{ candidate.item_count }}</td><td class="p-4 font-black text-text-main">{{ formatIDR(candidate.amount) }}</td><td class="p-4 text-right"><button class="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark disabled:opacity-50" :disabled="workingId === candidate.seller_id || !candidate.payout_ready" @click="createBatch(candidate)">{{ workingId === candidate.seller_id ? 'Submitting...' : 'Create & send' }}</button></td></tr></tbody></table></div>
      <p v-else-if="!loadingCandidates" class="mt-5 text-sm text-text-muted">Choose a period and calculate eligible payouts.</p>
    </section>

    <section class="mt-7"><div class="mb-4 flex items-center justify-between"><h2 class="text-2xl font-black text-text-main">Payout history</h2><button class="text-sm font-bold text-primary hover:underline" :disabled="loadingPayouts" @click="loadPayouts">Refresh</button></div>
      <div v-if="loadingPayouts" class="rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading payouts...</div>
      <div v-else-if="payouts.length === 0" class="rounded-2xl border border-dashed border-bg-alt bg-surface p-10 text-center text-text-muted">No payout batches yet.</div>
      <div v-else class="overflow-x-auto rounded-2xl border border-bg-alt bg-surface"><table class="w-full min-w-[1200px] text-left"><thead class="bg-bg-alt/50 text-xs uppercase text-text-muted"><tr><th class="p-5">Seller</th><th class="p-5">Period</th><th class="p-5">Net amount</th><th class="p-5">Items</th><th class="p-5">Reference</th><th class="p-5">Status</th><th class="p-5 text-right">Actions</th></tr></thead><tbody class="divide-y divide-bg-alt"><tr v-for="payout in payouts" :key="payout.id"><td class="p-5"><p class="font-bold text-text-main">{{ sellerOf(payout)?.store_name || 'Seller' }}</p><p class="text-xs text-text-muted">{{ payoutBank(payout).name || '-' }} · {{ payoutBank(payout).account || '-' }}</p></td><td class="p-5 text-sm text-text-muted">{{ formatDate(payout.period_start) }} – {{ formatPeriodEnd(payout.period_end) }}</td><td class="p-5"><p class="font-black text-text-main">{{ formatIDR(payout.amount) }}</p><p v-if="Number(payout.adjustment_amount)" class="mt-1 text-xs text-text-muted">Gross {{ formatIDR(payout.gross_amount) }} · adjustment {{ formatIDR(payout.adjustment_amount) }}</p></td><td class="p-5 text-sm text-text-muted">{{ payout.seller_payout_items?.length || 0 }}</td><td class="p-5"><p class="font-mono text-xs text-text-muted">{{ payout.reference_no || payout.provider_payout_id || '-' }}</p><p v-if="payout.provider_reference_id" class="mt-1 font-mono text-[10px] text-text-muted">{{ payout.provider_reference_id }}</p></td><td class="p-5"><span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="statusClass(payout.status)">{{ payout.status }}</span><p v-if="payout.provider_status" class="mt-2 text-xs font-semibold text-text-muted">Xendit: {{ payout.provider_status }}</p><p v-if="payout.provider_failure_code" class="mt-1 max-w-44 text-xs text-red-600">{{ payout.provider_failure_code }}</p></td><td class="p-5"><div v-if="!['paid', 'failed', 'reversed'].includes(payout.status)" class="flex justify-end gap-2"><template v-if="payout.provider === 'xendit'"><button v-if="payout.provider_payout_id" class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="syncPayout(payout)">{{ workingId === payout.id ? 'Syncing...' : 'Sync Xendit' }}</button><button v-else class="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="submitPayout(payout)">{{ workingId === payout.id ? 'Submitting...' : 'Retry submission' }}</button></template><template v-else-if="payout.status === 'pending'"><button class="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="submitPayout(payout)">{{ workingId === payout.id ? 'Submitting...' : 'Send via Xendit' }}</button></template><template v-else><button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="updatePayout(payout, 'paid')">Mark paid</button><button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="workingId === payout.id" @click="updatePayout(payout, 'failed')">Mark failed</button></template></div><span v-else class="block text-right text-xs text-text-muted">Provider finalized</span></td></tr></tbody></table></div>
    </section>
  </div>
</template>
