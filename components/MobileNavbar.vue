<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { profile } = useAuth()

const userMenuItems = [
    {
        name: 'Dashboard',
        to: '/dashboard',
        icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
    },
    {
        name: 'Shop',
        to: '/seller',
        sellerOnly: true,
        icon: 'M3 9.75L5.25 4.5h13.5L21 9.75M3 9.75h18M3 9.75v8.625A1.125 1.125 0 004.125 19.5h15.75A1.125 1.125 0 0021 18.375V9.75M9 19.5v-4.125A1.125 1.125 0 0110.125 14.25h3.75A1.125 1.125 0 0115 15.375V19.5'
    },
    {
        name: 'Catalog',
        to: '/products',
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    },
    {
        name: 'Cart',
        to: '/cart',
        icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'
    },
    {
        name: 'Home',
        to: '/',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    }
]

const adminMenuItems = [
    {
        name: 'Dashboard',
        to: '/admin',
        icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
    },
    {
        name: 'Carousel',
        to: '/admin/home-carousel',
        icon: 'M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9zM7 14l2.5-2.5 2 2L15 10l3 4'
    },
    {
        name: 'Banner',
        to: '/admin/signup-banner',
        icon: 'M3 5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25v13.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V5.25zM3 15l4.5-4.5 3.75 3.75L15 10.5l6 6'
    },
    {
        name: 'Products',
        to: '/admin/products',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
    },
    {
        name: 'Knowledge',
        to: '/admin/ai/knowledge',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5A4.5 4.5 0 003 9.5v9A4.5 4.5 0 017.5 14c1.746 0 3.332.477 4.5 1.253m0-9C13.168 5.477 14.754 5 16.5 5A4.5 4.5 0 0121 9.5v9a4.5 4.5 0 00-4.5-4.5c-1.746 0-3.332.477-4.5 1.253'
    },
    {
        name: 'Sellers',
        to: '/admin/sellers',
        icon: 'M3 9.75L5.25 4.5h13.5L21 9.75M3 9.75h18M3 9.75v8.625A1.125 1.125 0 004.125 19.5h15.75A1.125 1.125 0 0021 18.375V9.75M9 19.5v-4.125A1.125 1.125 0 0110.125 14.25h3.75A1.125 1.125 0 0115 15.375V19.5'
    },
    {
        name: 'Logs',
        to: '/admin/logs',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
        name: 'Shop',
        to: '/',
        icon: 'M10 19l-7-7m0 0l7-7m-7 7h18'
    }
]

const menuItems = computed(() => {
    if (profile.value?.role === 'admin') {
        return adminMenuItems
    }
    return userMenuItems.filter((item) => !item.sellerOnly || profile.value?.is_seller === true)
})
</script>

<template>
    <nav class="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-bg-alt/50 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] z-50 rounded-t-2xl px-2 pb-safe pt-1">
        <div class="flex items-center justify-around h-16">
            <NuxtLink v-for="item in menuItems" :key="item.name" :to="item.to"
                class="flex flex-col items-center justify-center w-full h-full gap-1 text-text-muted hover:text-primary transition-colors duration-200"
                active-class="text-primary font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
                </svg>
                <span class="text-[10px]">{{ item.name }}</span>
            </NuxtLink>
        </div>
    </nav>
</template>

<style scoped>
/* Safe area padding for iPhones with notch */
.pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
}
</style>
