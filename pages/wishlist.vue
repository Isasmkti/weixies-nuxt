<template>
    
        <div class="max-w-[1600px] mx-auto font-poppins">
            <!-- Header -->
            <div
                class="flex items-center gap-4 mb-10 hover:translate-x-1 transition-transform w-fit cursor-pointer group">
                <NuxtLink to="/products"
                    class="flex items-center gap-2 text-text-muted hover:text-primary transition-colors">
                    <div class="bg-surface p-2 rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </div>
                    <span class="font-medium">Back to Catalog</span>
                </NuxtLink>
            </div>

            <h1 class="text-4xl font-extrabold text-text-main mb-8 tracking-tight">Your Wishlist</h1>

            <!-- Loading State -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-24">
                <div
                    class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary shadow-lg shadow-primary/30">
                </div>
                <p class="mt-4 text-text-muted font-medium animate-pulse">Loading wishlist...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error"
                class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-2xl flex items-center gap-3"
                role="alert">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="font-medium">{{ error }}</span>
            </div>

            <!-- Empty State -->
            <div v-else-if="items.length === 0"
                class="text-center py-20 bg-surface rounded-3xl shadow-sm border border-bg-alt flex flex-col items-center">
                <div class="w-24 h-24 bg-bg-alt rounded-full flex items-center justify-center mb-6 text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-text-main mb-2">Your wishlist is empty</h3>
                <p class="text-text-muted mb-8 max-w-sm font-montserrat">Looks like you haven't added anything to your
                    wishlist yet.</p>
                <NuxtLink to="/products"
                    class="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 font-semibold text-lg flex items-center gap-2">
                    Start Shopping
                </NuxtLink>
            </div>

            <!-- Wishlist Items -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <div v-for="item in items" :key="item.id"
                    class="bg-surface rounded-2xl shadow-sm border overflow-hidden group hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
                    :class="isOwnProduct(item.product) ? 'border-red-300 dark:border-red-900/70' : 'border-bg-alt/50 hover:shadow-primary/5'"
                    @click="router.push(`/products/${item.product?.slug}`)">
                    
                    <!-- Product Image Container -->
                    <div class="relative pt-[100%] overflow-hidden bg-bg-alt">
                        <img v-if="item.product?.image_url" :src="item.product.image_url"
                             :alt="item.product?.name"
                             class="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out z-0">
                        <defaultProduct v-else class="absolute inset-0 h-full w-full p-12 text-text-muted/40" />
                        
                        <!-- Overlay gradient for text readability if needed -->
                        <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <!-- Remove Button -->
                        <button @click.stop="removeFromWishlist(item.product_id)"
                                class="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm text-red-500 hover:text-white hover:bg-red-500 hover:scale-110 transition-all duration-300 z-20 shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 fill-current" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <!-- Product Info -->
                    <div class="p-5 flex flex-col flex-grow">
                        <div class="mb-2">
                            <h3 class="font-bold text-lg text-text-main font-poppins line-clamp-1 group-hover:text-primary transition-colors">
                                {{ item.product?.name }}
                            </h3>
                            <p class="text-sm text-text-muted font-montserrat mt-1 line-clamp-2">
                                {{ item.product?.description }}
                            </p>
                            <p v-if="isOwnProduct(item.product)" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                                This product belongs to your store and cannot be purchased.
                            </p>
                        </div>
                        
                        <div class="mt-auto pt-4 flex items-center justify-between">
                            <span class="font-extrabold text-lg text-primary font-poppins">
                                {{ formatIDR(item.product?.price) }}
                            </span>
                            
                            <!-- Add to Cart (Optional) -->
                            <button v-if="!isOwnProduct(item.product)" @click.stop="addToCart(item.product)"
                                    class="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors duration-300 shadow-sm"
                                    title="Add to Cart">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'

import { useWishlistStore } from '../stores/wishlistStore'
import { useCartStore } from '../stores/cartStore'
import { getUser } from '../services/authService'
import { getCurrentSeller } from '../services/sellerService'
import { useRouter } from 'vue-router'
import { formatIDR } from '../utils/currency'
import Swal from 'sweetalert2'
import defaultProduct from '../components/defaultProduct.vue'

const router = useRouter()
const wishlistStore = useWishlistStore()
const cartStore = useCartStore()

const items = computed(() => wishlistStore.items)
const loading = computed(() => wishlistStore.loading)
const error = computed(() => wishlistStore.error)

const profileId = ref(null)
const currentSeller = ref(null)
const isOwnProduct = (product) => Boolean(
    product?.seller_id
    && currentSeller.value?.id
    && String(product.seller_id) === String(currentSeller.value.id)
)

onMounted(async () => {
    const user = await getUser()
    if (!user) {
        router.push('/login')
        return
    }
    profileId.value = user.id
    const [seller] = await Promise.all([
        getCurrentSeller(),
        wishlistStore.stGetWishlists(user.id),
    ])
    currentSeller.value = seller
})

const removeFromWishlist = async (productId) => {
    const result = await Swal.fire({
        title: 'Remove from wishlist?',
        text: "You can always add it back later.",
        icon: 'question',
        background: 'rgb(var(--color-surface))',
        color: 'rgb(var(--color-text))',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: 'rgb(var(--color-bg-alt))',
        showCancelButton: true,
        confirmButtonText: 'Remove',
        customClass: {
            popup: 'rounded-2xl shadow-xl'
        }
    })
    
    if (result.isConfirmed) {
        await wishlistStore.stToggleWishlist(profileId.value, productId)
    }
}

const addToCart = async (product) => {
    if (isOwnProduct(product)) return
    const licenses = [...(product?.product_licenses || [])]
        .filter((license) => license.is_active !== false)
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    if (licenses.length !== 1) {
        if (product?.slug) router.push(`/products/${product.slug}`)
        return
    }
    try {
        await cartStore.stAddToCart(profileId.value, product.id, licenses[0].id)
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Added to cart',
            showConfirmButton: false,
            timer: 3000,
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
        })
    } catch (err) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: err?.message || 'Failed to add to cart',
            showConfirmButton: false,
            timer: 3000,
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
        });
    }
}
</script>
