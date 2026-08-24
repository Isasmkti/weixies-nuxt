<template>
    
        <div class="max-w-[1600px] mx-auto font-poppins">
            <!-- Header -->

            <h1 class="text-4xl font-extrabold text-text-main mb-8 tracking-tight">Shopping Cart</h1>

            <!-- Loading State -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-24">
                <div
                    class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary shadow-lg shadow-primary/30">
                </div>
                <p class="mt-4 text-text-muted font-medium animate-pulse">Loading cart...</p>
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
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-text-main mb-2">Your cart is empty</h3>
                <p class="text-text-muted mb-8 max-w-sm font-montserrat">Looks like you haven't added anything to your
                    cart yet.</p>
                <NuxtLink to="/products"
                    class="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 font-semibold text-lg flex items-center gap-2">
                    Start Shopping
                </NuxtLink>
            </div>

            <!-- Cart Items -->
            <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

                <!-- Items List -->
                <div class="md:col-span-2 grid grid-cols-1 gap-8">
                    <div v-for="item in items" :key="item.id"
                        class="bg-surface rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-6 flex flex-row sm:flex-row items-start sm:items-center gap-4 sm:gap-6 border border-bg-alt/50 group">

                        <!-- Checkbox -->
                        <div class="flex items-center">
                            <input type="checkbox" :value="item.id" v-model="selectedItems"
                                class="w-5 h-5 rounded border-bg-alt text-primary focus:ring-primary/50 cursor-pointer accent-primary">
                        </div>

                        <!-- Product Image -->
                        <div @click="router.push(`/products/${item.product?.slug}`)"
                            class="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-bg-alt border border-bg-alt shadow-inner cursor-pointer">
                            <img :src="item.product?.image_url || 'https://via.placeholder.com/150'"
                                :alt="item.product?.name"
                                class="h-full w-full object-cover object-center group-hover:scale-110 transition-transform duration-500">
                        </div>

                        <!-- Details -->
                        <div @click="router.push(`/products/${item.product?.slug}`)" class="flex-grow cursor-pointer">
                            <h3
                                class="text-lg font-bold text-text-main font-poppins mb-1 group-hover:text-primary transition-colors">
                                {{ item.product?.name }}
                            </h3>
                            <p class="text-sm text-text-muted font-montserrat line-clamp-1 mb-2">{{
                                item.product?.description }}</p>
                            <p class="text-lg font-bold text-primary font-poppins">{{ formatIDR(item.product?.price) }}
                            </p>
                        </div>

                        <!-- Actions -->
                        <button @click="removeFromCart(item.id)"
                            class="text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-xl transition-all duration-200 self-end sm:self-center"
                            title="Remove from cart">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Order Summary -->
                <div class="md:col-span-1 md:relative ">
                    <aside class="bg-surface rounded-2xl md:rounded-none shadow-lg md:shadow-[-4px_0_24px_rgba(0,0,0,0.02)] border border-bg-alt/50 md:border-y-0 md:border-r-0 md:border-l p-6 sm:p-8 sticky top-28 md:top-0 md:-mt-8 md:-mr-8 md:h-screen md:pt-12 md:flex md:flex-col z-10">
                        <h2 class="text-xl font-bold text-text-main mb-6 font-poppins">Order Summary</h2>

                        <div class="space-y-4 mb-6">
                            <div class="flex justify-between items-center text-text-muted font-montserrat">
                                <span>Subtotal</span>
                                <span>{{ formatIDR(total) }}</span>
                            </div>
                            <div class="flex justify-between items-center text-text-muted font-montserrat">
                                <span>Tax</span>
                                <span>{{ formatIDR(0) }}</span>
                            </div>
                            <div class="border-t border-bg-alt pt-4 flex justify-between items-end">
                                <span class="font-bold text-text-main">Total</span>
                                <span class="text-lg md:text-3xl font-extrabold text-primary font-poppins">{{ formatIDR(total)
                                    }}</span>
                            </div>
                        </div>

                        <button
                            @click="handleCheckout"
                            :disabled="isCheckingOut"
                            class="w-full bg-gradient-to-r from-primary to-primary-dark text-white py-4 rounded-xl hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 font-bold text-lg flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed">
                            <span v-if="isCheckingOut">Memproses...</span>
                            <span v-else>Bayar!</span>
                            <svg xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </button>

                        <div
                            class="mt-6 flex items-center justify-center gap-2 text-text-muted text-xs font-montserrat opacity-70">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>Secure Checkout</span>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import { useCartStore } from '../stores/cartStore'
import { getUser } from '../services/authService'
import { supabase } from '../utils/supabase'
import { useRouter } from 'vue-router'
import { formatIDR } from '../utils/currency'
import Swal from 'sweetalert2'

const router = useRouter()
const cartStore = useCartStore()

const items = computed(() => cartStore.items)
const loading = computed(() => cartStore.loading)
const error = computed(() => cartStore.error)

const selectedItems = ref([])
const currentUser = ref(null)
const isCheckingOut = ref(false)

const total = computed(() => {
    return items.value.reduce((sum, item) => {
        if (selectedItems.value.includes(item.id)) {
            return sum + (Number(item.product?.price) || 0)
        }
        return sum
    }, 0)
})

onMounted(async () => {
    const user = await getUser()
    if (!user) {
        router.push('/login')
        return
    }
    currentUser.value = user
    await cartStore.stGetCart(user.id)
})

const removeFromCart = async (itemId) => {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        background: 'rgb(var(--color-surface))',
        color: 'rgb(var(--color-text))',
        confirmButtonColor: 'rgb(var(--color-primary))',
        cancelButtonColor: '#ef4444',
        showCancelButton: true,
        confirmButtonText: 'Yes, remove it!',
        customClass: {
            popup: 'rounded-2xl shadow-xl'
        }
    })
    if (result.isConfirmed) {
        await cartStore.stRemoveFromCart(itemId)
    }
}

const handleCheckout = async () => {
    const checkoutItems = items.value.filter(item => selectedItems.value.includes(item.id))
    
    if (checkoutItems.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'No items selected',
            text: 'Please select at least one item to checkout.',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
        return
    }

    // For digital products: process each item as a separate order
    if (checkoutItems.length > 1) {
        Swal.fire({
            icon: 'info',
            title: 'One product at a time',
            text: 'Please select one product to checkout at a time for digital purchases.',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
        return
    }

    const item = checkoutItems[0]

    try {
        isCheckingOut.value = true

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        const payload = {
            product_id: item.product.id,
            customerName: currentUser.value?.user_metadata?.full_name || currentUser.value?.email?.split('@')[0] || 'Customer',
        }

        const response = await $fetch('/api/checkout', {
            method: 'POST',
            headers: {
                Authorization: token ? `Bearer ${token}` : ''
            },
            body: payload
        })

        if (response?.payment_url) {
            window.location.href = response.payment_url
            return
        }

        throw new Error('Payment URL is unavailable.')
    } catch (err) {
        console.error('Checkout error:', err)
        Swal.fire({
            title: 'Error', 
            text: err?.message || 'Failed to initialize checkout.',
            icon: 'error',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
    } finally {
        isCheckingOut.value = false
    }
}
</script>
