<template>
  <div class="mx-auto max-w-[1500px] font-poppins">
    <header class="mb-7">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Marketplace</p>
      <h1 class="mt-1 text-3xl font-black tracking-tight text-text-main">Product catalog</h1>
      <p class="mt-2 text-sm text-text-muted">Discover digital assets made for your next project.</p>
    </header>

    <div class="grid gap-7" :class="filterInLayout ? 'lg:grid-cols-[250px_minmax(0,1fr)]' : 'grid-cols-1'">
      <Transition
        enter-active-class="transition-all duration-300 ease-out motion-reduce:transition-none"
        enter-from-class="-translate-x-4 scale-[0.98] opacity-0"
        enter-to-class="translate-x-0 scale-100 opacity-100"
        leave-active-class="transition-all duration-200 ease-in motion-reduce:transition-none"
        leave-from-class="translate-x-0 scale-100 opacity-100"
        leave-to-class="-translate-x-3 scale-[0.98] opacity-0"
        @after-leave="filterInLayout = false"
      >
      <aside v-if="showFilters" id="catalog-filter-panel" class="h-fit origin-top-left lg:sticky lg:top-6">
        <div class="rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm">
          <div class="flex items-center justify-between border-b border-bg-alt pb-4">
            <h2 class="text-lg font-black text-text-main">Filter</h2>
            <div class="flex items-center gap-2">
              <button type="button" class="text-xs font-bold text-primary hover:underline" @click="resetFilters">Reset</button>
              <button type="button" aria-label="Close filters" title="Close filters" class="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-text-main" @click="closeFilters">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div class="border-b border-bg-alt py-5">
            <h3 class="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Categories</h3>
            <div class="space-y-2.5">
              <label class="group flex cursor-pointer items-center gap-2.5 text-sm"><input type="checkbox" :checked="selectedCategory.length === 0" class="h-4 w-4 rounded border-bg-alt text-primary focus:ring-primary/30" @change="productsStore.clearCategories()"><span class="font-medium text-text-main group-hover:text-primary">All products</span></label>
              <label v-for="category in categories" :key="category.id" class="group flex cursor-pointer items-center gap-2.5 text-sm"><input type="checkbox" :checked="selectedCategory.includes(category.slug)" class="h-4 w-4 rounded border-bg-alt text-primary focus:ring-primary/30" @change="setCategory(category.slug)"><span class="min-w-0 flex-1 truncate font-medium text-text-main group-hover:text-primary">{{ category.name }}</span></label>
              <p v-if="!categories.length && !loading" class="text-sm text-text-muted">No categories available.</p>
            </div>
          </div>

          <form class="py-5" @submit.prevent="applyPriceFilter">
            <h3 class="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Price range</h3>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><input v-model="minPrice" min="0" type="number" placeholder="Min" class="min-w-0 rounded-lg border border-bg-alt bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"><span class="text-text-muted">-</span><input v-model="maxPrice" min="0" type="number" placeholder="Max" class="min-w-0 rounded-lg border border-bg-alt bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"></div>
            <p v-if="priceError" class="mt-2 text-xs font-medium text-red-600">{{ priceError }}</p>
            <button class="mt-3 w-full rounded-lg border border-bg-alt px-3 py-2 text-sm font-bold text-text-main transition hover:border-primary/30 hover:bg-primary/5">Apply price</button>
          </form>
        </div>
      </aside>
      </Transition>

      <section class="min-w-0">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="relative w-full max-w-2xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M16.65 11A5.65 5.65 0 1 1 5.35 11a5.65 5.65 0 0 1 11.3 0Z" /></svg>
            <input ref="searchInputEl" v-model="searchInput" type="search" placeholder="Search templates, UI kits, or assets..." @keydown.enter="onSearchSubmit" @focus="showRecentSearches = true" @blur="hideRecentDelayed" class="w-full rounded-xl border border-bg-alt bg-surface py-3 pl-12 pr-10 text-sm text-text-main shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20">
            <button v-if="searchInput" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:bg-bg-alt hover:text-text-main" @click="searchInput = ''">&times;</button>
            <div v-if="showRecentSearches && !searchInput && recentSearches.length" class="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-bg-alt bg-surface shadow-xl"><div class="flex items-center justify-between border-b border-bg-alt px-4 py-2.5"><span class="text-xs font-bold uppercase tracking-wider text-text-muted">Recent searches</span><button class="text-xs font-bold text-primary" @mousedown.prevent="clearAllSearches">Clear</button></div><button v-for="term in recentSearches" :key="term" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-main hover:bg-bg-alt/50" @mousedown.prevent="applyRecentSearch(term)">{{ term }}</button></div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button type="button" aria-controls="catalog-filter-panel" :aria-expanded="showFilters" :aria-label="showFilters ? 'Hide filters' : 'Show filters'" :title="showFilters ? 'Hide filters' : 'Show filters'" class="flex h-10 w-10 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-primary/30" :class="showFilters ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20' : 'border-bg-alt bg-surface text-text-muted hover:border-primary/40 hover:text-primary'" @click="toggleFilters">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M6 10h12M10 16h4" /></svg>
            </button>
            <label for="catalog-sort" class="text-sm font-medium text-text-muted">Sort:</label><select id="catalog-sort" class="rounded-lg border border-bg-alt bg-surface px-3 py-2 text-sm font-semibold text-text-main outline-none focus:ring-2 focus:ring-primary/30" @change="onSortChange"><option value="created_at-desc">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name-asc">Name: A-Z</option></select>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-2 text-sm text-text-muted"><span v-if="productsStore.total">Showing <strong class="text-text-main">{{ resultStart }}-{{ resultEnd }}</strong> of <strong class="text-text-main">{{ productsStore.total }}</strong> products</span><span v-else>Showing <strong class="text-text-main">0</strong> products</span><button v-for="slug in selectedCategory" :key="slug" class="inline-flex items-center gap-1 rounded-full bg-bg-alt px-2.5 py-1 text-xs font-bold text-text-main hover:text-red-600" @click="setCategory(slug)">{{ categoryName(slug) }} <span>&times;</span></button><button v-if="productsStore.minPrice !== null || productsStore.maxPrice !== null" class="inline-flex items-center gap-1 rounded-full bg-bg-alt px-2.5 py-1 text-xs font-bold text-text-main hover:text-red-600" @click="clearPriceFilter">{{ priceFilterLabel }} <span>&times;</span></button></div>

        <div v-if="loading" class="flex flex-col items-center justify-center py-24"><span class="h-12 w-12 animate-spin rounded-full border-4 border-primary/25 border-t-primary"></span><p class="mt-4 font-medium text-text-muted">Loading products...</p></div>
        <div v-else-if="error" class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"><strong>Unable to load products.</strong><p class="mt-1 text-sm">{{ error }}</p></div>
        <div v-else-if="!products.length" class="mt-6 rounded-2xl border border-dashed border-bg-alt bg-surface p-12 text-center"><h2 class="text-xl font-black text-text-main">No products found</h2><p class="mt-2 text-text-muted">Try changing your search or filters.</p><button class="mt-5 font-bold text-primary hover:underline" @click="resetFilters">Clear all filters</button></div>

        <div v-else class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          <article
            v-for="product in products"
            :key="product.id"
            class="group relative flex min-h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-bg-alt bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
            @click="router.push(`/products/${product.slug}`)"
          >
            <div class="relative aspect-[4/3] overflow-hidden bg-bg-alt">
              <img
                v-if="getMainImage(product)"
                :src="getMainImage(product)"
                :alt="product.name"
                class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              >
              <defaultProduct v-else class="h-full w-full p-8 text-text-muted/50" />
              <span v-if="isNewProduct(product.created_at)" class="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">New</span>
              <button
                v-if="!isOwnProduct(product)"
                type="button"
                :aria-label="wishlistStore.isWishlisted(product.id) ? 'Hapus dari wishlist' : 'Tambahkan ke wishlist'"
                :aria-pressed="wishlistStore.isWishlisted(product.id)"
                :title="wishlistStore.isWishlisted(product.id) ? 'Hapus dari wishlist' : 'Tambahkan ke wishlist'"
                :disabled="wishlistStore.isToggling(product.id)"
                class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur transition duration-200 hover:scale-105 disabled:cursor-wait disabled:opacity-70"
                :class="wishlistStore.isWishlisted(product.id) ? 'bg-red-500 text-white ring-2 ring-white/80 hover:bg-red-600' : 'bg-surface/90 text-text-muted hover:bg-red-50 hover:text-red-500'"
                @click.stop="toggleWishlist(product.id)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" :fill="wishlistStore.isWishlisted(product.id) ? 'currentColor' : 'none'" class="h-4 w-4 transition-transform duration-200" :class="wishlistStore.isWishlisted(product.id) ? 'scale-110' : 'scale-100'" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0Z" /></svg>
              </button>
            </div>

            <div class="flex flex-1 flex-col p-3">
              <h2 class="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-text-main transition group-hover:text-primary sm:text-[15px]">{{ product.name }}</h2>
              <div v-if="product.reviewCount" class="mt-1.5 flex items-center gap-1 text-xs">
                <span class="text-amber-500">&#9733;</span>
                <span class="font-bold text-text-main">{{ product.averageRating.toFixed(1) }}</span>
                <span class="text-text-muted">({{ product.reviewCount }})</span>
              </div>
              <p v-else class="mt-1.5 text-xs text-text-muted">No reviews yet</p>
              <div class="mt-3 flex items-center justify-between gap-2">
                <span class="truncate text-base font-black text-primary">{{ formatIDR(product.price) }}</span>
                <button
                  v-if="!isOwnProduct(product)"
                  type="button"
                  :aria-label="isInCart(product.id) ? 'View cart' : 'Add to cart'"
                  :title="isInCart(product.id) ? 'Already in cart' : 'Add to cart'"
                  :aria-pressed="isInCart(product.id)"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-60"
                  :class="isInCart(product.id) ? 'bg-primary text-white shadow-sm' : 'bg-bg-alt text-text-main hover:bg-primary hover:text-white'"
                  :disabled="addingToCart === product.id"
                  @click.stop="isInCart(product.id) ? router.push('/cart') : addToCart(product.id)"
                >
                  <span v-if="addingToCart === product.id" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"></span>
                  <svg v-else-if="isInCart(product.id)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="m5 12 4 4L19 6" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3A1 1 0 0 0 5.8 17H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" /></svg>
                </button>
                <NuxtLink v-else :to="`/seller/products/${product.id}/edit`" title="Manage your product" aria-label="Manage your product" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition hover:bg-primary hover:text-white" @click.stop>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                </NuxtLink>
              </div>
            </div>
          </article>
        </div>

        <nav v-if="products.length && productsStore.totalPages > 1" class="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Product catalog pagination">
          <button
            type="button"
            :disabled="productsStore.page === 1 || productsStore.loading"
            class="inline-flex h-10 items-center gap-1.5 rounded-xl border border-bg-alt bg-surface px-3 text-sm font-bold text-text-main transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Go to previous page"
            @click="goToPage(productsStore.page - 1)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" /></svg>
            <span class="hidden sm:inline">Previous</span>
          </button>

          <template v-for="item in paginationItems" :key="item.key">
            <span v-if="item.type === 'ellipsis'" class="flex h-10 w-8 items-center justify-center text-sm font-bold text-text-muted" aria-hidden="true">&hellip;</span>
            <button
              v-else
              type="button"
              :aria-label="`Go to page ${item.page}`"
              :aria-current="item.page === productsStore.page ? 'page' : undefined"
              :disabled="productsStore.loading"
              class="flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60"
              :class="item.page === productsStore.page ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20' : 'border-bg-alt bg-surface text-text-main hover:border-primary/40 hover:text-primary'"
              @click="goToPage(item.page)"
            >
              {{ item.page }}
            </button>
          </template>

          <button
            type="button"
            :disabled="productsStore.page === productsStore.totalPages || productsStore.loading"
            class="inline-flex h-10 items-center gap-1.5 rounded-xl border border-bg-alt bg-surface px-3 text-sm font-bold text-text-main transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Go to next page"
            @click="goToPage(productsStore.page + 1)"
          >
            <span class="hidden sm:inline">Next</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6" /></svg>
          </button>
        </nav>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import defaultProduct from '../../components/defaultProduct.vue'
import { getUser } from '../../services/authService'

const router = useRouter()
const route = useRoute()
const wishlistStore = useWishlistStore()
const profileId = ref(null)
const searchInputEl = ref(null)
const showRecentSearches = ref(false)
const showFilters = ref(false)
const filterInLayout = ref(false)
const minPrice = ref('')
const maxPrice = ref('')
const priceError = ref('')
const { recentSearches, addSearch, clearAll: clearAllSearches } = useRecentSearches()
const { products, categories, selectedCategory, loading, error, searchInput, addingToCart, onSortChange, setCategory, goToPage, addToCart, getMainImage, isOwnProduct, productsStore, cartStore, formatIDR } = useCatalogUI()

watch(() => productsStore.minPrice, (value) => { minPrice.value = value ?? '' }, { immediate: true })
watch(() => productsStore.maxPrice, (value) => { maxPrice.value = value ?? '' }, { immediate: true })

const priceFilterLabel = computed(() => `${productsStore.minPrice !== null ? formatIDR(productsStore.minPrice) : 'Any'} - ${productsStore.maxPrice !== null ? formatIDR(productsStore.maxPrice) : 'Any'}`)
const resultStart = computed(() => productsStore.total ? ((productsStore.page - 1) * productsStore.limit) + 1 : 0)
const resultEnd = computed(() => Math.min(productsStore.page * productsStore.limit, productsStore.total))
const paginationItems = computed(() => {
  const totalPages = productsStore.totalPages
  const currentPage = productsStore.page

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: 'page',
      page: index + 1,
      key: `page-${index + 1}`
    }))
  }

  const visiblePages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  if (currentPage <= 4) {
    for (let page = 1; page <= 5; page += 1) visiblePages.add(page)
  }
  if (currentPage >= totalPages - 3) {
    for (let page = totalPages - 4; page <= totalPages; page += 1) visiblePages.add(page)
  }

  const pages = [...visiblePages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  const items = []
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) {
      items.push({ type: 'ellipsis', key: `ellipsis-${pages[index - 1]}-${page}` })
    }
    items.push({ type: 'page', page, key: `page-${page}` })
  })

  return items
})
const categoryName = (slug) => categories.value.find((category) => category.slug === slug)?.name || slug
const isNewProduct = (createdAt) => createdAt && (Date.now() - new Date(createdAt).getTime()) / 86400000 <= 3
const isInCart = (productId) => (cartStore?.items || []).some((item) => (
  String(item.product_id) === String(productId)
))
const applyRecentSearch = (term) => { searchInput.value = term; showRecentSearches.value = false }
const onSearchSubmit = () => { if (searchInput.value?.trim()) addSearch(searchInput.value.trim()); showRecentSearches.value = false; searchInputEl.value?.blur() }
const hideRecentDelayed = () => setTimeout(() => { showRecentSearches.value = false }, 200)
const applyPriceFilter = async () => { priceError.value = ''; try { await productsStore.setPriceRange(minPrice.value, maxPrice.value) } catch (error) { priceError.value = error.message } }
const clearPriceFilter = async () => { minPrice.value = ''; maxPrice.value = ''; await productsStore.setPriceRange(null, null) }
const resetFilters = async () => { searchInput.value = ''; minPrice.value = ''; maxPrice.value = ''; priceError.value = ''; productsStore.categorySlug = []; productsStore.search = ''; await productsStore.setPriceRange(null, null) }
const toggleWishlist = async (productId) => { const product = products.value.find((item) => item.id === productId); if (isOwnProduct(product)) return; if (!profileId.value) return router.push('/login'); await wishlistStore.stToggleWishlist(profileId.value, productId) }
const closeFilters = () => { showFilters.value = false }
const toggleFilters = () => {
  if (showFilters.value) return closeFilters()
  filterInLayout.value = true
  showFilters.value = true
}

onMounted(async () => {
  const user = await getUser()
  if (user) { profileId.value = user.id; await wishlistStore.stGetWishlists(user.id) }
  if (route.query.category) productsStore.setCategory(route.query.category)
  if (route.query.focus === 'search') { await nextTick(); setTimeout(() => searchInputEl.value?.focus(), 300) }
})
</script>
