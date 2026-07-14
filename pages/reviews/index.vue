<template>
    <div class="max-w-[1600px] mx-auto font-poppins">
        <div class="flex items-center gap-3 mb-8">
            <h1 class="text-xl md:text-3xl font-extrabold text-text-main">
                Reviews
            </h1>
            <span
                class="rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider px-3 py-1">
                Test
            </span>
        </div>
        <p class="text-text-muted mb-8 font-montserrat">
            Pick a product to write a review for. (Temporary entry point — final flow will live behind completed
            orders.)
        </p>

        <div v-if="productsStore.loading" class="flex flex-col items-center justify-center py-24">
            <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
            <p class="mt-4 text-text-muted font-medium animate-pulse">Loading products...</p>
        </div>

        <div v-else-if="!productsStore.products.length"
            class="flex flex-col items-center justify-center py-24 text-center text-text-muted">
            <p>No products available.</p>
        </div>

        <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            <NuxtLink v-for="product in productsStore.products" :key="product.id" :to="`/reviews/${product.slug}`"
                class="group bg-surface rounded-xl md:rounded-2xl shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border border-bg-alt overflow-hidden flex flex-col">
                <div class="relative aspect-[4/3] overflow-hidden bg-bg-alt">
                    <img v-if="product.image_url" :src="product.image_url" :alt="product.name"
                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div class="p-3 md:p-5 flex flex-col flex-grow">
                    <h3
                        class="text-sm md:text-lg font-bold text-text-main mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                        {{ product.name }}
                    </h3>
                    <div class="flex items-center gap-1 mb-3" v-if="product.reviewCount > 0">
                        <div class="flex text-yellow-500">
                            <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4"
                                :class="i <= Math.round(product.averageRating) ? 'fill-current' : 'text-gray-300 dark:text-gray-600'"
                                viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </div>
                        <span class="text-[10px] md:text-xs text-text-muted font-semibold ml-1">{{
                            product.averageRating.toFixed(1) }} ({{ product.reviewCount }})</span>
                    </div>
                    <div class="flex items-center gap-1 mb-3 text-text-muted text-[10px] md:text-xs font-semibold"
                        v-else>
                        <span>No reviews yet</span>
                    </div>
                    <span
                        class="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary text-[11px] md:text-sm font-semibold px-3 py-2 group-hover:bg-primary group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Write Review
                    </span>
                </div>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useProductsStore } from '../../stores/productsStore'

const productsStore = useProductsStore()

onMounted(async () => {
    if (productsStore.products.length === 0) {
        await productsStore.ensureProductsLoaded({ page: 1, force: false })
    }
})
</script>
