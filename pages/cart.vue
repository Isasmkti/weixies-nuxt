<template>
    <div class="mx-auto max-w-[1400px] font-poppins">
        <header class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your order</p>
                <h1 class="mt-1 text-3xl font-black tracking-tight text-text-main sm:text-4xl">Shopping cart</h1>
                <p class="mt-2 text-sm text-text-muted">
                    {{ items.length ? `${items.length} ${items.length === 1 ? 'product' : 'products'} ready for checkout.` : 'Review your selected digital products.' }}
                </p>
            </div>
            <NuxtLink to="/products" class="inline-flex w-fit items-center gap-2 rounded-xl border border-bg-alt bg-surface px-4 py-2.5 text-sm font-bold text-text-main transition hover:border-primary/30 hover:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" />
                </svg>
                Continue shopping
            </NuxtLink>
        </header>

        <div v-if="loading" class="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-bg-alt bg-surface">
            <span class="h-11 w-11 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span>
            <p class="mt-4 text-sm font-semibold text-text-muted">Loading your cart...</p>
        </div>

        <div v-else-if="error" class="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400" role="alert">
            <svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div><p class="font-bold">Unable to load your cart</p><p class="mt-1 text-sm">{{ error }}</p></div>
        </div>

        <div v-else-if="items.length === 0" class="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-bg-alt bg-surface px-6 py-16 text-center shadow-sm">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M2.25 2.25h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-2.59M7.5 14.25 5.106 4.522M6.75 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
            </div>
            <h2 class="mt-6 text-2xl font-black text-text-main">Your cart is empty</h2>
            <p class="mt-2 max-w-md text-sm leading-relaxed text-text-muted">Explore the catalog and add a digital product you would like to purchase.</p>
            <NuxtLink to="/products" class="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary-dark">
                Explore products
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6" /></svg>
            </NuxtLink>
        </div>

        <div v-else class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
            <section class="min-w-0">
                <div class="mb-4 flex items-center justify-between rounded-xl border border-bg-alt bg-surface px-4 py-3">
                    <label class="flex cursor-pointer items-center gap-3 text-sm font-bold text-text-main">
                        <input type="checkbox" :checked="allItemsSelected" :disabled="!purchasableItems.length" class="h-4 w-4 cursor-pointer rounded border-bg-alt accent-primary focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50" @change="toggleAllItems">
                        Select all
                    </label>
                    <span class="text-xs font-semibold text-text-muted">{{ selectedItems.length }} of {{ purchasableItems.length }} available selected</span>
                </div>

                <div class="space-y-4">
                    <article v-for="item in items" :key="item.id" class="group relative rounded-2xl border bg-surface p-4 transition duration-200 sm:p-5" :class="isConflictingItem(item) ? 'border-red-300 bg-red-50/50 dark:border-red-900/70 dark:bg-red-950/10' : selectedItems.includes(item.id) ? 'border-primary/40 shadow-md shadow-primary/5' : 'border-bg-alt hover:border-primary/20 hover:shadow-md'">
                        <div class="flex items-start gap-3 sm:gap-5">
                            <label class="mt-1 flex shrink-0 cursor-pointer items-center" :aria-label="`Select ${item.product?.name || 'product'}`">
                                <input v-model="selectedItems" type="checkbox" :value="item.id" :disabled="isConflictingItem(item)" class="h-5 w-5 cursor-pointer rounded border-bg-alt accent-primary focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
                            </label>

                            <button type="button" class="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl border border-bg-alt bg-bg-alt sm:w-36" @click="openProduct(item)">
                                <img v-if="item.product?.image_url" :src="item.product.image_url" :alt="item.product?.name || 'Product image'" class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
                                <defaultProduct v-else class="h-full w-full p-7 text-text-muted/40" />
                            </button>

                            <div class="min-w-0 flex-1 pr-8 sm:pr-10">
                                <button type="button" class="block max-w-full text-left" @click="openProduct(item)">
                                    <h2 class="line-clamp-2 text-base font-black leading-snug text-text-main transition group-hover:text-primary sm:text-lg">{{ item.product?.name || 'Unavailable product' }}</h2>
                                </button>
                                <p class="mt-1 hidden line-clamp-2 text-sm leading-relaxed text-text-muted sm:block">{{ item.product?.description || 'No product description available.' }}</p>
                                <p v-if="isConflictingItem(item)" class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                    This product cannot be purchased because it belongs to your store.
                                </p>
                                <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span class="text-base font-black text-primary sm:text-lg">{{ formatIDR(item.product_license?.price) }}</span>
                                    <span class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{{ item.product_license?.name || 'License unavailable' }}</span>
                                    <span class="inline-flex items-center gap-1 text-xs font-semibold text-text-muted">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                        Instant digital delivery
                                    </span>
                                </div>
                            </div>

                            <button type="button" title="Remove from cart" aria-label="Remove from cart" class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 sm:right-4 sm:top-4" @click="removeFromCart(item.id)">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.166L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-1.327L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0V4.477c0-1.08-.827-1.98-1.904-2.014a48.1 48.1 0 0 0-3.692 0C9.077 2.497 8.25 3.397 8.25 4.477v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                            </button>
                        </div>
                    </article>
                </div>
            </section>

            <aside class="rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm lg:sticky lg:top-6 sm:p-6">
                <h2 class="text-xl font-black text-text-main">Order summary</h2>
                <p class="mt-1 text-xs leading-relaxed text-text-muted">Digital products are processed one at a time.</p>

                <div class="mt-6 space-y-4 text-sm">
                    <div class="flex items-center justify-between text-text-muted"><span>Selected products</span><span class="font-bold text-text-main">{{ selectedItems.length }}</span></div>
                    <div class="flex items-center justify-between text-text-muted"><span>Subtotal</span><span class="font-semibold text-text-main">{{ formatIDR(total) }}</span></div>
                    <div class="flex items-center justify-between text-text-muted"><span>Tax</span><span class="font-semibold text-text-main">{{ formatIDR(0) }}</span></div>
                </div>

                <div class="my-5 border-t border-bg-alt"></div>
                <div class="flex items-end justify-between gap-4">
                    <span class="font-bold text-text-main">Total</span>
                    <span class="text-right text-2xl font-black tracking-tight text-primary">{{ formatIDR(total) }}</span>
                </div>

                <div v-if="conflictingItems.length" class="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">Remove products from your own store before checking out.</div>
                <div v-else-if="selectedItems.length > 1" class="mt-5 rounded-xl bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Select only one product to continue with a digital purchase.</div>
                <div v-else-if="selectedItems.length === 0" class="mt-5 rounded-xl bg-bg-alt/60 p-3 text-xs font-medium leading-relaxed text-text-muted">Select one product from your cart to continue.</div>

                <button type="button" :disabled="selectedItems.length !== 1 || conflictingItems.length > 0 || isCheckingOut" class="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0" @click="handleCheckout">
                    <span v-if="isCheckingOut" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    <span>{{ isCheckingOut ? 'Processing...' : 'Proceed to checkout' }}</span>
                    <svg v-if="!isCheckingOut" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                </button>

                <div class="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                    Secure checkout
                </div>
            </aside>
        </div>
    </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import { useCartStore } from '../stores/cartStore'
import { getUser } from '../services/authService'
import { getCurrentSeller } from '../services/sellerService'
import { supabase } from '../utils/supabase'
import { useRouter } from 'vue-router'
import { formatIDR } from '../utils/currency'
import Swal from 'sweetalert2'
import defaultProduct from '../components/defaultProduct.vue'
import { findSelfPurchaseProductIds } from '../utils/selfPurchase'

const router = useRouter()
const cartStore = useCartStore()

const items = computed(() => cartStore.items)
const loading = computed(() => cartStore.loading)
const error = computed(() => cartStore.error)

const selectedItems = ref([])
const currentUser = ref(null)
const currentSeller = ref(null)
const isCheckingOut = ref(false)
const serverConflictProductIds = ref([])

const ownProductIds = computed(() => findSelfPurchaseProductIds(items.value, currentSeller.value?.id))
const conflictingProductIdSet = computed(() => new Set([
    ...ownProductIds.value,
    ...serverConflictProductIds.value.map(Number),
]))
const isConflictingItem = (item) => conflictingProductIdSet.value.has(Number(item.product_id ?? item.product?.id))
const conflictingItems = computed(() => items.value.filter(isConflictingItem))
const purchasableItems = computed(() => items.value.filter((item) => !isConflictingItem(item)))

const allItemsSelected = computed(() => {
    return purchasableItems.value.length > 0 && purchasableItems.value.every(item => selectedItems.value.includes(item.id))
})

const total = computed(() => {
    return items.value.reduce((sum, item) => {
        if (selectedItems.value.includes(item.id)) {
            return sum + (Number(item.product_license?.price) || 0)
        }
        return sum
    }, 0)
})

const toggleAllItems = (event) => {
    selectedItems.value = event.target.checked ? purchasableItems.value.map(item => item.id) : []
}

const openProduct = (item) => {
    if (item.product?.slug) router.push(`/products/${item.product.slug}`)
}

onMounted(async () => {
    const user = await getUser()
    if (!user) {
        router.push('/login')
        return
    }
    currentUser.value = user
    const [seller] = await Promise.all([
        getCurrentSeller(),
        cartStore.stGetCart(user.id),
    ])
    currentSeller.value = seller
    selectedItems.value = selectedItems.value.filter((id) => purchasableItems.value.some((item) => item.id === id))
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
        selectedItems.value = selectedItems.value.filter(id => id !== itemId)
    }
}

const handleCheckout = async () => {
    if (conflictingItems.value.length) {
        Swal.fire({
            icon: 'warning',
            title: 'Remove your store products',
            text: 'Remove products from your own store before checking out.',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
        return
    }
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
            product_license_id: item.product_license_id,
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
        const errorData = err?.data?.data || err?.data || {}
        if (Array.isArray(errorData.conflicting_product_ids)) {
            serverConflictProductIds.value = errorData.conflicting_product_ids.map(Number)
            selectedItems.value = selectedItems.value.filter((id) => purchasableItems.value.some((cartItem) => cartItem.id === id))
        }
        Swal.fire({
            title: 'Error', 
            text: errorData.message || err?.data?.statusMessage || err?.message || 'Failed to initialize checkout.',
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
