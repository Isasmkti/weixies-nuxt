<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const { profile } = useAuth()
const openAdminGroup = ref(null)

const icons = {
    dashboard: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    store: 'M3 9.75L5.25 4.5h13.5L21 9.75M3 9.75h18M3 9.75v8.625A1.125 1.125 0 004.125 19.5h15.75A1.125 1.125 0 0021 18.375V9.75M9 19.5v-4.125A1.125 1.125 0 0110.125 14.25h3.75A1.125 1.125 0 0115 15.375V19.5',
    catalog: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    cart: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 4.7 15.3c-.63.63-.18 1.7.71 1.7H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    home: 'M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10',
    content: 'M4 5.25A2.25 2.25 0 0 1 6.25 3h11.5A2.25 2.25 0 0 1 20 5.25v13.5A2.25 2.25 0 0 1 17.75 21H6.25A2.25 2.25 0 0 1 4 18.75V5.25ZM8 7h8M8 11h8M8 15h5',
    products: 'M20 7l-8-4-8 4m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    manage: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.62.85 1.02 1.52 1.02H21v4h-.08c-.67 0-1.27.4-1.52 1Z',
    carousel: 'M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9zM7 14l2.5-2.5 2 2L15 10l3 4',
    banner: 'M3 5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25v13.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V5.25zM3 15l4.5-4.5 3.75 3.75L15 10.5l6 6',
    review: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    category: 'M20 13V6a2 2 0 0 0-2-2h-5.5a2 2 0 0 0-1.4.58L4.58 11.1a2 2 0 0 0 0 2.82l5.5 5.5a2 2 0 0 0 2.82 0l6.52-6.52A2 2 0 0 0 20 13Z',
    list: 'M4 6h16M4 12h16M4 18h16',
    orders: 'M3.75 4.5h16.5v3.75H3.75V4.5Zm1.5 3.75v10.5h13.5V8.25M9 13h6',
    payout: 'M2.25 18.75a60 60 0 0 1 17.48 1.06l.87-2.6M2.25 18.75V5.25A2.25 2.25 0 0 1 4.5 3h9.75a2.25 2.25 0 0 1 2.25 2.25v4.5M16.5 9.75h3.75a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H16.5A1.5 1.5 0 0 1 15 15v-3.75a1.5 1.5 0 0 1 1.5-1.5Z',
    logs: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    knowledge: 'M12 6.25v13m0-13C10.83 5.48 9.25 5 7.5 5A4.5 4.5 0 0 0 3 9.5v9A4.5 4.5 0 0 1 7.5 14c1.75 0 3.33.48 4.5 1.25m0-9C13.17 5.48 14.75 5 16.5 5A4.5 4.5 0 0 1 21 9.5v9a4.5 4.5 0 0 0-4.5-4.5c-1.75 0-3.33.48-4.5 1.25',
}

const userMenuItems = [
    { name: 'Dashboard', to: '/dashboard', icon: icons.dashboard },
    { name: 'Shop', to: '/seller', sellerOnly: true, icon: icons.store },
    { name: 'Catalog', to: '/products', icon: icons.catalog },
    { name: 'Cart', to: '/cart', icon: icons.cart },
    { name: 'Home', to: '/', exact: true, icon: icons.home },
]

const adminMenuItems = [
    { name: 'Dashboard', to: '/admin', exact: true, icon: icons.dashboard },
    {
        name: 'Content', key: 'content', icon: icons.content,
        children: [
            { name: 'Home Carousel', to: '/admin/home-carousel', icon: icons.carousel },
            { name: 'Sign-up Banner', to: '/admin/signup-banner', icon: icons.banner },
            { name: 'Welcome Page', to: '/admin/welcome', icon: icons.home },
        ],
    },
    {
        name: 'Products', key: 'products', base: '/admin/products', icon: icons.products,
        children: [
            { name: 'All Products', to: '/admin/products', exact: true, icon: icons.list },
            { name: 'Product Review', to: '/admin/products/review', icon: icons.review },
            { name: 'Product Categories', to: '/admin/products/categories', icon: icons.category },
        ],
    },
    {
        name: 'Manage', key: 'manage', icon: icons.manage,
        children: [
            { name: 'Seller Applications', to: '/admin/sellers', icon: icons.store },
            { name: 'Orders & Refunds', to: '/admin/orders', icon: icons.orders },
            { name: 'Automatic Payouts', to: '/admin/payouts', icon: icons.payout },
            { name: 'Activity Logs', to: '/admin/logs', icon: icons.logs },
            { name: 'AI Knowledge', to: '/admin/ai/knowledge', icon: icons.knowledge },
        ],
    },
    { name: 'Shop', to: '/', exact: true, icon: icons.home },
]

const isAdmin = computed(() => profile.value?.role === 'admin')
const menuItems = computed(() => userMenuItems.filter(item => !item.sellerOnly || profile.value?.is_seller === true))
const routeIsActive = item => item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`)
const groupIsActive = item => Boolean(item.base && route.path.startsWith(item.base)) || item.children?.some(routeIsActive)
const selectedAdminGroup = computed(() => adminMenuItems.find(item => item.key === openAdminGroup.value))

const toggleAdminGroup = key => {
    openAdminGroup.value = openAdminGroup.value === key ? null : key
}

watch(() => route.fullPath, () => {
    openAdminGroup.value = null
})
</script>

<template>
    <template v-if="isAdmin">
        <Transition name="mobile-sheet-backdrop">
            <button v-if="selectedAdminGroup" type="button" class="fixed inset-0 z-40 bg-black/25 md:hidden" aria-label="Close admin menu" @click="openAdminGroup = null" />
        </Transition>

        <Transition name="mobile-sheet">
            <section v-if="selectedAdminGroup" class="admin-mobile-sheet fixed inset-x-3 z-[60] mx-auto max-w-md overflow-hidden rounded-ui-lg border border-border bg-surface shadow-2xl md:hidden" :aria-label="`${selectedAdminGroup.name} navigation`">
                <div class="flex items-center justify-between border-b border-border px-4 py-3">
                    <div><p class="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Admin menu</p><h2 class="text-base font-bold text-text-main">{{ selectedAdminGroup.name }}</h2></div>
                    <button type="button" class="rounded-full p-2 text-text-muted transition hover:bg-bg-alt hover:text-text-main" aria-label="Close menu" @click="openAdminGroup = null">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 6 12 12M18 6 6 18" /></svg>
                    </button>
                </div>
                <div class="grid max-h-[55vh] grid-cols-1 gap-1 overflow-y-auto p-2">
                    <NuxtLink v-for="child in selectedAdminGroup.children" :key="child.name" :to="child.to" :class="['flex min-h-12 items-center gap-3 rounded-ui-md px-3 py-2.5 transition', routeIsActive(child) ? 'bg-primary/10 font-semibold text-primary' : 'text-text-main hover:bg-bg-alt']">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-sm bg-bg-alt text-primary"><svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="child.icon" /></svg></span>
                        <span class="min-w-0 flex-1 text-sm">{{ child.name }}</span>
                        <svg class="h-4 w-4 shrink-0 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                    </NuxtLink>
                </div>
            </section>
        </Transition>

        <nav class="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-border bg-surface px-1 pb-safe pt-1 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:hidden" aria-label="Admin mobile navigation">
            <div class="grid h-16 grid-cols-5 items-stretch">
                <template v-for="item in adminMenuItems" :key="item.name">
                    <button v-if="item.children" type="button" :aria-expanded="openAdminGroup === item.key" :class="['relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-ui-sm px-1 text-text-muted transition-colors', groupIsActive(item) || openAdminGroup === item.key ? 'text-primary' : 'hover:text-primary']" @click="toggleAdminGroup(item.key)">
                        <span class="relative"><svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" /></svg><svg class="absolute -right-2.5 -top-1 h-3 w-3 transition-transform" :class="openAdminGroup === item.key ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m6 15 6-6 6 6" /></svg></span>
                        <span class="max-w-full truncate text-[9px] font-medium">{{ item.name }}</span>
                    </button>
                    <NuxtLink v-else :to="item.to" :class="['flex min-w-0 flex-col items-center justify-center gap-1 rounded-ui-sm px-1 text-text-muted transition-colors', routeIsActive(item) ? 'font-semibold text-primary' : 'hover:text-primary']">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" /></svg>
                        <span class="max-w-full truncate text-[9px]">{{ item.name }}</span>
                    </NuxtLink>
                </template>
            </div>
        </nav>
    </template>

    <nav v-else class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface px-2 pb-safe pt-1 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] md:hidden" aria-label="Mobile navigation">
        <div class="flex h-16 items-center justify-around">
            <NuxtLink v-for="item in menuItems" :key="item.name" :to="item.to" :class="['flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-text-muted transition-colors duration-200', routeIsActive(item) ? 'font-semibold text-primary' : 'hover:text-primary']">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" /></svg>
                <span class="max-w-full truncate text-[10px]">{{ item.name }}</span>
            </NuxtLink>
        </div>
    </nav>
</template>

<style scoped>
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.admin-mobile-sheet { bottom: calc(4.75rem + env(safe-area-inset-bottom)); }
.mobile-sheet-enter-active,
.mobile-sheet-leave-active,
.mobile-sheet-backdrop-enter-active,
.mobile-sheet-backdrop-leave-active { transition: opacity 180ms ease, transform 200ms ease; }
.mobile-sheet-enter-from,
.mobile-sheet-leave-to { opacity: 0; transform: translateY(16px) scale(0.98); }
.mobile-sheet-backdrop-enter-from,
.mobile-sheet-backdrop-leave-to { opacity: 0; }
</style>
