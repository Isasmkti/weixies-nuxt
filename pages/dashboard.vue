<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useThemeStore } from '../stores/themeStore'
import { useAuth } from '../composables/useAuth'
import { getCurrentSeller } from '../services/sellerService'
import { supabase } from '../utils/supabase'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const theme = useThemeStore()
const router = useRouter()
const { user, profile, fetchProfile, updateProfile, uploadProfileImage, loading, signOut } = useAuth()

const selectedFile = ref(null)
const previewUrl = ref(null)
const profileSettings = ref(null)
const sellerApplication = ref(null)
const loggingOut = ref(false)
const pageLoading = ref(true)
const pageError = ref('')
const unreadMessageCount = ref(0)
const purchaseCount = ref(null)
const visiblePurchaseCount = computed(() => purchaseCount.value?.profileId === profile.value?.id ? purchaseCount.value.count : null)
const accountEmail = computed(() => user.value?.email || profile.value?.email || '')
const isVerified = computed(() => Boolean(user.value?.email_confirmed_at || user.value?.confirmed_at))
let messageChannel = null

const loadPurchaseCount = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const data = await $fetch('/api/purchases/count', { headers: { Authorization: `Bearer ${session.access_token}` } })
        purchaseCount.value = { profileId: session.user.id, count: data.count }
    } catch { purchaseCount.value = null }
}

const displayedUnreadMessageCount = computed(() => (
    unreadMessageCount.value > 99 ? '99+' : String(unreadMessageCount.value)
))

const loadUnreadMessageCount = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
            unreadMessageCount.value = 0
            return
        }
        const data = await $fetch('/api/direct-messages/unread-count', {
            headers: { Authorization: `Bearer ${session.access_token}` }
        })
        unreadMessageCount.value = Math.max(0, Number(data?.unread_count) || 0)
    } catch (error) {
        console.error('Failed to load unread message count:', error)
    }
}

const subscribeToMessageNotifications = () => {
    if (messageChannel) return
    messageChannel = supabase
        .channel('dashboard-message-notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'buyer_seller_messages'
        }, loadUnreadMessageCount)
        .subscribe()
}

const handleLogout = async () => {
    if (loggingOut.value) return
    loggingOut.value = true
    try {
        await signOut()
    } finally {
        loggingOut.value = false
        await router.replace('/welcome')
    }
}

const sellerCallToAction = computed(() => {
    const status = sellerApplication.value?.status

    if (profile.value?.is_seller === true || status === 'approved') {
        return {
            eyebrow: 'Seller account active',
            title: 'Seller Center',
            description: 'Manage products, orders, and marketplace activity.',
            label: 'Manage Shop',
            to: '/seller',
            tone: 'active'
        }
    }
    if (status === 'pending') {
        return {
            eyebrow: 'Application submitted',
            title: 'Seller review in progress',
            description: 'Your store information is being reviewed.',
            label: 'View Application',
            to: '/seller/pending',
            tone: 'pending'
        }
    }
    if (status === 'rejected') {
        return {
            eyebrow: 'Application needs changes',
            title: 'Update your seller application',
            description: 'Review the feedback, update your information, and resubmit.',
            label: 'Update Application',
            to: '/become-seller',
            tone: 'rejected'
        }
    }
    if (status === 'suspended') {
        return {
            eyebrow: 'Seller access suspended',
            title: 'Seller Center needs attention',
            description: 'Open the status page for more information.',
            label: 'View Status',
            to: '/seller/pending',
            tone: 'suspended'
        }
    }

    return {
        eyebrow: 'Start selling on Weixies',
        title: 'Do you want to become a seller?',
        description: 'Open your own shop, publish digital products, and reach buyers across the marketplace.',
        label: 'Become a Seller',
        to: '/become-seller',
        tone: 'new'
    }
})

const editForm = ref({
    full_name: '',
    profile_img: '',
    role: ''
})

const startEditing = () => {
    editForm.value = {
        full_name: profile.value?.full_name || '',
        profile_img: profile.value?.profile_img || '',
        role: profile.value?.role || ''
    }
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
    }
    selectedFile.value = null
    previewUrl.value = null
}

const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    selectedFile.value = file
    previewUrl.value = URL.createObjectURL(file)
}

const handleUpdate = async () => {
    try {
        let finalImageUrl = editForm.value.profile_img

        // Only upload if a new file was selected
        if (selectedFile.value) {
            finalImageUrl = await uploadProfileImage(selectedFile.value)
        }

        await updateProfile({
            full_name: editForm.value.full_name,
            profile_img: finalImageUrl
        })

        // Clear local states and cleanup preview resource
        if (previewUrl.value) {
            URL.revokeObjectURL(previewUrl.value)
        }

        editForm.value.profile_img = finalImageUrl
        selectedFile.value = null
        previewUrl.value = null

        Swal.fire({
            title: 'Success!',
            text: 'Profile updated successfully!',
            icon: 'success',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))',
            customClass: {
                popup: 'rounded-ui-xl shadow-elevation-3'
            }
        })
    } catch (error) {
        console.error('Failed to update profile:', error)
        Swal.fire({
            title: 'Error!',
            text: 'Failed to update profile.',
            icon: 'error',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))',
            customClass: {
                popup: 'rounded-ui-xl shadow-elevation-3'
            }
        })
    }

}

const initializeDashboard = async () => {
    pageLoading.value = true
    pageError.value = ''
    try {
        const results = await Promise.allSettled([
            fetchProfile(),
            loadUnreadMessageCount(),
            getCurrentSeller(),
            loadPurchaseCount(),
        ])
        const failed = results.find(result => result.status === 'rejected')
        if (failed) throw failed.reason
        sellerApplication.value = results[2].value
        startEditing()
    } catch (error) {
        pageError.value = 'Unable to load your account. Please try again.'
        console.error('Failed to load dashboard:', error)
    } finally {
        pageLoading.value = false
    }
}

onMounted(() => {
    subscribeToMessageNotifications()
    initializeDashboard()
})

const showSellerCenter = computed(() => profile.value?.is_seller === true || Boolean(sellerApplication.value))
const scrollToProfileSettings = () => {
    profileSettings.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onBeforeUnmount(() => {
    if (messageChannel) {
        supabase.removeChannel(messageChannel)
        messageChannel = null
    }
})
</script>

<template>
    
        <div class="mx-auto max-w-7xl space-y-7 pb-20 pt-2 font-poppins sm:pt-4 md:pt-6">
            <div v-if="pageLoading" role="status" aria-label="Loading dashboard" class="space-y-6 animate-pulse motion-reduce:animate-none">
                <div class="flex h-32 items-center gap-4 rounded-ui-lg bg-surface p-5">
                    <div class="h-16 w-16 rounded-ui-md bg-bg-alt"></div>
                    <div class="h-6 w-48 rounded bg-bg-alt"></div>
                    <div class="h-4 w-32 rounded bg-bg-alt"></div>
                </div>
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><div v-for="i in 5" :key="i" class="h-24 rounded-ui-lg bg-bg-alt"></div></div>
                <div class="h-28 rounded-ui-lg bg-bg-alt"></div>
                <div class="h-72 rounded-ui-lg bg-bg-alt"></div>
            </div>
            <div v-else-if="pageError" role="alert" class="rounded-ui-lg border border-border bg-surface p-6 text-text-main">
                <p>{{ pageError }}</p>
                <button class="mt-4 text-primary underline" @click="initializeDashboard">Try again</button>
            </div>
            <template v-else>
            <!-- Compact account header -->
            <section class="rounded-ui-lg bg-surface p-4 shadow-elevation-1 sm:p-5">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div class="relative w-fit shrink-0">
                        <div class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-ui-md bg-bg-alt sm:h-[4.5rem] sm:w-[4.5rem]">
                            <img v-if="profile?.profile_img" :src="profile.profile_img" alt="Profile"
                                class="w-full h-full object-cover">
                            <div v-else
                                class="flex h-full w-full items-center justify-center bg-bg-alt">
                                <span class="text-xl font-semibold text-text-muted">{{
                                    profile?.full_name?.charAt(0) || 'U' }}</span>
                            </div>
                        </div>
                        <div
                            class="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-ui-full border-2 border-surface bg-success">
                        </div>
                    </div>
                    <div class="min-w-0 flex-1 text-left">
                        <div>
                            <h1 class="truncate text-xl font-semibold tracking-tight text-text-main sm:text-2xl">
                                {{ profile?.full_name || 'Explorer' }}
                            </h1>
                            <p v-if="accountEmail" class="mt-1 truncate text-sm text-text-muted">{{ accountEmail }}</p>
                        </div>

                    </div>

                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <NuxtLink v-if="!showSellerCenter" to="/become-seller" class="inline-flex min-h-10 items-center rounded-ui-sm px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-bg-alt hover:text-primary">Become a seller</NuxtLink>
                        <button type="button" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-ui-sm bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark" @click="scrollToProfileSettings">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16.86 4.49 19.5 7.13M18 2.75a1.87 1.87 0 0 1 2.65 2.65L8 18.05 3.75 19.5l1.45-4.25L18 2.75Z" /></svg>
                            Edit profile
                        </button>
                        <button
                            type="button"
                            :disabled="loggingOut"
                            class="inline-flex min-h-10 items-center gap-2 rounded-ui-sm border border-danger/25 px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:cursor-wait disabled:opacity-60 md:hidden"
                            @click="handleLogout"
                        >
                            <span v-if="loggingOut" class="h-3.5 w-3.5 animate-spin rounded-ui-full border-2 border-danger/30 border-t-danger"></span>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m17 16 4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" /></svg>
                            {{ loggingOut ? 'Signing out...' : 'Sign out' }}
                        </button>
                    </div>
                </div>
            </section>

            <section aria-labelledby="quick-actions-title">
              <div class="mb-3 flex items-end justify-between"><div><p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Account</p><h2 id="quick-actions-title" class="mt-1 text-xl font-semibold text-text-main">Quick Actions</h2></div></div>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <NuxtLink to="/purchases" class="group flex min-h-24 items-center gap-3 rounded-ui-md border border-transparent bg-surface p-4 shadow-elevation-1 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 7h16v13H4V7Zm-1-4h18v4H3V3Zm6 8h6" /></svg>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-main">Purchases <span v-if="visiblePurchaseCount !== null" class="rounded-ui-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{{ visiblePurchaseCount }}</span></span>
                        <span class="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">Your purchased products</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>

                <NuxtLink to="/wishlist" class="group flex min-h-24 items-center gap-3 rounded-ui-md border border-transparent bg-surface p-4 shadow-elevation-1 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold text-text-main">Wishlist</span>
                        <span class="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">Products saved for later</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>

                <NuxtLink to="/orders" class="group flex min-h-24 items-center gap-3 rounded-ui-md border border-transparent bg-surface p-4 shadow-elevation-1 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" /></svg>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold text-text-main">Orders</span>
                        <span class="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">Payments and order history</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>

                <NuxtLink to="/messages" class="group flex min-h-24 items-center gap-3 rounded-ui-md border border-transparent bg-surface p-4 shadow-elevation-1 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5">
                    <span class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8.6 12h.01m3.74 0h.01m3.74 0h.01M21 12c0 4.6-4 8.3-9 8.3a9.8 9.8 0 0 1-2.6-.4A6 6 0 0 1 5.4 21a6 6 0 0 1-.5-.1 4.5 4.5 0 0 0 1-2C3.4 16.9 2.3 15 2.3 12c0-4.6 4-8.3 9-8.3s9.7 3.7 9.7 8.3Z" /></svg>
                        <span v-if="unreadMessageCount" class="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-ui-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface" :aria-label="`${unreadMessageCount} unread messages`">{{ displayedUnreadMessageCount }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-main">
                            Messages
                            <span v-if="unreadMessageCount" class="rounded-ui-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">{{ displayedUnreadMessageCount }} unread</span>
                        </span>
                        <span class="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">{{ unreadMessageCount ? 'New conversations waiting' : 'Seller conversations' }}</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>

                <NuxtLink to="/refunds" class="group flex min-h-24 items-center gap-3 rounded-ui-md border border-transparent bg-surface p-4 shadow-elevation-1 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 10h14a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H8m-5-8 4-4m-4 4 4 4" /></svg>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold text-text-main">Refunds</span>
                        <span class="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">Refund status and progress</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>
              </div>
            </section>

            <!-- Seller Center only appears for sellers or existing applications. -->
            <section v-if="showSellerCenter" class="overflow-hidden rounded-ui-lg bg-primary/5 shadow-elevation-1 ring-1 ring-inset ring-primary/15">
                <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div class="max-w-3xl">
                        <p class="flex items-center gap-2 text-xs font-semibold" :class="sellerCallToAction.tone === 'rejected' || sellerCallToAction.tone === 'suspended' ? 'text-danger' : 'text-primary'"><span class="h-2 w-2 rounded-ui-full bg-current"></span>{{ sellerCallToAction.eyebrow }}</p>
                        <h2 class="mt-1.5 text-lg font-semibold tracking-tight text-text-main">{{ sellerCallToAction.title }}</h2>
                        <p class="mt-1 text-sm leading-6 text-text-muted">{{ sellerCallToAction.description }}</p>
                    </div>
                    <NuxtLink :to="sellerCallToAction.to" class="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-ui-sm bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark">
                        {{ sellerCallToAction.label }}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m9 5 7 7-7 7" /></svg>
                    </NuxtLink>
                </div>
            </section>

            <section ref="profileSettings" class="scroll-mt-6" aria-labelledby="account-settings-title">
              <div class="mb-3">
                <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Preferences</p>
                <h2 id="account-settings-title" class="mt-1 text-xl font-semibold text-text-main">Account Settings</h2>
              </div>

            <!-- Profile settings -->
            <div class="rounded-ui-lg bg-surface p-5 shadow-elevation-1 sm:p-6">
                <div class="space-y-6">
                    <div>
                        <div class="space-y-2">
                            <h3 class="text-lg font-semibold text-text-main">Profile</h3>
                            <p class="text-sm leading-6 text-text-muted">Manage your personal information and profile appearance.</p>
                        </div>

                    </div>

                    <div>
                        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div>
                                <label
                                    class="block text-left text-sm font-medium text-text-main">Full
                                    name</label>
                                <div class="relative group text-left">
                                    <input v-model="editForm.full_name" type="text" required maxlength="120" placeholder="Enter your full name"
                                        class="mt-2 w-full rounded-ui-sm border border-border bg-bg px-4 py-3 text-sm text-text-main outline-none transition placeholder:text-text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15">
                                </div>
                            </div>
                            <div class="text-left">
                                <label
                                    class="block text-sm font-medium text-text-main">Profile
                                    photo</label>
                                <div class="mt-2 flex items-center gap-4">
                                    <!-- Image Preview Thumbnail -->
                                    <div class="group/preview relative h-16 w-16 shrink-0">
                                        <div
                                            class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-ui-lg border border-border bg-bg-alt">
                                            <!-- Priority: 1. New Local Preview, 2. Existing DB Image, 3. Placeholder -->
                                            <img v-if="previewUrl || editForm.profile_img"
                                                :src="previewUrl || editForm.profile_img" alt="Preview"
                                                class="h-full w-full object-cover">
                                            <div v-else class="text-text-muted/20">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none"
                                                    viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="1.5"
                                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>

                                            <!-- Loading Overlay -->
                                            <div v-if="loading"
                                                class="absolute inset-0 bg-surface/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                                                <div
                                                    class="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin">
                                                </div>
                                            </div>

                                            <!-- Reset/Clear selected file -->
                                            <button v-if="selectedFile && !loading" type="button"
                                                @click="selectedFile = null; previewUrl = null"
                                                class="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-danger/80 text-white opacity-0 transition-opacity group-hover/preview:opacity-100"
                                                title="Remove pending upload">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none"
                                                    viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2.5"
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Upload Trigger -->
                                    <div class="relative flex-1">
                                        <input type="file" @change="handleImageUpload" class="hidden"
                                            id="profile-upload" accept="image/*">
                                        <label for="profile-upload"
                                            class="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-ui-sm border border-border bg-bg px-4 py-2.5 text-primary transition hover:border-primary/40">
                                            <template v-if="loading">
                                                <div
                                                    class="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin">
                                                </div>
                                                <span class="text-sm font-medium">Processing...</span>
                                            </template>
                                            <template v-else>
                                                <div
                                                    class="flex h-8 w-8 items-center justify-center rounded-ui-sm bg-primary/10">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none"
                                                        viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2.5"
                                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                </div>
                                                <div class="flex flex-col text-left">
                                                    <span
                                                        class="text-sm font-medium leading-none">{{
                                                            selectedFile ? 'Change photo' : 'Choose photo' }}</span>
                                                    <span
                                                        class="mt-1 max-w-40 truncate text-xs text-text-muted">{{
                                                            selectedFile ? selectedFile.name : 'PNG, JPG or GIF' }}</span>
                                                </div>
                                            </template>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-7 flex flex-wrap items-center gap-3">
                            <button type="button" :disabled="loading" @click="handleUpdate"
                                class="flex min-h-10 items-center gap-2 rounded-ui-sm bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60">
                                <span>Save changes</span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                                        d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                            <button type="button" :disabled="loading" @click="startEditing"
                                class="min-h-10 rounded-ui-sm px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-bg-alt hover:text-text-main disabled:opacity-60">
                                Reset details
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Appearance remains part of Account Settings without another large card. -->
            <div class="border-t border-border px-1 py-5 sm:px-2">
                <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h3 class="text-base font-semibold text-text-main">Appearance</h3>
                        <p class="mt-1 text-sm text-text-muted">Choose how Weixies looks on this device.</p>
                    </div>

                    <!-- Theme Switch UI -->
                    <div
                        class="flex w-fit items-center rounded-ui-full border border-border bg-bg-alt p-1">
                        <button v-for="mode in ['light', 'dark', 'system']" :key="mode" type="button" @click="theme.setTheme(mode)"
                            :class="theme.mode === mode
                                ? 'bg-surface text-primary shadow-elevation-1'
                                : 'text-text-muted hover:text-text-main'"
                            class="flex items-center gap-1.5 rounded-ui-full px-3 py-1.5 text-xs font-medium capitalize transition sm:px-4 sm:py-2 sm:text-sm">
                            <svg v-if="mode === 'light'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="1.8" d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21m-2.64-6.36-1.06 1.06M6.7 17.3l-1.06 1.06m0-12.72L6.7 6.7m10.6 10.6 1.06 1.06M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
                            <svg v-else-if="mode === 'dark'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="1.8" d="M20.25 15.75A9 9 0 0 1 8.25 3.75a9 9 0 1 0 12 12Z" /></svg>
                            <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="1.8" d="M3 4.5h18v12H3v-12Zm5.25 16.5h7.5M12 16.5V21" /></svg>
                            {{ mode }}
                        </button>
                    </div>
                </div>
            </div>
            </section>
            </template>
        </div>
    
</template>
