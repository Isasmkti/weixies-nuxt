<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getCurrentSeller } from '../../../services/sellerService'
import { sGetSellerProducts } from '../../../services/sellerProductsService'

const products = ref([])
const loading = ref(true)
const errorMessage = ref('')
const searchQuery = ref('')
const statusFilter = ref('all')
const categoryFilter = ref('all')
const currentPage = ref(1)
const pageSize = 8

const statusClasses = {
  draft: 'border-slate-300 bg-slate-100 text-slate-700',
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
  published: 'border-primary/20 bg-primary/10 text-primary',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  suspended: 'border-red-200 bg-red-50 text-red-700',
}

const formatStatus = (status) => ({
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Aktif',
  rejected: 'Ditolak',
  suspended: 'Ditangguhkan',
}[status] || String(status || '-').replace(/_/g, ' '))

const formatIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value) || 0)

const productImage = (product) => {
  const images = product.product_images || []
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
}

const productCategories = (product) => (product.product_categories || [])
  .map((item) => Array.isArray(item.categories) ? item.categories[0] : item.categories)
  .filter(Boolean)

const categoryOptions = computed(() => {
  const categoryMap = new Map()
  products.value.forEach((product) => {
    productCategories(product).forEach((category) => categoryMap.set(String(category.id), category))
  })
  return [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return products.value.filter((product) => {
    const searchMatches = !query || product.name.toLowerCase().includes(query)
    const statusMatches = statusFilter.value === 'all' || product.status === statusFilter.value
    const categoryMatches = categoryFilter.value === 'all'
      || productCategories(product).some((category) => String(category.id) === categoryFilter.value)
    return searchMatches && statusMatches && categoryMatches
  })
})

const totalPages = computed(() => Math.max(Math.ceil(filteredProducts.value.length / pageSize), 1))
const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredProducts.value.slice(start, start + pageSize)
})
const rangeStart = computed(() => filteredProducts.value.length ? ((currentPage.value - 1) * pageSize) + 1 : 0)
const rangeEnd = computed(() => Math.min(currentPage.value * pageSize, filteredProducts.value.length))

watch([searchQuery, statusFilter, categoryFilter], () => {
  currentPage.value = 1
})
watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

const loadProducts = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const seller = await getCurrentSeller()
    if (!seller) throw new Error('Seller profile was not found.')
    products.value = await sGetSellerProducts(seller.id)
  } catch (error) {
    errorMessage.value = error.message || 'Unable to load your products.'
  } finally {
    loading.value = false
  }
}

onMounted(loadProducts)
</script>

<template>
  <div class="mx-auto flex max-w-[1280px] flex-col gap-8 py-4 font-[Inter,sans-serif] md:py-6">
    <header class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Seller workspace</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-text-main md:text-5xl">Manajemen Produk</h1>
        <p class="mt-3 text-base text-text-muted md:text-lg">Kelola katalog aset digital Anda, perbarui harga, dan pantau status publikasi.</p>
      </div>
      <NuxtLink to="/seller/products/new" class="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Tambah Produk Baru
      </NuxtLink>
    </header>

    <section class="flex flex-col items-center justify-between gap-4 rounded-xl border border-bg-alt bg-surface p-4 shadow-[0_4px_24px_rgba(15,23,42,0.05)] md:flex-row">
      <label class="relative block w-full md:w-96">
        <span class="sr-only">Cari nama produk</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
        <input v-model="searchQuery" type="search" placeholder="Cari nama produk..." class="w-full rounded-lg border border-bg-alt bg-bg py-2.5 pl-10 pr-4 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
      </label>
      <div class="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
        <label class="flex items-center gap-2">
          <span class="hidden text-sm font-medium text-text-muted md:block">Status:</span>
          <select v-model="statusFilter" class="w-full cursor-pointer appearance-none rounded-lg border border-bg-alt bg-bg px-4 py-2.5 text-sm text-text-main outline-none focus:border-primary sm:w-auto">
            <option value="all">Semua Status</option>
            <option value="published">Aktif</option>
            <option value="pending_review">Menunggu Review</option>
            <option value="draft">Draft</option>
            <option value="rejected">Ditolak</option>
            <option value="suspended">Ditangguhkan</option>
          </select>
        </label>
        <select v-model="categoryFilter" class="w-full cursor-pointer appearance-none rounded-lg border border-bg-alt bg-bg px-4 py-2.5 text-sm text-text-main outline-none focus:border-primary sm:w-auto">
          <option value="all">Semua Kategori</option>
          <option v-for="category in categoryOptions" :key="category.id" :value="String(category.id)">{{ category.name }}</option>
        </select>
      </div>
    </section>

    <div v-if="loading" class="rounded-xl border border-bg-alt bg-surface p-12 text-center shadow-sm">
      <span class="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span>
      <p class="mt-4 text-sm font-medium text-text-muted">Memuat produk...</p>
    </div>

    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
      <p class="font-bold">Produk tidak dapat dimuat.</p><p class="mt-1 text-sm">{{ errorMessage }}</p>
      <button class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white" @click="loadProducts">Coba lagi</button>
    </div>

    <div v-else-if="products.length === 0" class="rounded-xl border border-dashed border-bg-alt bg-surface p-12 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="m21 8-9 5-9-5m9 5v9m9-14-9-5-9 5v9l9 5 9-5V8Z" /></svg></div>
      <h2 class="mt-4 text-xl font-bold text-text-main">Belum ada produk</h2><p class="mt-2 text-sm text-text-muted">Buat produk pertama Anda dan kirimkan untuk direview.</p>
      <NuxtLink to="/seller/products/new" class="mt-5 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white">Tambah Produk</NuxtLink>
    </div>

    <section v-else class="overflow-hidden rounded-xl border border-bg-alt bg-surface shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr class="border-b border-bg-alt bg-bg-alt/50">
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Produk</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Kategori</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Harga</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
              <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-bg-alt text-sm">
            <tr v-if="paginatedProducts.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-text-muted">Tidak ada produk yang sesuai dengan filter.</td>
            </tr>
            <tr v-for="product in paginatedProducts" :key="product.id" class="group transition-colors hover:bg-bg/70">
              <td class="px-6 py-4">
                <div class="flex items-center gap-4">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg-alt bg-bg-alt text-text-muted">
                    <img v-if="productImage(product)" :src="productImage(product)" :alt="product.name" class="h-full w-full object-cover">
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5A1.5 1.5 0 0 0 21.75 18V6A1.5 1.5 0 0 0 20.25 4.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" /></svg>
                  </div>
                  <div class="min-w-0"><p class="max-w-xs truncate font-bold text-text-main">{{ product.name }}</p><p class="mt-1 text-xs text-text-muted">Terjual: {{ product.sales_count || 0 }}</p></div>
                </div>
              </td>
              <td class="px-6 py-4 text-text-muted">
                <div class="flex max-w-[240px] flex-wrap gap-1.5"><span v-for="category in productCategories(product)" :key="category.id" class="rounded-md bg-bg-alt px-2 py-1 text-xs font-medium text-text-main">{{ category.name }}</span><span v-if="productCategories(product).length === 0">Tanpa kategori</span></div>
              </td>
              <td class="whitespace-nowrap px-6 py-4 font-semibold text-text-main">{{ formatIDR(product.price) }}</td>
              <td class="px-6 py-4"><span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold" :class="statusClasses[product.status] || 'border-bg-alt bg-bg-alt text-text-muted'">{{ formatStatus(product.status) }}</span></td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <NuxtLink v-if="product.status === 'published'" :to="`/products/${product.slug}`" class="rounded-lg p-2 text-text-muted transition hover:bg-bg-alt hover:text-primary" title="Lihat produk" aria-label="Lihat produk"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .638C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg></NuxtLink>
                  <NuxtLink :to="`/seller/products/${product.id}/edit`" class="rounded-lg p-2 text-text-muted transition hover:bg-bg-alt hover:text-primary" title="Edit produk" aria-label="Edit produk"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></NuxtLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="flex flex-col items-center justify-between gap-3 border-t border-bg-alt bg-bg/50 p-4 sm:flex-row">
        <span class="text-sm text-text-muted">Menampilkan {{ rangeStart }}–{{ rangeEnd }} dari {{ filteredProducts.length }} produk</span>
        <div class="flex items-center gap-1">
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-bg-alt disabled:opacity-40" :disabled="currentPage === 1" aria-label="Halaman sebelumnya" @click="currentPage -= 1"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7" /></svg></button>
          <button v-for="page in totalPages" :key="page" type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition" :class="currentPage === page ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-alt'" @click="currentPage = page">{{ page }}</button>
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-bg-alt disabled:opacity-40" :disabled="currentPage === totalPages" aria-label="Halaman berikutnya" @click="currentPage += 1"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg></button>
        </div>
      </footer>
    </section>
  </div>
</template>
