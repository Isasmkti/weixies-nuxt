<template>
    <section class="overflow-hidden bg-bg-alt py-20 md:py-28 lg:py-36">
        <div class="mx-auto mb-12 max-w-7xl px-6 sm:px-8 md:mb-16 lg:px-12">
            <p class="text-center text-xs font-black uppercase tracking-[0.25em] text-primary md:text-sm">
                Pilihan terbaru
            </p>
            <h2 class="mt-4 text-center text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl md:text-5xl lg:text-6xl">
                Jelajahi produk pilihan
            </h2>
            <p class="mx-auto mt-4 max-w-2xl text-center text-base font-medium leading-relaxed text-text-muted sm:text-lg md:mt-6 md:text-xl">
                Produk terbaru dari katalog Weixies, diperbarui langsung dari toko para seller.
            </p>
        </div>

        <div v-if="store.productsLoading" class="flex gap-6 overflow-hidden px-6 py-8 sm:gap-8">
            <div
                v-for="index in 5"
                :key="index"
                class="h-[350px] w-[280px] flex-none animate-pulse overflow-hidden rounded-[1.75rem] border border-text-main/5 bg-surface sm:w-[340px]"
            >
                <div class="aspect-[4/3] bg-text-muted/10"></div>
                <div class="space-y-4 p-6">
                    <div class="h-3 w-24 rounded-full bg-text-muted/10"></div>
                    <div class="h-6 w-4/5 rounded-full bg-text-muted/10"></div>
                    <div class="h-5 w-1/3 rounded-full bg-text-muted/10"></div>
                </div>
            </div>
        </div>

        <div v-else-if="store.productsError" class="mx-auto max-w-xl px-6 py-8 text-center">
            <div class="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-600 dark:text-red-300">
                <p class="font-bold">Produk belum dapat dimuat.</p>
                <p class="mt-2 text-sm opacity-80">{{ store.productsError }}</p>
                <button
                    type="button"
                    class="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark"
                    @click="store.stAll()"
                >
                    Coba lagi
                </button>
            </div>
        </div>

        <div v-else-if="!store.products.length" class="mx-auto max-w-xl px-6 py-8 text-center">
            <div class="rounded-3xl border border-dashed border-text-main/10 bg-surface p-8">
                <p class="font-black text-text-main">Belum ada produk yang dipublikasikan.</p>
                <NuxtLink to="/products" class="mt-4 inline-flex font-bold text-primary transition hover:text-primary-dark">
                    Buka katalog
                </NuxtLink>
            </div>
        </div>

        <div v-else class="carousel-shell relative flex w-full overflow-hidden py-8 md:py-10">
            <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-bg-alt to-transparent sm:w-24"></div>
            <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-bg-alt to-transparent sm:w-24"></div>

            <div class="animate-scroll flex w-max">
                <div
                    v-for="copyIndex in 2"
                    :key="copyIndex"
                    class="carousel-segment flex shrink-0 gap-6 pr-6 sm:gap-8 sm:pr-8"
                    :aria-hidden="copyIndex === 2 ? 'true' : undefined"
                >
                    <NuxtLink
                        v-for="(product, index) in carouselProducts"
                        :key="`${copyIndex}-${product.id}-${index}`"
                        :to="`/products/${product.slug}`"
                        :tabindex="copyIndex === 2 ? -1 : undefined"
                        class="group/card relative flex h-[350px] w-[280px] flex-none flex-col overflow-hidden rounded-[1.75rem] border border-text-main/5 bg-surface shadow-xl shadow-text-main/5 transition-all duration-500 hover:-translate-y-2 hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:w-[340px]"
                    >
                        <div class="relative aspect-[4/3] overflow-hidden bg-bg-alt">
                            <img
                                v-if="getProductImage(product)"
                                :src="getProductImage(product)"
                                :alt="product.name"
                                class="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                                loading="lazy"
                            >
                            <div v-else class="flex h-full w-full items-center justify-center text-text-muted/40">
                                <svg class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm12.75-11.25h.008v.008H15V8.25Z" />
                                </svg>
                            </div>

                            <span v-if="getProductCategory(product)" class="absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-surface/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary shadow-sm backdrop-blur">
                                {{ getProductCategory(product) }}
                            </span>
                        </div>

                        <div class="flex flex-1 flex-col p-6">
                            <h3 class="line-clamp-2 text-xl font-black tracking-tight text-text-main transition-colors group-hover/card:text-primary">
                                {{ product.name }}
                            </h3>
                            <p class="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-text-muted">
                                {{ product.description || 'Produk pilihan dari katalog Weixies.' }}
                            </p>
                            <div class="mt-auto flex items-center justify-between border-t border-bg-alt pt-4">
                                <span class="text-lg font-black text-text-main">{{ formatIDR(product.price) }}</span>
                                <span class="inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                                    Detail
                                    <svg class="h-4 w-4 transition-transform group-hover/card:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m9 5 7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </NuxtLink>
                </div>
            </div>
        </div>

        <div class="mt-8 text-center">
            <NuxtLink
                to="/products"
                class="inline-flex items-center justify-center rounded-full border border-primary/20 bg-surface px-6 py-3 text-sm font-black text-primary shadow-sm transition hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
                Lihat semua produk
            </NuxtLink>
        </div>
    </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useWelcomeStore } from '../stores/welcomeStore'
import { formatIDR } from '../utils/currency'

const store = useWelcomeStore()

const carouselProducts = computed(() => {
    const products = store.products || []
    if (!products.length) return []

    const repetitions = Math.max(1, Math.ceil(8 / products.length))
    return Array.from({ length: repetitions }, () => products).flat()
})

const getProductImage = (product) => {
    const images = product?.product_images || []
    return images.find((image) => image.is_primary)?.image_url
        || images[0]?.image_url
        || product?.image_url
        || null
}

const getProductCategory = (product) => {
    return product?.product_categories?.[0]?.categories?.name || null
}

onMounted(() => {
    store.stAll()
})
</script>

<style scoped>
.animate-scroll {
    animation: product-scroll 70s linear infinite;
    will-change: transform;
}

.carousel-shell:hover .animate-scroll,
.carousel-shell:focus-within .animate-scroll {
    animation-play-state: paused;
}

@keyframes product-scroll {
    from {
        transform: translateX(0);
    }
    to {
        transform: translateX(-50%);
    }
}

@media (prefers-reduced-motion: reduce) {
    .animate-scroll {
        animation: none;
    }

    .carousel-shell {
        overflow-x: auto;
    }
}
</style>
