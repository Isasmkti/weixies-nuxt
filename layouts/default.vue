<script setup>
import Sidebar from '../components/Sidebar.vue'
import AdminSidebar from '../components/admin/AdminSidebar.vue'
import { useAuth } from '../composables/useAuth'

const { profile } = useAuth()
</script>

<template>
    <div class="flex h-screen overflow-hidden bg-bg font-sans text-text-main">
        <!-- Sidebar (Hidden on Mobile) -->
        <component :is="profile?.role === 'admin' ? AdminSidebar : Sidebar" />

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
    </div>
</template>
