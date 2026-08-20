<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getProductsForModeration, setProductModerationStatus } from '../../../services/adminProductModerationService'

const products = ref([])
const statusFilter = ref('pending_review')
const loading = ref(true)
const updatingId = ref(null)
const errorMessage = ref('')

const pendingCount = computed(() => products.value.filter((product) => product.status === 'pending_review').length)
const statusClasses = {
  pending_review: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-slate-200 text-slate-700',
}

const productImage = (product) => {
  const images = product.product_images || []
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
}
const sellerOf = (product) => Array.isArray(product.seller) ? product.seller[0] : product.seller
const formatIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '-'

const loadProducts = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    products.value = await getProductsForModeration(statusFilter.value)
  } catch (error) {
    errorMessage.value = error.message || 'Products could not be loaded.'
  } finally {
    loading.value = false
  }
}

const updateStatus = async (product, status) => {
  const verb = status === 'published' ? 'approve' : status === 'rejected' ? 'reject' : 'suspend'
  if (!confirm(`Are you sure you want to ${verb} ${product.name}?`)) return

  updatingId.value = product.id
  errorMessage.value = ''
  try {
    const updated = await setProductModerationStatus(product.id, status)
    if (statusFilter.value === 'all' || statusFilter.value === status) {
      const index = products.value.findIndex((item) => item.id === product.id)
      if (index !== -1) products.value[index] = updated
    } else {
      products.value = products.value.filter((item) => item.id !== product.id)
    }
  } catch (error) {
    errorMessage.value = error.message || 'Product status could not be updated.'
  } finally {
    updatingId.value = null
  }
}

watch(statusFilter, loadProducts)
onMounted(loadProducts)
</script>

<template>
  <div class="mx-auto max-w-[1600px] font-poppins">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Product Review</h1>
          <span v-if="statusFilter === 'pending_review' && pendingCount" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{{ pendingCount }} waiting</span>
        </div>
        <p class="mt-2 text-text-muted">Review seller submissions before they appear in the marketplace.</p>
      </div>
      <button class="rounded-xl border border-bg-alt bg-surface px-5 py-3 font-bold text-text-main hover:bg-bg-alt disabled:opacity-60" :disabled="loading" @click="loadProducts">{{ loading ? 'Refreshing...' : 'Refresh' }}</button>
    </div>

    <div class="mb-6 flex flex-wrap gap-2">
      <button v-for="status in ['pending_review', 'published', 'rejected', 'suspended', 'all']" :key="status" class="rounded-xl px-4 py-2 text-sm font-bold capitalize transition" :class="statusFilter === status ? 'bg-primary text-white' : 'border border-bg-alt bg-surface text-text-muted hover:text-text-main'" @click="statusFilter = status">{{ status.replace('_', ' ') }}</button>
    </div>

    <p v-if="errorMessage" class="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading product submissions...</div>
    <div v-else-if="products.length === 0" class="rounded-2xl border border-dashed border-bg-alt bg-surface p-10 text-center"><h2 class="text-xl font-bold text-text-main">No products found</h2><p class="mt-2 text-sm text-text-muted">There are no products with this status.</p></div>
    <div v-else class="space-y-4">
      <article v-for="product in products" :key="product.id" class="rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div class="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-bg-alt sm:w-32">
            <img v-if="productImage(product)" :src="productImage(product)" :alt="product.name" class="h-full w-full object-cover">
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-xl font-black text-text-main">{{ product.name }}</h2>
              <span class="rounded-full px-2.5 py-1 text-[11px] font-bold capitalize" :class="statusClasses[product.status] || 'bg-bg-alt text-text-muted'">{{ product.status.replace('_', ' ') }}</span>
            </div>
            <p class="mt-1 text-sm font-semibold text-primary">{{ sellerOf(product)?.store_name || 'Unknown store' }}</p>
            <p class="mt-2 line-clamp-2 text-sm text-text-muted">{{ product.description }}</p>
            <div class="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-text-muted"><span>{{ formatIDR(product.price) }}</span><span>Submitted {{ formatDate(product.created_at) }}</span></div>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <NuxtLink :to="`/products/${product.slug}`" class="rounded-lg border border-bg-alt px-3 py-2 text-xs font-bold text-text-main hover:text-primary">Preview</NuxtLink>
            <button v-if="product.status !== 'published'" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60" :disabled="updatingId === product.id" @click="updateStatus(product, 'published')">Approve</button>
            <button v-if="product.status === 'pending_review'" class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60" :disabled="updatingId === product.id" @click="updateStatus(product, 'rejected')">Reject</button>
            <button v-if="product.status === 'published'" class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60" :disabled="updatingId === product.id" @click="updateStatus(product, 'suspended')">Suspend</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
