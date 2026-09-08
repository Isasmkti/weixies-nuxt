<script setup>
import { computed, ref, watch } from 'vue'
import defaultProduct from '../components/defaultProduct.vue'
import { searchMarketplace } from '../services/marketplaceSearchService'
import {
  MIN_MARKETPLACE_SEARCH_LENGTH,
  normalizeMarketplaceSearchQuery,
} from '../utils/marketplaceSearch'
import { formatIDR } from '../utils/currency'

const route = useRoute()
const router = useRouter()
const activeTab = ref('all')
const searchInput = ref('')
const submittedQuery = computed(() => normalizeMarketplaceSearchQuery(route.query.q))

watch(submittedQuery, (query) => {
  searchInput.value = query
  activeTab.value = 'all'
}, { immediate: true })

const { data: results, status, error, refresh } = await useAsyncData(
  () => `marketplace-search:${submittedQuery.value.toLocaleLowerCase()}`,
  () => searchMarketplace(submittedQuery.value),
  { watch: [submittedQuery] },
)

const products = computed(() => results.value?.products || [])
const sellers = computed(() => results.value?.sellers || [])
const hasResults = computed(() => products.value.length > 0 || sellers.value.length > 0)
const isSearching = computed(() => submittedQuery.value.length >= MIN_MARKETPLACE_SEARCH_LENGTH && status.value === 'pending')
const queryIsTooShort = computed(() => submittedQuery.value.length > 0 && submittedQuery.value.length < MIN_MARKETPLACE_SEARCH_LENGTH)
const showProducts = computed(() => activeTab.value === 'all' || activeTab.value === 'products')
const showSellers = computed(() => activeTab.value === 'all' || activeTab.value === 'sellers')
const tabs = computed(() => [
  { id: 'all', label: 'All', count: products.value.length + sellers.value.length },
  { id: 'products', label: 'Products', count: products.value.length },
  { id: 'sellers', label: 'Sellers', count: sellers.value.length },
])

const submitSearch = async () => {
  const query = normalizeMarketplaceSearchQuery(searchInput.value)
  searchInput.value = query

  if (query === submittedQuery.value) {
    if (query.length >= MIN_MARKETPLACE_SEARCH_LENGTH) await refresh()
    return
  }

  await router.push({ path: '/search', query: query ? { q: query } : {} })
}

const clearSearch = async () => {
  searchInput.value = ''
  await router.push('/search')
}

useSeoMeta({
  title: () => submittedQuery.value ? `Search for ${submittedQuery.value}` : 'Search Marketplace',
  description: 'Search digital products and approved sellers on the Weixies marketplace.',
  robots: 'noindex, follow',
})
</script>

<template>
  <div class="mx-auto max-w-[1500px] font-poppins">
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">Marketplace search</p>
      <h1 class="mt-2 text-3xl font-black tracking-tight text-text-main sm:text-4xl">Find products and sellers</h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-text-muted">Search across published digital products and verified marketplace stores.</p>
    </header>

    <form class="mt-7 w-full" role="search" @submit.prevent="submitSearch">
      <label for="marketplace-search" class="sr-only">Search products and sellers</label>
      <div class="relative rounded-2xl border border-bg-alt bg-surface shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
        <svg class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M16.65 11A5.65 5.65 0 1 1 5.35 11a5.65 5.65 0 0 1 11.3 0Z" /></svg>
        <input id="marketplace-search" v-model="searchInput" type="search" maxlength="80" autocomplete="off" placeholder="Search products, assets, or sellers..." class="h-14 w-full rounded-2xl bg-transparent pl-12 pr-28 text-sm font-medium text-text-main outline-none placeholder:text-text-muted sm:pr-32">
        <button v-if="searchInput" type="button" class="absolute right-[5.5rem] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-alt hover:text-text-main sm:right-24" aria-label="Clear search" @click="clearSearch">&times;</button>
        <button type="submit" class="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:text-sm" :disabled="!searchInput.trim() || isSearching">
          {{ isSearching ? 'Searching...' : 'Search' }}
        </button>
      </div>
      <p v-if="queryIsTooShort" class="mt-2 text-center text-xs font-semibold text-danger">Enter at least {{ MIN_MARKETPLACE_SEARCH_LENGTH }} characters.</p>
    </form>

    <section v-if="!submittedQuery" class="mt-12 w-full rounded-3xl border border-dashed border-bg-alt bg-surface px-6 py-12 text-center sm:px-10">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 7h18M5 7l1 13h12l1-13M9 11v5m6-5v5M9 4h6" /></svg>
      </div>
      <h2 class="mt-5 text-xl font-black text-text-main">What are you looking for?</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">Enter a product name, digital asset type, keyword, or store name to start searching.</p>
      <div class="mt-6 flex flex-wrap justify-center gap-2 text-xs font-semibold text-text-muted">
        <span class="rounded-full bg-bg-alt px-3 py-1.5">UI templates</span>
        <span class="rounded-full bg-bg-alt px-3 py-1.5">Icons</span>
        <span class="rounded-full bg-bg-alt px-3 py-1.5">Store names</span>
      </div>
    </section>

    <section v-else-if="queryIsTooShort" class="mt-10 w-full rounded-2xl border border-bg-alt bg-surface p-8 text-center text-sm text-text-muted">
      Add another character to search the marketplace.
    </section>

    <section v-else-if="isSearching" class="mt-10" aria-live="polite" aria-label="Searching marketplace">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="index in 8" :key="index" class="overflow-hidden rounded-2xl border border-bg-alt bg-surface animate-pulse motion-reduce:animate-none"><div class="aspect-[4/3] bg-bg-alt"></div><div class="space-y-2 p-4"><div class="h-4 w-3/4 rounded bg-bg-alt"></div><div class="h-3 w-1/2 rounded bg-bg-alt"></div></div></div>
      </div>
    </section>

    <section v-else-if="error" class="mt-10 w-full rounded-2xl border border-danger/20 bg-surface p-8 text-center">
      <h2 class="font-black text-text-main">Search could not be completed</h2>
      <p class="mt-2 text-sm text-danger">{{ error.message || 'Please try again.' }}</p>
      <button type="button" class="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark" @click="refresh">Try again</button>
    </section>

    <template v-else>
      <div v-if="hasResults" class="mt-10 flex items-center justify-between gap-4 border-b border-bg-alt">
        <div class="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Search result type">
          <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" class="relative shrink-0 px-4 py-3 text-sm font-bold transition" :class="activeTab === tab.id ? 'text-primary' : 'text-text-muted hover:text-text-main'" @click="activeTab = tab.id">
            {{ tab.label }} <span class="ml-1 text-xs">{{ tab.count }}</span>
            <span v-if="activeTab === tab.id" class="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"></span>
          </button>
        </div>
        <p class="hidden truncate text-xs text-text-muted sm:block">Results for “{{ submittedQuery }}”</p>
      </div>

      <div v-if="!hasResults" class="mt-10 w-full rounded-3xl border border-dashed border-bg-alt bg-surface px-6 py-12 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-alt text-text-muted">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m21 21-4.35-4.35M16.65 11A5.65 5.65 0 1 1 5.35 11a5.65 5.65 0 0 1 11.3 0Z" /></svg>
        </div>
        <h2 class="mt-5 text-xl font-black text-text-main">No matches found</h2>
        <p class="mt-2 text-sm text-text-muted">Try a shorter keyword, check the spelling, or browse the full catalog.</p>
        <NuxtLink to="/products" class="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark">Browse catalog</NuxtLink>
      </div>

      <section v-if="hasResults && showSellers" class="mt-9">
        <div class="flex items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Verified stores</p><h2 class="mt-1 text-2xl font-black text-text-main">Sellers</h2></div><button v-if="activeTab === 'all' && sellers.length" type="button" class="text-sm font-bold text-primary hover:underline" @click="activeTab = 'sellers'">See sellers</button></div>
        <div v-if="sellers.length" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NuxtLink v-for="seller in sellers" :key="seller.id" :to="`/stores/${seller.store_slug}`" class="group flex min-w-0 items-center gap-3 rounded-2xl border border-bg-alt bg-surface p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 font-black text-primary"><img v-if="seller.store_image_url" :src="seller.store_image_url" :alt="seller.store_name" class="h-full w-full object-cover"><span v-else>{{ seller.store_name?.charAt(0)?.toUpperCase() || 'S' }}</span></div>
            <div class="min-w-0 flex-1"><h3 class="truncate text-sm font-black text-text-main transition group-hover:text-primary">{{ seller.store_name }}</h3><p class="mt-1 line-clamp-1 text-xs text-text-muted">{{ seller.store_description || 'Verified marketplace seller' }}</p></div>
            <svg class="h-4 w-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
          </NuxtLink>
        </div>
        <p v-else class="mt-4 rounded-2xl border border-dashed border-bg-alt bg-surface p-7 text-center text-sm text-text-muted">No sellers matched this search.</p>
      </section>

      <section v-if="hasResults && showProducts" class="mt-10">
        <div class="flex items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Digital marketplace</p><h2 class="mt-1 text-2xl font-black text-text-main">Products</h2></div><button v-if="activeTab === 'all' && products.length" type="button" class="text-sm font-bold text-primary hover:underline" @click="activeTab = 'products'">See products</button></div>
        <div v-if="products.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          <NuxtLink v-for="product in products" :key="product.id" :to="`/products/${product.slug}`" class="group flex min-h-full flex-col overflow-hidden rounded-xl border border-bg-alt bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
            <div class="aspect-[4/3] overflow-hidden bg-bg-alt"><img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"><defaultProduct v-else class="h-full w-full p-8 text-text-muted/50" /></div>
            <div class="flex flex-1 flex-col p-3"><h3 class="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-text-main transition group-hover:text-primary sm:text-[15px]">{{ product.name }}</h3><p class="mt-1 truncate text-[11px] text-text-muted">{{ product.seller?.store_name || 'Weixies' }}</p><div class="mt-3 flex items-end justify-between gap-2"><span class="truncate text-base font-black text-primary">{{ formatIDR(product.price) }}</span><span v-if="product.review_count" class="shrink-0 text-[11px] font-bold text-text-muted"><span class="text-amber-500">★</span> {{ product.average_rating.toFixed(1) }}</span></div></div>
          </NuxtLink>
        </div>
        <p v-else class="mt-4 rounded-2xl border border-dashed border-bg-alt bg-surface p-7 text-center text-sm text-text-muted">No products matched this search.</p>
      </section>
    </template>
  </div>
</template>
