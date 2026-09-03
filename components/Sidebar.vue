<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

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

const baseMenuItems = [
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

const menuItems = computed(() => baseMenuItems.filter((item) => (
    !item.sellerOnly || profile.value?.is_seller === true
)))
</script>

<template>
    <aside
        :class="['relative z-20 hidden h-screen border-r border-border bg-surface transition-all duration-300 md:flex md:flex-col', isCollapsed ? 'w-20' : 'w-72']">

        <!-- Header / Branding -->
        <div class="p-6 flex items-center gap-4">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center">
                <img src="../assets/weixies-logo.svg" alt="Weixies Logo" class="h-full w-full object-contain" />
            </div>
            <transition name="fade">
                <span v-if="!isCollapsed"
                    class="font-poppins font-bold text-2xl text-text-main tracking-tight">Weixies</span>
            </transition>
        </div>



        <!-- Navigation -->
        <nav class="flex-1 px-4 space-y-2 overflow-y-auto container no-scrollbar">
            <NuxtLink v-for="(item, index) in menuItems" :key="index" :to="item.to"
                :class="['group flex items-center gap-3 rounded-ui-md px-4 py-3 text-text-muted transition-colors duration-200 hover:bg-bg hover:text-primary', isCollapsed ? 'justify-center' : '']"
                active-class="bg-primary/10 text-primary font-medium">
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
        <div class="p-4 border-t border-bg-alt/50 flex flex-col gap-2 relative">
            <!-- User Profile Section -->
            <div v-if="profile"
                :class="['flex items-center gap-3 rounded-ui-md p-3 transition-all duration-300', isCollapsed ? 'justify-center p-2' : 'border border-border bg-bg']">
                <!-- Profile Image -->
                <div class="relative shrink-0">
                    <div
                        class="w-10 h-10 rounded-full bg-bg-alt border-2 border-surface flex items-center justify-center overflow-hidden">
                        <img v-if="profile.profile_img" :src="profile.profile_img" alt="Profile"
                            class="w-full h-full object-cover">
                        <span v-else class="text-text-muted font-bold text-sm">{{
                            profile.full_name?.charAt(0).toUpperCase() || 'U' }}</span>
                    </div>
                    <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface">
                    </div>
                </div>

                <!-- Text Info -->
                <transition name="fade">
                    <div v-if="!isCollapsed" class="overflow-hidden min-w-0 flex-1">
                        <h3 class="text-sm font-semibold text-text-main truncate">{{ profile.full_name || 'User' }}</h3>
                        <p class="text-xs text-text-muted truncate">{{ profile.role || 'Member' }}</p>
                    </div>
                </transition>
            </div>

            <!-- Sign Out -->
            <button @click="handleLogout"
                :class="['group flex items-center gap-3 rounded-ui-sm px-3 py-2 text-danger transition-colors duration-200 hover:bg-danger/10', isCollapsed ? 'justify-center' : 'w-full']">
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
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE & Edge lama */
}

.no-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}

/* Ensure whitespace doesn't wrap awkwardly during transition */
span,
h3,
p {
    white-space: nowrap;
}
</style>
