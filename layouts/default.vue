<script setup>
import Sidebar from '../components/Sidebar.vue'
import AdminSidebar from '../components/admin/AdminSidebar.vue'
import { useAuth } from '../composables/useAuth'
import { onMounted, ref } from 'vue'

const { profile, fetchProfile } = useAuth()
const profileReady = ref(Boolean(profile.value))
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
    <div class="flex h-screen overflow-hidden bg-bg font-sans text-text-main">
        <!-- Sidebar (Hidden on Mobile) -->
        <aside v-if="!profileReady" aria-label="Loading navigation" class="hidden h-screen w-72 shrink-0 space-y-6 border-r border-border bg-surface p-6 md:block">
            <div v-for="i in 6" :key="i" class="h-10 rounded-ui-md bg-bg-alt animate-pulse motion-reduce:animate-none"></div>
        </aside>
        <component v-else :is="profile?.role === 'admin' ? AdminSidebar : Sidebar" />

        <!-- Main Area -->
        <div class="flex flex-col flex-1 min-h-screen">
            <main class="flex-1 overflow-y-auto bg-bg relative pb-16 md:pb-0">
                <div class="p-4 md:p-8">
                    <slot />
                </div>
            </main>
        </div>

        <!-- Mobile Bottom Navbar -->
        <MobileNavbar v-if="profile" />
        <div v-else-if="!profileReady" aria-label="Loading navigation" class="fixed inset-x-0 bottom-0 h-16 border-t border-border bg-surface md:hidden"></div>
    </div>
</template>
