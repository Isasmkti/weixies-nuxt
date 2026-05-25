<template>
  
    <div class="max-w-[1600px] mx-auto font-poppins">

      <!-- SEARCH BAR (navigates to catalog) -->
      <button
        @click="goToSearch"
        class="w-full flex items-center gap-3 bg-bg-alt/60 hover:bg-bg-alt rounded-xl px-4 py-3 transition-all duration-300 border border-bg-alt hover:border-primary/20 group cursor-text mb-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-text-muted group-hover:text-primary transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M16.65 11A5.65 5.65 0 1111 5.35a5.65 5.65 0 015.65 5.65z" />
        </svg>
        <span class="text-sm text-text-muted font-medium">Search products...</span>
      </button>

    <!-- MAIN CONTENT -->

      <!-- HERO BANNER CAROUSEL -->
      <section class="relative overflow-hidden">
        <div class="relative h-[200px] sm:h-[280px] md:h-[380px]">
          <!-- Slides -->
          <transition name="hero-fade" mode="out-in">
            <div :key="currentBanner" class="absolute inset-0">
              <div :class="banners[currentBanner].bg" class="w-full h-full flex items-center">
                <div class="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
                  <div class="max-w-lg">
                    <span class="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-3 backdrop-blur-sm">{{ banners[currentBanner].badge }}</span>
                    <h2 class="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight mb-3">{{ banners[currentBanner].title }}</h2>
                    <p class="text-white/80 text-sm md:text-base mb-5 max-w-sm">{{ banners[currentBanner].desc }}</p>
                    <button @click="goToSearch" class="bg-white text-gray-900 px-5 py-2.5 rounded-full text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                      Shop Now →
                    </button>
                  </div>
                  <div class="hidden md:block text-8xl opacity-30">{{ banners[currentBanner].emoji }}</div>
                </div>
              </div>
            </div>
          </transition>

          <!-- Dots -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            <button
              v-for="(_, i) in banners" :key="i"
              @click="currentBanner = i"
              :class="['w-2 h-2 rounded-full transition-all duration-300', currentBanner === i ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60']"
            ></button>
          </div>
        </div>
      </section>

      <!-- CATEGORY GRID -->
      <section class="mt-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg md:text-xl font-bold text-text-main">Browse Categories</h2>
          <NuxtLink to="/products" class="text-sm font-semibold text-primary hover:text-primary-dark transition-colors flex items-center gap-1">
            See All
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>

        <div v-if="categoriesLoading" class="flex gap-4 overflow-hidden">
          <div v-for="i in 6" :key="i" class="shrink-0 w-20 h-24 rounded-2xl bg-bg-alt animate-pulse"></div>
        </div>

        <div v-else class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          <button
            v-for="cat in categories"
            :key="cat.id"
            @click="goToCatalogCategory(cat.slug)"
            class="flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-bg-alt/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-300 group"
          >
            <div class="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <span class="text-[10px] md:text-xs font-semibold text-text-muted group-hover:text-text-main transition-colors text-center line-clamp-1">{{ cat.name }}</span>
          </button>
        </div>
      </section>

      <!-- PROMO BANNERS -->
      <section class="mt-10">
        <div class="grid grid-cols-2 gap-3 md:gap-4">
          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 md:p-8 text-white cursor-pointer hover:shadow-xl hover:shadow-amber-500/20 transition-all duration-300 group" @click="goToSearch">
            <div class="relative z-10">
              <span class="text-[10px] md:text-xs font-bold bg-white/20 rounded-full px-2.5 py-1 backdrop-blur-sm">🔥 Hot Deal</span>
              <h3 class="text-sm md:text-xl font-black mt-2 md:mt-3">Flash Sale</h3>
              <p class="text-white/70 text-[10px] md:text-sm mt-1">Up to 50% Off</p>
            </div>
            <div class="absolute top-2 right-2 md:top-4 md:right-4 text-4xl md:text-6xl opacity-20 group-hover:scale-110 transition-transform">⚡</div>
          </div>

          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 p-5 md:p-8 text-white cursor-pointer hover:shadow-xl hover:shadow-violet-500/20 transition-all duration-300 group" @click="goToSearch">
            <div class="relative z-10">
              <span class="text-[10px] md:text-xs font-bold bg-white/20 rounded-full px-2.5 py-1 backdrop-blur-sm">✨ New</span>
              <h3 class="text-sm md:text-xl font-black mt-2 md:mt-3">New Arrivals</h3>
              <p class="text-white/70 text-[10px] md:text-sm mt-1">Fresh & Trending</p>
            </div>
            <div class="absolute top-2 right-2 md:top-4 md:right-4 text-4xl md:text-6xl opacity-20 group-hover:scale-110 transition-transform">🆕</div>
          </div>
        </div>
      </section>

      <!-- FEATURED PRODUCTS -->
      <section class="mt-10">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg md:text-xl font-bold text-text-main">Featured Products</h2>
          <NuxtLink to="/products" class="text-sm font-semibold text-primary hover:text-primary-dark transition-colors flex items-center gap-1">
            View All
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>

        <!-- Loading Skeleton -->
        <div v-if="productsLoading" class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div v-for="i in 4" :key="i" class="rounded-2xl bg-bg-alt animate-pulse">
            <div class="aspect-square rounded-t-2xl bg-bg-alt"></div>
            <div class="p-3 space-y-2">
              <div class="h-3 bg-surface rounded-full w-3/4"></div>
              <div class="h-4 bg-surface rounded-full w-1/2"></div>
            </div>
          </div>
        </div>

        <!-- Products Grid -->
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div
            v-for="product in featuredProducts"
            :key="product.id"
            @click="router.push(`/products/${product.slug}`)"
            class="group bg-surface rounded-2xl border border-bg-alt/50 overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
          >
            <!-- Image -->
            <div class="relative aspect-square overflow-hidden bg-bg-alt">
              <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div v-else class="w-full h-full flex items-center justify-center text-text-muted/30">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              <!-- New badge -->
              <div v-if="isNewProduct(product.created_at)" class="absolute top-2 left-2 bg-primary text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full">
                NEW
              </div>
            </div>

            <!-- Info -->
            <div class="p-3">
              <h3 class="text-xs md:text-sm font-semibold text-text-main line-clamp-2 mb-1 group-hover:text-primary transition-colors">{{ product.name }}</h3>
              <p class="text-sm md:text-base font-extrabold text-primary">{{ formatIDR(product.price) }}</p>

              <!-- Rating -->
              <div v-if="product.reviewCount > 0" class="flex items-center gap-1 mt-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span class="text-[10px] text-text-muted font-medium">{{ product.averageRating?.toFixed(1) }} ({{ product.reviewCount }})</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA SECTION -->
      <section class="mt-12 mb-8">
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary-dark p-8 md:p-12 text-center text-white">
          <div class="relative z-10">
            <h2 class="text-2xl md:text-3xl font-black mb-3">Find Your Perfect Product</h2>
            <p class="text-white/80 mb-6 max-w-md mx-auto text-sm md:text-base">Browse thousands of premium items curated just for you.</p>
            <button @click="goToSearch" class="bg-white text-primary px-8 py-3 rounded-full font-bold text-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
              Explore Catalog
            </button>
          </div>
          <!-- Decorative circles -->
          <div class="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full"></div>
          <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full"></div>
        </div>
      </section>

    </div>
  
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useCategoriesStore } from '../stores/categoriesStore'
import { useProductsStore } from '../stores/productsStore'
import { useCartStore } from '../stores/cartStore'
import { getUser } from '../services/authService'
import { formatIDR } from '../utils/currency'


const router = useRouter()
const { profile, fetchProfile } = useAuth()
const categoriesStore = useCategoriesStore()
const productsStore = useProductsStore()
const cartStore = useCartStore()

const categories = computed(() => categoriesStore.categories)
const categoriesLoading = computed(() => categoriesStore.loading)
const productsLoading = computed(() => productsStore.loading)
const featuredProducts = computed(() => productsStore.products.slice(0, 8))

// Banner Carousel
const banners = [
  {
    title: 'Premium Digital Assets',
    desc: 'Discover hand-picked design resources, templates, and tools.',
    badge: '🛍️ Shop Now',
    bg: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500',
    emoji: '🎨'
  },
  {
    title: 'New Collections',
    desc: 'Freshly curated items added weekly to our store.',
    badge: '🌟 New Arrivals',
    bg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600',
    emoji: '✨'
  },
  {
    title: 'Best Sellers',
    desc: 'Top-rated products loved by thousands of customers.',
    badge: '🏆 Top Rated',
    bg: 'bg-gradient-to-br from-orange-500 via-red-500 to-rose-600',
    emoji: '🔥'
  }
]
const currentBanner = ref(0)
let bannerInterval = null

const goToSearch = () => {
  router.push({ path: '/products', query: { focus: 'search' } })
}

const goToCatalogCategory = (slug) => {
  router.push({ path: '/products', query: { category: slug } })
}

const isNewProduct = (createdAt) => {
  if (!createdAt) return false
  const diffDays = Math.ceil(Math.abs(new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24))
  return diffDays <= 3
}

onMounted(async () => {
  // Start banner rotation
  bannerInterval = setInterval(() => {
    currentBanner.value = (currentBanner.value + 1) % banners.length
  }, 5000)

  // Fetch data
  await fetchProfile()

  const promises = [categoriesStore.fetchCategories()]

  // Only fetch products if not already loaded
  if (!productsStore.products.length) {
    promises.push(productsStore.stAll())
  }

  const user = await getUser()
  if (user) {
    promises.push(cartStore.stGetCart(user.id))
  }

  await Promise.all(promises)
})

onUnmounted(() => {
  clearInterval(bannerInterval)
})
</script>

<style scoped>
.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.hero-fade-enter-from {
  opacity: 0;
  transform: scale(1.02);
}
.hero-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
