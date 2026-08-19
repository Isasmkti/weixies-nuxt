<template>
    
        <div class="max-w-6xl mx-auto font-poppins px-4 sm:px-6 lg:px-0">
            <div v-if="loading" class="bg-surface rounded-3xl border border-bg-alt/60 p-6 sm:p-12 text-center shadow-lg">
                <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary">
                </div>
                <p class="mt-4 text-text-muted font-semibold">Loading product details...</p>
            </div>

            <div v-else-if="error" class="bg-surface rounded-3xl border border-bg-alt/60 p-6 sm:p-12 text-center shadow-lg">
                <h2 class="text-2xl font-bold text-text-main mb-2">Product not available</h2>
                <p class="text-text-muted mb-6">{{ error }}</p>
                <NuxtLink to="/products"
                    class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-dark transition-colors">
                    Back to Catalog
                </NuxtLink>
            </div>

            <div v-else-if="product" class="space-y-4 md:space-y-6">
                <div class="flex items-center justify-between gap-4">
                    <NuxtLink to="/products"
                        class="inline-flex items-center gap-2 text-text-muted hover:text-primary font-semibold transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Catalog
                    </NuxtLink>
                    <!-- <span
                        class="rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                        {{ product.slug ? `#${product.slug}` : '#product' }}
                    </span> -->
                </div>

                <section
                    class="relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-4 sm:p-6 md:p-10 shadow-2xl shadow-black/[0.03]">
                    <div class="pointer-events-none absolute inset-0 pattern-grid opacity-30"></div>
                    <div
                        class="pointer-events-none absolute -top-24 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-[90px]">
                    </div>
                    <div
                        class="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-[100px]">
                    </div>

                    <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
                        <div class="space-y-4">
                            <!-- Main Large Image -->
                            <div class="rounded-3xl border border-bg-alt bg-bg-alt/50 p-4">
                                <div
                                    class="relative aspect-square w-full overflow-hidden rounded-2xl bg-bg flex items-center justify-center">
                                    <img v-if="selectedImage" :src="selectedImage" :alt="product.name"
                                        class="h-full w-full object-cover transition-all duration-300">
                                    <defaultProduct v-else class="h-40 w-40 text-text-muted/60" />
                                    
                                    <!-- Wishlist Button -->
                                    <button @click.stop="toggleWishlist(product.id)"
                                      :class="[
                                        'absolute top-4 right-4 h-11 w-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-md z-10 hover:scale-110',
                                        wishlistStore.isWishlisted(product.id) 
                                          ? 'bg-red-500 text-white shadow-red-500/30' 
                                          : 'bg-surface/90 backdrop-blur-sm text-text-muted hover:text-red-500 hover:bg-surface'
                                      ]">
                                      <svg xmlns="http://www.w3.org/2000/svg" :fill="wishlistStore.isWishlisted(product.id) ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" class="h-6 w-6">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                      </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- Thumbnails -->
                            <div v-if="productImages && productImages.length > 0"
                                class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                <button v-for="(img, idx) in productImages" :key="idx"
                                    @click="selectedImage = img.image_url"
                                    :class="['flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden border-2 transition-all',
                                        selectedImage === img.image_url ? 'border-primary shadow-md' : 'border-bg-alt opacity-70 hover:opacity-100']">
                                    <img :src="img.image_url" :alt="`${product.name} image ${idx + 1}`"
                                        class="w-full h-full object-cover">
                                </button>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <div class="space-y-3">
                                <span
                                    class="inline-flex rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                                    Product Detail
                                </span>
                                <h1
                                    class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-text-main tracking-tight leading-tight">
                                    {{ product.name }}
                                </h1>
                                <div class="flex flex-wrap gap-2 pt-1">
                                    <span v-for="cat in product.categories" :key="cat.id"
                                        class="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm ring-1 ring-primary/20">
                                        {{ cat.name }}
                                    </span>
                                </div>

                                <NuxtLink v-if="sellerStore" :to="`/stores/${sellerStore.store_slug}`"
                                    class="group mt-4 flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 transition-colors hover:border-primary/35 hover:bg-primary/10">
                                    <span>
                                        <span class="block text-xs font-bold uppercase tracking-wider text-text-muted">Sold by</span>
                                        <span class="mt-1 block font-black text-text-main group-hover:text-primary">{{ sellerStore.store_name }}</span>
                                    </span>
                                    <span class="text-sm font-bold text-primary">Visit store →</span>
                                </NuxtLink>

                                <!-- Review Stars -->
                                <div class="flex items-center gap-2 pt-2" v-if="product.reviewCount > 0">
                                  <div class="flex text-yellow-500">
                                    <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" :class="i <= Math.round(product.averageRating) ? 'fill-current' : 'text-gray-300 dark:text-gray-600'" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </div>
                                  <span class="text-sm text-text-muted font-semibold">{{ product.averageRating.toFixed(1) }} ({{ product.reviewCount }} reviews)</span>
                                </div>
                                <div class="flex items-center gap-2 pt-2 text-text-muted text-sm font-semibold" v-else>
                                  <div class="flex text-gray-300 dark:text-gray-600">
                                    <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </div>
                                  <span>No reviews yet</span>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="rounded-2xl border border-bg-alt bg-bg/70 p-4">
                                    <p class="text-xs uppercase tracking-widest text-text-muted font-semibold">Price</p>
                                    <p class="text-2xl md:text-3xl font-black text-text-main mt-2">{{ formattedPrice }}</p>
                                </div>
                                <div class="rounded-2xl border border-bg-alt bg-bg/70 p-4">
                                    <p class="text-xs uppercase tracking-widest text-text-muted font-semibold">Status
                                    </p>
                                    <p class="text-lg font-bold text-primary mt-2">Available</p>
                                </div>
                            </div>

                            <div class="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
                                <button @click="isInCart(product.id) ? router.push('/cart') : addToCart()"
                                    :disabled="addingToCart === product.id || (addingToCart && !product.id)" :class="[
                                        'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70 w-full sm:w-auto',
                                        isInCart(product.id)
                                            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                                            : 'bg-primary hover:bg-primary-dark shadow-primary/30 hover:shadow-primary/40'
                                    ]">
                                    <span v-if="addingToCart === product.id || (addingToCart && !product.id)"
                                        class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>

                                    <svg v-else-if="!isInCart(product.id)" xmlns="http://www.w3.org/2000/svg"
                                        class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>

                                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M5 13l4 4L19 7" />
                                    </svg>

                                    {{ (addingToCart === product.id || (addingToCart && !product.id)) ? 'Adding...' :
                                        isInCart(product.id) ? 'Go to Cart' : 'Add to Cart' }}
                                </button>

                                <!-- <NuxtLink :to="`/reviews/${product.slug}`"
                                    class="inline-flex items-center justify-center gap-2 rounded-xl border border-bg-alt bg-bg px-6 py-3 font-semibold text-text-main hover:border-primary/30 hover:text-primary transition-colors w-full sm:w-auto">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                        viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Write a Review
                                </NuxtLink> -->

                                <NuxtLink to="/products"
                                    class="inline-flex items-center justify-center gap-2 rounded-xl border border-bg-alt bg-bg px-6 py-3 font-semibold text-text-main hover:border-primary/30 hover:text-primary transition-colors w-full sm:w-auto">
                                    Continue Shopping
                                </NuxtLink>
                            </div>
                        </div>
                    </div>
                </section>



                <section class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-4 sm:p-6 md:p-10 shadow-lg">
                    <div class="max-w-3xl">
                        <h2 class="text-xl sm:text-2xl md:text-3xl font-bold text-text-main mb-4">
                            Product Description
                        </h2>

                        <div class="prose prose-neutral max-w-none text-text-muted leading-relaxed">
                            <p v-if="product.description">
                                {{ product.description }}
                            </p>
                            <p v-else>
                                No description available for this product yet.
                            </p>
                        </div>
                    </div>
                </section>

                <section
                    class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-4 sm:p-6 md:p-10 shadow-lg">
                    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
                        <h2 class="text-xl sm:text-2xl md:text-3xl font-bold text-text-main">
                            Customer Reviews
                        </h2>
                        <!-- <NuxtLink :to="`/reviews/${product.slug}`"
                            class="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
                            Write a Review
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M9 5l7 7-7 7" />
                            </svg>
                        </NuxtLink> -->
                    </div>

                    <div v-if="reviewsStore.loading && reviewsStore.reviews.length === 0"
                        class="flex justify-center py-8">
                        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary">
                        </div>
                    </div>
                    <div v-else-if="reviewsStore.reviews.length === 0" class="text-center py-8 text-text-muted">
                        <p>No reviews yet. Be the first to review this product!</p>
                    </div>
                    <div v-else class="space-y-6">
                        <div v-for="review in reviewsStore.reviews" :key="review.id"
                            class="p-5 rounded-2xl bg-bg border border-bg-alt/50">
                            <div class="flex items-center gap-4 mb-3">
                                <img v-if="review.profiles?.profile_img" :src="review.profiles.profile_img"
                                    alt="Reviewer" class="w-10 h-10 rounded-full object-cover">
                                <div v-else
                                    class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {{ review.profiles?.full_name?.charAt(0) || 'U' }}
                                </div>
                                <div>
                                    <p class="font-bold text-text-main">
                                        {{ review.profiles?.full_name || 'Anonymous User' }}
                                    </p>
                                    <div class="flex items-center gap-2">
                                        <div class="flex text-yellow-500">
                                            <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg"
                                                class="h-3 w-3"
                                                :class="i <= review.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-600'"
                                                viewBox="0 0 20 20" fill="currentColor">
                                                <path
                                                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                        </div>
                                        <span class="text-xs text-text-muted">
                                            {{ new Date(review.created_at).toLocaleDateString() }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <p class="text-text-muted">{{ review.comment }}</p>
                        </div>
                    </div>
                </section>


                <section v-if="randomProducts && randomProducts.length > 0" class="space-y-4 sm:space-y-8 pt-4 sm:pt-8">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg sm:text-2xl md:text-3xl font-bold text-text-main">
                            You Might Also Like
                        </h2>
                        <NuxtLink to="/products" class="text-primary font-semibold hover:underline">
                            View All
                        </NuxtLink>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                        <div v-for="rp in randomProducts" :key="rp.id" @click="router.push(`/products/${rp.slug}`)"
                            class="group bg-surface rounded-2xl shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border border-bg-alt overflow-hidden flex flex-col cursor-pointer">
                            <div class="relative aspect-[4/3] overflow-hidden bg-bg-alt">
                                <img v-if="rp.image_url" :src="rp.image_url" :alt="rp.name"
                                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                                <defaultProduct v-else
                                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div
                                    class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                </div>
                                
                                <!-- Wishlist Button for suggested product -->
                                <button @click.stop="toggleWishlist(rp.id)"
                                  :class="[
                                    'absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm z-10 hover:scale-110',
                                    wishlistStore.isWishlisted(rp.id) 
                                      ? 'bg-red-500 text-white shadow-red-500/30' 
                                      : 'bg-surface/90 backdrop-blur-sm text-text-muted hover:text-red-500 hover:bg-surface'
                                  ]">
                                  <svg xmlns="http://www.w3.org/2000/svg" :fill="wishlistStore.isWishlisted(rp.id) ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                </button>
                            </div>
                            <div class="p-5 flex flex-col flex-grow">
                                <h3
                                    class="text-lg font-bold text-text-main mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                    {{ rp.name }}
                                </h3>
                                
                                <!-- Suggested Product Reviews -->
                                <div class="flex items-center gap-1 mb-2" v-if="rp.reviewCount > 0">
                                  <div class="flex text-yellow-500">
                                    <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" :class="i <= Math.round(rp.averageRating) ? 'fill-current' : 'text-gray-300 dark:text-gray-600'" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </div>
                                  <span class="text-[10px] text-text-muted font-semibold ml-1">{{ rp.averageRating.toFixed(1) }} ({{ rp.reviewCount }})</span>
                                </div>
                                <div class="flex items-center gap-1 mb-2 text-text-muted text-[10px] font-semibold" v-else>
                                  <div class="flex text-gray-300 dark:text-gray-600">
                                    <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </div>
                                  <span class="ml-1">No reviews</span>
                                </div>
                                <p class="text-text-muted text-sm mb-4 line-clamp-2 flex-grow">
                                    {{ rp.description }}
                                </p>
                                <div class="flex justify-between items-center mt-auto pt-4 border-t border-bg-alt">
                                    <span class="text-base sm:text-xl font-extrabold text-text-main">
                                        {{ formatIDR(rp.price) }}
                                    </span>
                                    <button @click.stop="isInCart(rp.id) ? router.push('/cart') : addToCart(rp.id)"
                                        :disabled="addingToCart === rp.id" :class="[
                                            'p-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
                                            isInCart(rp.id)
                                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                                        ]">
                                        <span v-if="addingToCart === rp.id"
                                            class="h-5 w-5 animate-spin rounded-full border-2 border-primary/40 border-t-primary"></span>
                                        <svg v-else-if="!isInCart(rp.id)" xmlns="http://www.w3.org/2000/svg"
                                            class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                            viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import defaultProduct from '../../components/defaultProduct.vue'
import { getUser } from '../../services/authService'
import { useReviewsStore } from '../../stores/reviewsStore'
import { supabase } from '../../utils/supabase'

const props = defineProps({
    slug: {
        type: String,
        required: true
    }
})

const router = useRouter();
const wishlistStore = useWishlistStore();
const reviewsStore = useReviewsStore();
const profileId = ref(null);
const sellerStore = ref(null)

onMounted(async () => {
    const user = await getUser();
    if (user) {
        profileId.value = user.id;
        await wishlistStore.stGetWishlists(user.id);
    }
});

const toggleWishlist = async (productId) => {
    if (!profileId.value) {
        const user = await getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        profileId.value = user.id;
    }
    await wishlistStore.stToggleWishlist(profileId.value, productId);
};

const {
    product,
    loading,
    error,
    addingToCart,
    formattedPrice,
    addToCart,
    productImages,
    selectedImage,
    randomProducts,
    cartStore,
    formatIDR
} = useProductDetailUI(props.slug)

watch(product, (newProduct) => {
    if (newProduct?.id) {
        reviewsStore.fetchReviews(newProduct.id)
    }
}, { immediate: true })

watch(product, async (newProduct) => {
    sellerStore.value = null
    if (!newProduct?.seller_id) return

    const { data, error } = await supabase
        .from('approved_seller_stores')
        .select('store_name, store_slug, store_description')
        .eq('id', newProduct.seller_id)
        .maybeSingle()

    if (!error) sellerStore.value = data
}, { immediate: true })

// reactive check
const isInCart = (productId) => {
    if (!productId) return false;
    const inList = (cartStore?.items ?? []).some((item) => item.product_id === productId);
    const isAdding = cartStore?.addingProducts?.[productId];
    return inList || isAdding;
};
</script>

<style scoped>
.pattern-grid {
    background-image: radial-gradient(circle at 1px 1px, rgb(var(--color-primary) / 0.14) 1px, transparent 0);
    background-size: 22px 22px;
}
</style>
