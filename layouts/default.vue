<script setup>
import Sidebar from '../components/Sidebar.vue'
import AdminSidebar from '../components/admin/AdminSidebar.vue'
import { useAuth } from '../composables/useAuth'
import { computed, onMounted, ref } from 'vue'

const { profile, fetchProfile } = useAuth()
const route = useRoute()
const profileReady = ref(Boolean(profile.value))
const isConversationPage = computed(() => /^\/messages\/[^/]+\/?$/.test(route.path))
onMounted(async () => {
    try {
        await fetchProfile()
    } catch (error) {
        console.error('Unable to load navigation profile:', error)
    } finally {
        profileReady.value = true
    }
})
</script>

<template>
    <div class="flex h-[100dvh] overflow-hidden bg-bg font-sans text-text-main">
        <!-- Sidebar (Hidden on Mobile) -->
        <aside v-if="!profileReady" aria-label="Loading navigation" class="hidden h-screen w-72 shrink-0 space-y-6 border-r border-border bg-surface p-6 md:block">
            <div v-for="i in 6" :key="i" class="h-10 rounded-ui-md bg-bg-alt animate-pulse motion-reduce:animate-none"></div>
        </aside>
        <component v-else :is="profile?.role === 'admin' ? AdminSidebar : Sidebar" />

        <!-- Main Area -->
        <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <main class="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-bg">
                <div :class="[
                    'min-w-0',
                    isConversationPage
                        ? 'h-full min-h-0 p-0 md:p-8'
                        : 'p-3 pb-24 sm:p-4 sm:pb-24 md:p-8 md:pb-8'
                ]">
                    <slot />
                </div>
            </main>
        </div>

        <!-- Mobile Bottom Navbar -->
        <MobileNavbar v-if="profile && !isConversationPage" />
        <div v-else-if="!profileReady && !isConversationPage" aria-label="Loading navigation" class="fixed inset-x-0 bottom-0 h-16 border-t border-border bg-surface md:hidden"></div>
    </div>
</template>
