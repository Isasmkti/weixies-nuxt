<template>
  
    <div class="max-w-[1600px] mx-auto font-poppins">

   <!-- HEADER -->
      <div class="flex flex-col gap-4 mb-8">
        <!-- Top row: back button + title -->
        <div class="flex items-center gap-3">
          <button @click="router.push('/')" class="shrink-0 p-2 -ml-2 rounded-xl hover:bg-bg-alt text-text-muted hover:text-primary transition-colors md:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="flex-1">
            <h1 class="text-xl md:text-3xl font-extrabold text-text-main">
              Product Catalog
            </h1>
          </div>
        </div>

        <!-- SEARCH -->
        <div class="relative w-full">
          <input
            ref="searchInputEl"
            v-model="searchInput"
            type="text"
            placeholder="Search products..."
            @keydown.enter="onSearchSubmit"
            @focus="showRecentSearches = true"
            @blur="hideRecentDelayed"
            class="w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 pl-11 pr-10 text-text-main focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
          <svg xmlns="http://www.w3.org/2000/svg"
            class="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-4.35-4.35M16.65 11A5.65 5.65 0 1111 5.35a5.65 5.65 0 015.65 5.65z" />
          </svg>
          <button v-if="searchInput" @click="searchInput = ''" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-bg-alt text-text-muted hover:text-text-main transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Recent Searches Dropdown -->
          <div v-if="showRecentSearches && !searchInput && recentSearches.length > 0"
            class="absolute top-full left-0 right-0 mt-2 bg-surface border border-bg-alt rounded-xl shadow-xl shadow-black/5 z-50 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-bg-alt/50">
              <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Searches</span>
              <button @click.prevent="clearAllSearches" class="text-xs text-primary font-semibold hover:text-primary-dark">Clear All</button>
            </div>
            <div class="max-h-48 overflow-y-auto">
              <div
                v-for="term in recentSearches" :key="term"
                @mousedown.prevent="applyRecentSearch(term)"
                class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-alt/50 transition-colors text-left group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm text-text-main flex-1 truncate">{{ term }}</span>
                <button @mousedown.prevent.stop="removeSearch(term)" class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-alt text-text-muted hover:text-red-500 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CATEGORY CHECKBOXES -->
      <div v-if="categories.length" class="mb-8 md:mb-10 w-full">
        <h2 class="text-sm md:text-base font-bold text-text-main mb-3 md:mb-4 uppercase tracking-wider flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter Category
        </h2>
        
        <div class="flex overflow-x-auto gap-4 md:gap-6 pb-3 snap-x items-center w-full [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-surface [&::-webkit-scrollbar-thumb]:bg-bg-alt hover:[&::-webkit-scrollbar-thumb]:bg-text-muted [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
          
          <!-- All Items Checkbox -->
        <label class="snap-start flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 group">
          <input type="checkbox" :checked="selectedCategory.length === 0" @change="productsStore.clearCategories()" class="hidden" />
          <div :class="[
            'w-4 h-4 md:w-5 md:h-5 rounded border flex items-center justify-center transition-colors',
            selectedCategory.length === 0 ? 'bg-primary border-primary' : 'bg-surface border-bg-alt group-hover:border-primary'
          ]">
             <svg v-if="selectedCategory.length === 0" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
             </svg>
          </div>
          <span :class="['text-sm font-semibold transition-colors', selectedCategory.length === 0 ? 'text-primary' : 'text-text-muted group-hover:text-primary']">All Items</span>
        </label>

        <!-- Category Checkboxes -->
        <label v-for="cat in categories" :key="cat.id" class="snap-start flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 group">
          <input type="checkbox" :checked="selectedCategory.includes(cat.slug)" @change="setCategory(cat.slug)" class="hidden" />
          <div :class="[
            'w-4 h-4 md:w-5 md:h-5 rounded border flex items-center justify-center transition-colors',
            selectedCategory.includes(cat.slug) ? 'bg-primary border-primary' : 'bg-surface border-bg-alt group-hover:border-primary'
          ]">
             <svg v-if="selectedCategory.includes(cat.slug)" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
             </svg>
          </div>
          <span :class="['text-sm font-semibold transition-colors', selectedCategory.includes(cat.slug) ? 'text-text-main' : 'text-text-muted group-hover:text-primary']">{{ cat.name }}</span>
        </label>
        </div>
      </div>

      <!-- sort by -->
      <div class="flex flex-wrap items-center gap-3 mb-8 md:mb-10">
        <span class="text-sm text-text-muted font-semibold">Sort by:</span>

        <select @change="onSortChange"
          class="bg-surface border border-bg-alt rounded-xl px-3 md:px-4 py-2 text-sm md:text-base text-text-main font-semibold focus:ring-2 focus:ring-primary/30">
          <option value="created_at-desc">Newest</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name-asc">Name: A–Z</option>
        </select>
      </div>

      <div v-if="loading" class="flex flex-col items-center justify-center py-24">
        <div
          class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary shadow-lg shadow-primary/30">
        </div>
        <p class="mt-4 text-text-muted font-medium animate-pulse">Loading products...</p>
      </div>

      <div v-else-if="error"
        class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-2xl flex items-center gap-3"
        role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <strong class="font-bold block">Error loading products</strong>
          <span class="block text-sm">{{ error }}</span>
        </div>
      </div>

      <div v-else-if="!products.length" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-surface rounded-full p-6 mb-6 shadow-xl shadow-black/5 ring-1 ring-bg-alt">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-text-muted/50" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-text-main mb-2">No products found</h3>
        <p class="text-text-muted max-w-sm font-montserrat">
          We couldn't find any products matching your current search or filters. Try using
          different keywords.
        </p>
        <button v-if="searchInput" @click="searchInput = ''" class="mt-8 text-primary font-semibold hover:underline">
          Clear search query
        </button>
      </div>

      <div v-else class="grid items-center grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-10">
        <div v-for="product in products" :key="product.id" @click="router.push(`/products/${product.slug}`)"
          class="group bg-surface rounded-xl md:rounded-2xl shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border border-bg-alt overflow-hidden flex flex-col h-full">
          <!-- Image Container -->
          <!-- Aspect ratio 16:9 for more width -->
          <div class="relative aspect-[4/3] overflow-hidden bg-bg-alt">
            <img v-if="product.image_url" :src="product.image_url" :alt="product.name"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <defaultProduct v-else
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />

            <!-- Overlay gradient -->
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            </div>

            <div v-if="isNewProduct(product.created_at || product.createdAt)"
              class="absolute top-2 left-2 md:top-4 md:left-4 bg-surface/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 md:px-3 md:py-1 text-[9px] md:text-xs font-bold text-text-main shadow-sm">
              New
            </div>

            <!-- Wishlist Button -->
            <button @click.stop="toggleWishlist(product.id)" :class="[
               'absolute top-2 right-2 md:top-4 md:right-4 h-7 w-7 md:h-9 md:w-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm z-10 hover:scale-110',
              wishlistStore.isWishlisted(product.id)
                ? 'bg-red-500 text-white shadow-red-500/30'
                : 'bg-surface/90 backdrop-blur-sm text-text-muted hover:text-red-500 hover:bg-surface'
            ]">
              <svg xmlns="http://www.w3.org/2000/svg"
                :fill="wishlistStore.isWishlisted(product.id) ? 'currentColor' : 'none'" viewBox="0 0 24 24"
                 stroke="currentColor" class="h-3.5 w-3.5 md:h-5 md:w-5">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-2 md:p-6 flex flex-col flex-grow">
            <h3
              class="text-xs md:text-lg font-bold text-text-main mb-0.5 md:mb-1 line-clamp-1 group-hover:text-primary transition-colors font-poppins">
              {{ product.name }}
            </h3>
            <div class="hidden md:flex flex-wrap gap-1 mb-2">
              <span v-for="cat in product.categories" :key="cat.id"
                class="text-[10px] uppercase tracking-wider font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {{ cat.name }}
              </span>
              <span v-if="!product.categories?.length" class="text-[10px] text-text-muted italic">
                Uncategorized
              </span>
            </div>

            <!-- Review Stars -->
            <div class="hidden md:flex items-center gap-1 mb-3" v-if="product.reviewCount > 0">
              <div class="flex text-yellow-500">
                <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4"
                  :class="i <= Math.round(product.averageRating) ? 'fill-current' : 'text-gray-300 dark:text-gray-600'"
                  viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <span class="text-xs text-text-muted font-semibold ml-1">{{ product.averageRating.toFixed(1) }} ({{
                product.reviewCount }})</span>
            </div>
            <div class="hidden md:flex items-center gap-1 mb-3 text-text-muted text-xs font-semibold" v-else>
              <div class="flex text-gray-300 dark:text-gray-600">
                <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20"
                  fill="currentColor">
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <span class="ml-1">No reviews</span>
            </div>
            <p class="hidden md:block text-text-muted text-sm mb-4 line-clamp-2 flex-grow font-montserrat">
              {{ product.description }}
            </p>

            <div class="flex flex-col md:flex-row md:flex-nowrap justify-between items-start md:items-center mt-auto pt-2 md:pt-4 border-t border-bg-alt gap-2.5 md:gap-2">
              <div class="flex flex-col min-w-0 w-full md:w-auto">
                <span class="hidden md:block text-[10px] md:text-xs text-text-muted uppercase tracking-wider font-semibold truncate">Price</span>
                <span class="text-xs md:text-base xl:text-lg font-extrabold text-text-main font-poppins truncate" :title="formatIDR(product.price)">{{ formatIDR(product.price) }}</span>
              </div>

              <button @click.stop="
                isInCart(product.id)
                  ? router.push('/cart')
                  : addToCart(product.id)
                " :disabled="addingToCart === product.id" :class="[
                  'relative overflow-hidden px-2 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl transition-all duration-300 shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto shrink-0',
                  isInCart(product.id)
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                    : 'bg-primary hover:bg-primary-dark text-white shadow-primary/25 hover:shadow-primary/40'
                ]">
                <span class="flex items-center justify-center gap-1 md:gap-1.5 text-[10px] md:text-sm font-medium">

                  <!-- Loading -->
                  <span v-if="addingToCart === product.id"
                    class="animate-spin h-3.5 w-3.5 md:h-4 md:w-4 border-2 border-white/30 border-t-white rounded-full"></span>

                  <!-- Dynamic Icon -->
                  <svg v-else-if="!isInCart(product.id)" xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>

                  <!-- Check Icon -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>

                  {{
                    addingToCart === product.id
                      ? "Adding..."
                      : isInCart(product.id)
                        ? "Cart"
                        : "Add"
                  }}
                </span>
              </button>

            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="products.length > 0"
      class="flex flex-wrap justify-center items-center gap-4 md:gap-6 mt-12 md:mt-16 font-poppins">
      <!-- Prev -->
      <button :disabled="productsStore.page === 1" @click="productsStore.stAll(productsStore.page - 1)"
        class="flex items-center gap-1.5 md:gap-2 px-4 py-2 md:px-5 md:py-2.5 text-sm md:text-base rounded-xl font-semibold bg-surface border border-bg-alt text-text-main hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-text-main">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="hidden sm:inline">Prev</span>
      </button>

      <!-- Page Info -->
      <div
        class="px-4 py-2 md:px-6 rounded-xl bg-bg-alt text-text-muted text-sm md:text-base font-semibold tracking-wide">
        Page
        <span class="text-text-main font-extrabold">
          {{ productsStore.page }}
        </span>
        /
        <span>
          {{ productsStore.totalPages }}
        </span>
      </div>

      <!-- Next -->
      <button :disabled="productsStore.page === productsStore.totalPages"
        @click="productsStore.stAll(productsStore.page + 1)"
        class="flex items-center gap-1.5 md:gap-2 px-4 py-2 md:px-5 md:py-2.5 text-sm md:text-base rounded-xl font-semibold bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary">
        <span class="hidden sm:inline">Next</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, nextTick } from "vue";
import { useRoute } from "vue-router";
import defaultProduct from "../components/defaultProduct.vue";
// import { useCatalogUI } from "../composables/useCatalogUI";

// import router from "../router/index";
// import { useWishlistStore } from "../stores/wishlistStore";
import { getUser } from "../../services/authService";
// import { useRecentSearches } from "../composables/useRecentSearches";

const router = useRouter();
const wishlistStore = useWishlistStore();
const profileId = ref(null);
const searchInputEl = ref(null);
const showRecentSearches = ref(false);

const { recentSearches, addSearch, removeSearch, clearAll: clearAllSearches } = useRecentSearches();

const applyRecentSearch = (term) => {
  searchInput.value = term;
  showRecentSearches.value = false;
};

const onSearchSubmit = () => {
  if (searchInput.value?.trim()) {
    addSearch(searchInput.value.trim());
  }
  showRecentSearches.value = false;
  searchInputEl.value?.blur();
};

const hideRecentDelayed = () => {
  setTimeout(() => { showRecentSearches.value = false; }, 200);
};

onMounted(async () => {
  const user = await getUser();
  if (user) {
    profileId.value = user.id;
    await wishlistStore.stGetWishlists(user.id);
  }

  // Handle ?category=slug from Home
  if (route.query.category) {
    productsStore.setCategory(route.query.category);
  }

  // Handle ?focus=search from Home — auto-focus the search input
  if (route.query.focus === 'search') {
    await nextTick();
    setTimeout(() => {
      searchInputEl.value?.focus();
    }, 300);
  }
});

const toggleWishlist = async (productId) => {
  if (!profileId.value) {
    router.push('/login');
    return;
  }
  await wishlistStore.stToggleWishlist(profileId.value, productId);
};

const {
  products,
  categories,
  selectedCategory,
  loading,
  error,
  searchInput,
  addingToCart,
  onSortChange,
  setCategory,
  addToCart,
  getMainImage,
  productsStore,
  cartStore,
  formatIDR
} = useCatalogUI();

const isNewProduct = (createdAt) => {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - createdDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 3; // within the last 3 days
};

// reactive check
const isInCart = (productId) => {
  if (!productId) return false;
  const inList = (cartStore?.items ?? []).some((item) => item.product_id === productId);
  const isAdding = cartStore?.addingProducts?.[productId];
  return inList || isAdding;
};
</script>
