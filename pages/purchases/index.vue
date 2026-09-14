<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePurchasesStore } from '../../stores/purchasesStore'
import { usePurchaseDownload } from '../../composables/usePurchaseDownload'
import { showErrorDialog } from '../../utils/sweetAlert'
import { formatIDR } from '../../utils/currency'

const route = useRoute()
const purchases = usePurchasesStore()
const { downloadPurchase } = usePurchaseDownload()
const search = ref('')
const downloading = ref({})
const requestedProduct = computed(() => String(route.query.product || '').trim() || null)
let searchTimer = null
let mounted = false

useHead({ title: 'My Purchases' })

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
  : '-'

const loadPurchases = (page = 1, force = false) => purchases.fetchPurchases({
  page, search: search.value, productId: requestedProduct.value, force,
})

const downloadLabel = purchase => {
  if (downloading.value[purchase.product_id]) return 'Preparing download...'
  if (!purchase.product_available || !purchase.file_available) return 'File unavailable'
  if (!purchase.downloads_remaining) return 'Download limit reached'
  return purchase.is_downloaded ? 'Download again' : 'Download ZIP'
}

const download = async (purchase) => {
  const key = String(purchase.product_id)
  if (downloading.value[key] || !purchase.can_download) return
  const account = purchases.profileId
  downloading.value = { ...downloading.value, [key]: true }
  try {
    const result = await downloadPurchase({ orderId: purchase.order_id, productId: purchase.product_id })
    if (purchases.profileId === account) purchases.applyDownload(purchase.product_id, result)
  } catch (error) {
    if (purchases.profileId === account) {
      await showErrorDialog('Download unavailable', error?.data?.statusMessage || error?.message || 'Your file could not be downloaded. Please try again.')
      await loadPurchases(purchases.page, true)
    }
  } finally {
    const next = { ...downloading.value }
    delete next[key]
    downloading.value = next
  }
}

const goToPage = async (page) => {
  if (purchases.loading || page < 1 || page > purchases.totalPages) return
  await loadPurchases(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadPurchases(1), 350)
})
watch(requestedProduct, () => { if (mounted) loadPurchases(1) })
const refreshOnFocus = () => loadPurchases(purchases.page)

onMounted(() => {
  mounted = true
  loadPurchases(1, true)
  window.addEventListener('focus', refreshOnFocus)
})
onBeforeUnmount(() => {
  mounted = false
  clearTimeout(searchTimer)
  window.removeEventListener('focus', refreshOnFocus)
})
</script>

<template>
  <div class="mx-auto min-w-0 max-w-7xl pb-20 pt-2 font-poppins sm:pt-4 md:pt-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <NuxtLink to="/dashboard" class="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-primary">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m14 6-6 6 6 6" /></svg>
          Dashboard
        </NuxtLink>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-text-main">My Purchases</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Your paid products, purchased licenses, and downloads in one place.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/orders" class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-main transition hover:border-primary/40 hover:text-primary">My orders</NuxtLink>
        <button type="button" :disabled="purchases.loading" class="rounded-ui-sm bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60" @click="loadPurchases(purchases.page, true)">{{ purchases.loading ? 'Refreshing...' : 'Refresh' }}</button>
      </div>
    </header>

    <details class="group mt-6 rounded-ui-md bg-primary/5 px-4 py-3 text-sm text-text-muted ring-1 ring-inset ring-primary/15">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-text-main">
        <span class="flex items-center gap-2"><svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="1.8" d="M12 8h.01M11 12h1v4h1m8-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>How download limits work</span>
        <svg class="h-4 w-4 text-text-muted transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
      </summary>
      <p class="mt-2 max-w-4xl pl-6 text-xs leading-6 sm:text-sm">Each approved product version includes <strong class="text-text-main">3 downloads</strong>. A newly published version receives a fresh allowance. A download is counted when the transfer starts, including interrupted transfers.</p>
    </details>

    <div class="mt-5 flex flex-col gap-3 rounded-ui-md bg-surface p-3 shadow-elevation-1 sm:flex-row sm:items-center sm:justify-between">
      <label class="relative block w-full sm:max-w-sm">
        <span class="sr-only">Search your purchased products</span>
        <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="1.8" d="m21 21-4.3-4.3M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" /></svg>
        <input v-model="search" type="search" maxlength="120" placeholder="Search purchases..." class="min-h-10 w-full rounded-ui-sm border border-border bg-bg py-2 pl-10 pr-4 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15">
      </label>
      <p v-if="!purchases.loading" class="text-sm text-text-muted">{{ purchases.total }} {{ purchases.total === 1 ? 'purchase' : 'purchases' }}</p>
    </div>

    <div v-if="requestedProduct" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-ui-md border border-border bg-surface px-4 py-3 text-sm">
      <span class="text-text-muted">Showing your selected product.</span>
      <NuxtLink to="/purchases" class="font-semibold text-primary hover:underline">View all purchases</NuxtLink>
    </div>

    <div v-if="purchases.loading" class="mt-5 space-y-3" role="status" aria-label="Loading purchases">
      <div v-for="index in 5" :key="index" class="h-52 animate-pulse rounded-ui-lg bg-surface motion-reduce:animate-none sm:h-48"></div>
    </div>
    <div v-else-if="purchases.error" class="mt-6 rounded-ui-lg border border-danger/20 bg-danger/10 p-6 text-danger" role="alert">
      <p class="font-semibold">Your purchase library is unavailable</p><p class="mt-1 text-sm">{{ purchases.error }}</p>
      <button type="button" class="mt-4 text-sm font-bold underline" @click="loadPurchases(purchases.page, true)">Try again</button>
    </div>
    <div v-else-if="!purchases.items.length" class="mt-6 rounded-ui-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <h2 class="text-xl font-semibold text-text-main">{{ search || requestedProduct ? 'No matching purchases' : 'Your purchase library is empty' }}</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">{{ search || requestedProduct ? 'Try another search or view all purchases. Refunded products are available in My refunds.' : 'Products appear here automatically after payment is confirmed.' }}</p>
      <NuxtLink :to="search || requestedProduct ? '/refunds' : '/products'" class="mt-5 inline-flex rounded-ui-sm bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark">{{ search || requestedProduct ? 'My refunds' : 'Browse products' }}</NuxtLink>
    </div>
    <section v-else class="mt-5 space-y-3" aria-label="Purchased products">
      <article v-for="purchase in purchases.items" :key="purchase.id" class="grid min-w-0 overflow-hidden rounded-ui-lg bg-surface shadow-elevation-1 sm:grid-cols-[10rem_minmax(0,1fr)] xl:grid-cols-[11.5rem_minmax(0,1fr)]">
        <div class="relative aspect-video overflow-hidden bg-bg-alt sm:aspect-auto sm:h-52 sm:self-start xl:h-48">
          <img v-if="purchase.product?.image_url" :src="purchase.product.image_url" :alt="purchase.product.name" width="480" height="270" loading="lazy" decoding="async" class="h-full w-full object-cover">
          <div v-else class="flex h-full min-h-36 items-center justify-center text-text-muted"><svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M4 7h16v13H4V7Zm-1-4h18v4H3V3Zm6 8h6" /></svg></div>
          <div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span class="rounded-ui-full bg-surface/95 px-2.5 py-1 text-[10px] font-bold text-primary shadow-sm">Purchased</span>
            <span v-if="purchase.update_available" class="rounded-ui-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">Update available</span>
          </div>
        </div>
        <div class="relative flex min-w-0 flex-col p-4 sm:p-5 xl:min-h-48 xl:pr-[19rem]">
          <h2 class="line-clamp-2 text-base font-semibold leading-6 text-text-main sm:text-lg">{{ purchase.product?.name || 'Purchased product' }}</h2>
          <p class="mt-1 text-xs text-text-muted">Purchased {{ formatDate(purchase.purchased_at) }}<span v-if="purchase.price !== null"> · {{ formatIDR(purchase.price) }}</span></p>
          <NuxtLink v-if="purchase.store?.slug" :to="`/stores/${purchase.store.slug}`" class="mt-2 w-fit text-xs font-semibold text-primary hover:underline">{{ purchase.store.name }}</NuxtLink>
          <div v-if="purchase.latest_version || purchase.license" class="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span v-if="purchase.latest_version" class="rounded-ui-full bg-primary/10 px-2.5 py-1 text-primary">Latest v{{ purchase.latest_version }}</span>
            <span v-if="purchase.purchased_version && purchase.purchased_version !== purchase.latest_version" class="text-text-muted">Purchased at v{{ purchase.purchased_version }}</span>
            <span v-if="purchase.license" class="rounded-ui-full bg-bg-alt px-2.5 py-1 text-text-main">{{ purchase.license.name }} license</span>
          </div>

          <details v-if="purchase.license" class="mt-3 text-xs">
            <summary class="w-fit cursor-pointer font-semibold text-text-muted transition hover:text-primary">View license terms</summary>
            <p class="mt-2 max-h-32 overflow-y-auto whitespace-pre-line rounded-ui-sm bg-bg p-3 leading-5 text-text-muted">{{ purchase.license.usage_terms }}</p>
          </details>

          <div class="mt-4 xl:absolute xl:bottom-5 xl:right-5 xl:top-5 xl:mt-0 xl:flex xl:w-64 xl:flex-col xl:justify-center xl:border-l xl:border-border xl:pl-5">
          <div class="rounded-ui-sm bg-bg p-3">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span class="font-medium text-text-muted">Downloads<span v-if="purchase.latest_version"> · v{{ purchase.latest_version }}</span></span>
              <span class="font-semibold" :class="purchase.downloads_remaining ? 'text-primary' : 'text-text-muted'">{{ purchase.downloads_remaining }} / {{ purchase.download_limit }}</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-ui-full bg-border" aria-hidden="true"><div class="h-full rounded-ui-full bg-primary transition-[width]" :style="{ width: `${purchase.download_limit ? Math.min(100, purchase.downloads_remaining / purchase.download_limit * 100) : 0}%` }"></div></div>
            <p v-if="purchase.downloaded_at" class="mt-2 text-[11px] text-text-muted">Last download {{ formatDate(purchase.downloaded_at) }}</p>
            <p v-if="!purchase.file_available" class="mt-2 text-xs leading-5 text-text-muted">File temporarily unavailable. Contact the seller from order details.</p>
          </div>

          <div class="pt-3">
            <button type="button" :disabled="!purchase.can_download || downloading[purchase.product_id]" class="flex min-h-10 w-full items-center justify-center gap-2 rounded-ui-sm bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50" @click="download(purchase)">
              <span v-if="downloading[purchase.product_id]" class="h-4 w-4 animate-spin rounded-ui-full border-2 border-white/30 border-t-white"></span>
              <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></svg>
              {{ downloadLabel(purchase) }}
            </button>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-primary">
              <NuxtLink :to="`/orders/${purchase.order_id}`" class="hover:underline">Order details</NuxtLink>
              <NuxtLink v-if="purchase.public_product_available && purchase.product?.slug" :to="`/products/${purchase.product.slug}`" class="hover:underline">View product</NuxtLink>
            </div>
          </div>
          </div>
        </div>
      </article>
    </section>

    <nav v-if="!purchases.loading && purchases.totalPages > 1" class="mt-6 flex items-center justify-between gap-3" aria-label="Purchase pagination">
      <button type="button" :disabled="purchases.page <= 1" class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:text-primary disabled:opacity-40" @click="goToPage(purchases.page - 1)">Previous</button>
      <span class="text-xs text-text-muted">Page {{ purchases.page }} of {{ purchases.totalPages }}</span>
      <button type="button" :disabled="purchases.page >= purchases.totalPages" class="rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:text-primary disabled:opacity-40" @click="goToPage(purchases.page + 1)">Next</button>
    </nav>
  </div>
</template>
