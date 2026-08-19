<script setup>
import { onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../../services/sellerService'
import { sGetSellerProducts } from '../../../services/sellerProductsService'

const products = ref([])
const loading = ref(true)
const errorMessage = ref('')

const statusClasses = {
  draft: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700',
}

const formatStatus = (status) => String(status || '').replace(/_/g, ' ')
const formatIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value) || 0)

onMounted(async () => {
  try {
    const seller = await getCurrentSeller()
    if (!seller) throw new Error('Seller profile was not found.')
    products.value = await sGetSellerProducts(seller.id)
  } catch (error) {
    errorMessage.value = error.message || 'Unable to load your products.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto py-8 font-poppins">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <p class="text-sm font-bold uppercase tracking-[0.16em] text-primary">Seller workspace</p>
        <h1 class="mt-1 text-3xl font-black text-text-main">My products</h1>
        <p class="mt-2 text-text-muted">New and edited products are reviewed before they are published.</p>
      </div>
      <NuxtLink to="/seller/products/new" class="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-dark">
        Add product
      </NuxtLink>
    </div>

    <div v-if="loading" class="rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading products...</div>
    <div v-else-if="errorMessage" class="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{{ errorMessage }}</div>
    <div v-else-if="products.length === 0" class="rounded-2xl border border-dashed border-bg-alt bg-surface p-10 text-center">
      <h2 class="text-xl font-bold text-text-main">No products yet</h2>
      <p class="mt-2 text-text-muted">Create your first product and submit it for review.</p>
    </div>
    <div v-else class="overflow-hidden rounded-2xl border border-bg-alt bg-surface">
      <div v-for="product in products" :key="product.id" class="flex flex-col gap-4 border-b border-bg-alt p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="truncate text-lg font-black text-text-main">{{ product.name }}</h2>
            <span :class="['rounded-full px-2.5 py-1 text-xs font-bold capitalize', statusClasses[product.status] || 'bg-slate-100 text-slate-700']">{{ formatStatus(product.status) }}</span>
          </div>
          <p class="mt-1 line-clamp-1 text-sm text-text-muted">{{ product.description }}</p>
          <p class="mt-2 font-bold text-text-main">{{ formatIDR(product.price) }}</p>
        </div>
        <NuxtLink :to="`/seller/products/${product.id}/edit`" class="inline-flex shrink-0 items-center justify-center rounded-xl border border-primary/25 px-4 py-2.5 font-bold text-primary hover:bg-primary/5">Edit</NuxtLink>
      </div>
    </div>
  </div>
</template>
