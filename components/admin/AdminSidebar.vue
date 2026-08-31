<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'

const router = useRouter()
const { profile, fetchProfile, signOut } = useAuth()
const isCollapsed = ref(false)

onMounted(async () => {
    await fetchProfile()
})

const handleLogout = async () => {
    await signOut()
    router.push('/')
}

const menuItems = [
    {
        name: 'Dashboard',
        to: '/admin',
        icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
    },
    {
        name: 'Products',
        to: '/admin/products',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
    },
    {
        name: 'Product Review',
        to: '/admin/products/review',
        icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
    },
    {
        name: 'Sellers',
        to: '/admin/sellers',
        icon: 'M3 9.75L5.25 4.5h13.5L21 9.75M3 9.75h18M3 9.75v8.625A1.125 1.125 0 004.125 19.5h15.75A1.125 1.125 0 0021 18.375V9.75M9 19.5v-4.125A1.125 1.125 0 0110.125 14.25h3.75A1.125 1.125 0 0115 15.375V19.5'
    },
    {
        name: 'Activity Logs',
        to: '/admin/logs',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
        name: 'AI Knowledge',
        to: '/admin/ai/knowledge',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5A4.5 4.5 0 003 9.5v9A4.5 4.5 0 017.5 14c1.746 0 3.332.477 4.5 1.253m0-9C13.168 5.477 14.754 5 16.5 5A4.5 4.5 0 0121 9.5v9a4.5 4.5 0 00-4.5-4.5c-1.746 0-3.332.477-4.5 1.253'
    },
    {
        name: 'Welcome Page',
        to: '/admin/welcome',
        icon: 'M2.25 12l8.954-8.955a1.126 1.126 0 011.592 0L21.75 12M4.5 9.75v9.375c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v4.875h4.125c.621 0 1.125-.504 1.125-1.125V9.75'
    },
    {
        name: 'Payouts',
        to: '/admin/payouts',
        icon: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.111 1.453-.342 1.682-1.04l.867-2.603M2.25 18.75V5.25A2.25 2.25 0 0 1 4.5 3h9.75a2.25 2.25 0 0 1 2.25 2.25v4.5M2.25 18.75a60.055 60.055 0 0 0 8.922.826m5.328-9.826h3.75a1.5 1.5 0 0 1 1.5 1.5v3.75a1.5 1.5 0 0 1-1.5 1.5h-3.75a1.5 1.5 0 0 1-1.5-1.5v-3.75a1.5 1.5 0 0 1 1.5-1.5Z'
    },
    {
        name: 'Back to Shop',
        to: '/',
        icon: 'M10 19l-7-7m0 0l7-7m-7 7h18'
    }
]
</script>

<template>
    <aside
        :class="['bg-surface shadow-[4px_0_24px_rgba(0,0,0,0.02)] h-screen hidden md:flex md:flex-col transition-all duration-300 relative z-20  ', isCollapsed ? 'w-20' : 'w-72']">

        <!-- Header / Branding -->
        <div class="p-6 flex items-center gap-4">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center">
                <img src="../../assets/weixies-logo.svg" alt="Weixies Logo" class="w-full h-full object-contain drop-shadow-md" />
            </div>
            <transition name="fade">
                <span v-if="!isCollapsed"
                    class="font-poppins font-bold text-2xl text-text-main tracking-tight">Admin</span>
            </transition>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 space-y-2 overflow-y-auto container no-scrollbar">
            <NuxtLink v-for="(item, index) in menuItems" :key="index" :to="item.to"
                :class="['flex items-center gap-3 px-4 py-3 rounded-xl text-text-muted hover:bg-bg hover:text-primary transition-all duration-200 group', isCollapsed ? 'justify-center' : '']"
                active-class="bg-primary/10 text-primary font-medium shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
                </svg>
                <transition name="fade">
                    <span v-if="!isCollapsed">{{ item.name }}</span>
                </transition>
            </NuxtLink>
        </nav>

        <!-- Footer / Logout -->
        <div class="p-4  flex flex-col gap-2 relative">
            <!-- User Profile Section -->
            <div v-if="profile"
                :class="['p-3 rounded-xl flex items-center gap-3 transition-all duration-300', isCollapsed ? 'justify-center p-2' : 'bg-bg border border-bg-alt/50']">
                <!-- Profile Image -->
                <div class="relative shrink-0">
                    <div
                        class="w-10 h-10 rounded-full bg-bg-alt flex items-center justify-center overflow-hidden">
                        <img v-if="profile.profile_img" :src="profile.profile_img" alt="Profile"
                            class="w-full h-full object-cover">
                        <span v-else class="text-text-muted font-bold text-sm">{{
                            profile.full_name?.charAt(0).toUpperCase() || 'A' }}</span>
                    </div>
                    <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ">
                    </div>
                </div>

                <!-- Text Info -->
                <transition name="fade">
                    <div v-if="!isCollapsed" class="overflow-hidden min-w-0 flex-1">
                        <h3 class="text-sm font-semibold text-text-main truncate">{{ profile.full_name || 'Admin' }}
                        </h3>
                        <p class="text-xs text-text-muted truncate">{{ profile.role || 'Administrator' }}</p>
                    </div>
                </transition>
            </div>

            <!-- Sign Out -->
            <button @click="handleLogout"
                :class="['flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-all duration-200 group', isCollapsed ? 'justify-center' : 'w-full']">
                <svg xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 shrink-0 group-hover:scale-110 transition-transform duration-200" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <transition name="fade">
                    <span v-if="!isCollapsed" class="font-medium">Sign Out</span>
                </transition>
            </button>

            <!-- Collapse Toggle -->
            <button @click="isCollapsed = !isCollapsed"
                class="absolute -right-3 top-0 transform -translate-y-1/2 bg-surface shadow-md rounded-full p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer z-50">
                <svg v-if="!isCollapsed" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    </aside>
</template>

<style scoped>
/* Smooth transition for text appearing/disappearing */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.no-scrollbar {
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* IE & Edge lama */
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari */
}

/* Ensure whitespace doesn't wrap awkwardly during transition */
span,
h3,
p {
    white-space: nowrap;
}
</style>
