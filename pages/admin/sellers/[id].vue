<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAdminSellerDetails } from '../../../services/adminSellerDetailsService'
import { sUpdateSellerCommission } from '../../../services/sellersService'

const route = useRoute()
const sellerId = computed(() => Array.isArray(route.params.id) ? route.params.id[0] : route.params.id)
const seller = ref(null)
const products = ref([])
const payouts = ref([])
const commissionPercent = ref(10)
const loading = ref(true)
const savingCommission = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const formatIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-'
const statusClass = (status) => ({ approved: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-800', rejected: 'bg-red-100 text-red-700', suspended: 'bg-slate-200 text-slate-700', published: 'bg-emerald-100 text-emerald-800', pending_review: 'bg-amber-100 text-amber-800', paid: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-700', processing: 'bg-blue-100 text-blue-700' }[status] || 'bg-bg-alt text-text-muted')

const loadDetails = async () => {
  try {
    const data = await getAdminSellerDetails(sellerId.value)
    seller.value = data.seller
    products.value = data.products
    payouts.value = data.payouts
    commissionPercent.value = Number((Number(data.seller.commission_rate) * 100).toFixed(2))
  } catch (error) {
    errorMessage.value = error.message || 'Seller details could not be loaded.'
  } finally {
    loading.value = false
  }
}

const saveCommission = async () => {
  savingCommission.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const updated = await sUpdateSellerCommission(seller.value.id, commissionPercent.value)
    seller.value.commission_rate = updated.commission_rate
    successMessage.value = 'Commission rate updated.'
  } catch (error) {
    errorMessage.value = error.message || 'Commission rate could not be updated.'
  } finally {
    savingCommission.value = false
  }
}

onMounted(loadDetails)
</script>

<template>
  <div class="mx-auto max-w-6xl font-poppins">
    <NuxtLink to="/admin/sellers" class="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-primary">← Back to sellers</NuxtLink>
    <div v-if="loading" class="mt-6 rounded-2xl border border-bg-alt bg-surface p-12 text-center text-text-muted">Loading seller details...</div>
    <p v-else-if="errorMessage && !seller" class="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{{ errorMessage }}</p>
    <template v-else-if="seller">
      <section class="mt-6 rounded-3xl border border-bg-alt bg-surface p-6 shadow-sm sm:p-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-bg-alt text-3xl font-black text-text-muted"><img v-if="seller.store_image_url" :src="seller.store_image_url" :alt="seller.store_name" class="h-full w-full object-cover"><span v-else>{{ seller.store_name?.charAt(0) || 'S' }}</span></div>
          <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-3"><h1 class="text-3xl font-black text-text-main">{{ seller.store_name }}</h1><span class="rounded-full px-3 py-1 text-xs font-bold capitalize" :class="statusClass(seller.status)">{{ seller.status }}</span></div><p class="mt-2 text-sm text-primary">/stores/{{ seller.store_slug }}</p><p class="mt-3 max-w-2xl text-text-muted">{{ seller.store_description || 'No store description.' }}</p></div>
          <NuxtLink v-if="seller.status === 'approved'" :to="`/stores/${seller.store_slug}`" class="rounded-xl border border-bg-alt px-4 py-2.5 text-sm font-bold text-text-main hover:text-primary">Open store</NuxtLink>
        </div>
      </section>

      <p v-if="errorMessage" class="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{{ errorMessage }}</p>
      <p v-if="successMessage" class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{{ successMessage }}</p>

      <section class="mt-6 grid gap-5 lg:grid-cols-3">
        <article class="rounded-2xl border border-bg-alt bg-surface p-5 lg:col-span-2"><h2 class="text-lg font-black text-text-main">Private payout information</h2><div class="mt-4 grid gap-4 sm:grid-cols-2"><div><p class="text-xs font-bold uppercase text-text-muted">Bank</p><p class="mt-1 font-semibold text-text-main">{{ seller.bank_name || 'Not provided' }}</p></div><div><p class="text-xs font-bold uppercase text-text-muted">Account number</p><p class="mt-1 font-mono font-semibold text-text-main">{{ seller.bank_account || 'Not provided' }}</p></div><div><p class="text-xs font-bold uppercase text-text-muted">Profile ID</p><p class="mt-1 break-all font-mono text-sm text-text-main">{{ seller.profile_id }}</p></div><div><p class="text-xs font-bold uppercase text-text-muted">Joined</p><p class="mt-1 font-semibold text-text-main">{{ formatDate(seller.created_at) }}</p></div></div></article>
        <form class="rounded-2xl border border-bg-alt bg-surface p-5" @submit.prevent="saveCommission"><h2 class="text-lg font-black text-text-main">Platform commission</h2><p class="mt-1 text-xs text-text-muted">Applied to future purchases only.</p><label class="mt-5 block text-sm font-bold text-text-main">Commission percent<input v-model.number="commissionPercent" type="number" min="0" max="100" step="0.01" required class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none focus:border-primary"></label><button class="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-bold text-white hover:bg-primary-dark disabled:opacity-60" :disabled="savingCommission">{{ savingCommission ? 'Saving...' : 'Save commission' }}</button></form>
      </section>

      <section class="mt-6 rounded-2xl border border-bg-alt bg-surface p-5"><div class="flex items-center justify-between"><h2 class="text-xl font-black text-text-main">Products</h2><span class="text-sm font-bold text-text-muted">{{ products.length }} items</span></div><div v-if="products.length" class="mt-4 divide-y divide-bg-alt"><div v-for="product in products" :key="product.id" class="flex flex-wrap items-center justify-between gap-3 py-4"><div><NuxtLink :to="`/products/${product.slug}`" class="font-bold text-text-main hover:text-primary">{{ product.name }}</NuxtLink><p class="mt-1 text-xs text-text-muted">{{ formatIDR(product.price) }} · {{ formatDate(product.created_at) }}</p></div><span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="statusClass(product.status)">{{ product.status.replace('_', ' ') }}</span></div></div><p v-else class="mt-5 text-sm text-text-muted">No products.</p></section>

      <section class="mt-6 rounded-2xl border border-bg-alt bg-surface p-5"><div class="flex items-center justify-between"><h2 class="text-xl font-black text-text-main">Payout history</h2><span class="text-sm font-bold text-text-muted">{{ payouts.length }} batches</span></div><div v-if="payouts.length" class="mt-4 divide-y divide-bg-alt"><div v-for="payout in payouts" :key="payout.id" class="grid gap-3 py-4 sm:grid-cols-4 sm:items-center"><div><p class="font-black text-text-main">{{ formatIDR(payout.amount) }}</p><p class="mt-1 font-mono text-xs text-text-muted">{{ payout.reference_no || payout.id }}</p></div><p class="text-sm text-text-muted">{{ formatDate(payout.period_start) }} – {{ formatDate(payout.period_end) }}</p><span class="w-fit rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="statusClass(payout.status)">{{ payout.status }}</span><p class="text-sm text-text-muted sm:text-right">{{ formatDate(payout.paid_at || payout.created_at) }}</p></div></div><p v-else class="mt-5 text-sm text-text-muted">No payouts yet.</p></section>
    </template>
  </div>
</template>
