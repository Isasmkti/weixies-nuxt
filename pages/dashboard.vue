<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useThemeStore } from '../stores/themeStore'
import { useAuth } from '../composables/useAuth'
import { getCurrentSeller } from '../services/sellerService'
import { supabase } from '../utils/supabase'
import Swal from 'sweetalert2'

const theme = useThemeStore()
const router = useRouter()
const { profile, fetchProfile, updateProfile, uploadProfileImage, loading, signOut } = useAuth()

const isEditing = ref(false)
const selectedFile = ref(null)
const previewUrl = ref(null)
const sellerApplication = ref(null)
const loggingOut = ref(false)
const unreadMessageCount = ref(0)
let messageChannel = null

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
        await router.push('/')
    } finally {
        loggingOut.value = false
    }
}

const sellerCallToAction = computed(() => {
    const status = sellerApplication.value?.status

    if (profile.value?.is_seller === true || status === 'approved') {
        return {
            eyebrow: 'Seller account active',
            title: 'Your shop is ready to grow',
            description: 'Manage your products, store page, and marketplace activity from the seller workspace.',
            label: 'Manage Shop',
            to: '/seller',
            tone: 'active'
        }
    }
    if (status === 'pending') {
        return {
            eyebrow: 'Application submitted',
            title: 'Your shop is under review',
            description: 'An admin is reviewing your store information. Seller tools become available after approval.',
            label: 'View Application',
            to: '/seller/pending',
            tone: 'pending'
        }
    }
    if (status === 'rejected') {
        return {
            eyebrow: 'Application needs changes',
            title: 'Ready to improve your shop application?',
            description: 'Review the admin feedback, update your store information and photo, then submit it again.',
            label: 'Update Application',
            to: '/become-seller',
            tone: 'rejected'
        }
    }
    if (status === 'suspended') {
        return {
            eyebrow: 'Seller access suspended',
            title: 'Your shop needs attention',
            description: 'Seller access is temporarily unavailable. Open the status page for more information.',
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
        isEditing.value = false
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

    await fetchProfile()
    console.log('Profile after update:', profile.value)
}

onMounted(async () => {
    await fetchProfile()
    await loadUnreadMessageCount()
    subscribeToMessageNotifications()
    try {
        sellerApplication.value = await getCurrentSeller()
    } catch (error) {
        console.error('Failed to load seller application:', error)
    }
    startEditing()
})

onBeforeUnmount(() => {
    if (messageChannel) {
        supabase.removeChannel(messageChannel)
        messageChannel = null
    }
})
</script>

<template>
    
        <div class="mx-auto max-w-[1440px] space-y-6 py-4 md:py-6">
            <!-- Hero Profile Section -->
            <div
                class="rounded-ui-xl border border-border bg-surface p-6 shadow-elevation-1 md:p-8">
                <!-- Luxury Glow Decor -->
                <div class="flex flex-col items-center text-center">
                    <!-- Profile Avatar -->
                    <div class="relative mb-5">
                        <div
                            class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-ui-lg border border-border bg-bg-alt">
                            <img v-if="profile?.profile_img" :src="profile.profile_img" alt="Profile"
                                class="w-full h-full object-cover">
                            <div v-else
                                class="flex h-full w-full items-center justify-center bg-bg-alt">
                                <span class="text-2xl font-semibold text-text-muted">{{
                                    profile?.full_name?.charAt(0) || 'U' }}</span>
                            </div>
                        </div>
                        <div
                            class="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-ui-full border-2 border-surface bg-success">
                        </div>
                    </div>


                    <!-- Identity Info -->
                    <div class="max-w-2xl space-y-3">
                        <div class="space-y-1">
                            <h3 class="text-sm font-medium text-primary">Welcome back</h3>
                            <h1 class="text-3xl font-semibold leading-tight tracking-tight text-text-main">
                                {{ profile?.full_name || 'Explorer' }}
                            </h1>
                        </div>

                        <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <span
                                class="rounded-ui-xs bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                                {{ profile?.role || 'Member' }}
                            </span>
                            <span
                                class="rounded-ui-xs bg-bg-alt px-2.5 py-1 text-xs font-medium text-text-muted">
                                Verified account
                            </span>
                        </div>
                        <button
                            type="button"
                            :disabled="loggingOut"
                            class="mx-auto mt-2 inline-flex items-center gap-2 rounded-ui-sm border border-danger/25 px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:cursor-wait disabled:opacity-60 md:hidden"
                            @click="handleLogout"
                        >
                            <span v-if="loggingOut" class="h-3.5 w-3.5 animate-spin rounded-ui-full border-2 border-danger/30 border-t-danger"></span>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m17 16 4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" /></svg>
                            {{ loggingOut ? 'Signing out...' : 'Sign out' }}
                        </button>
                    </div>
                </div>
            </div>

            <section class="grid gap-4 sm:grid-cols-2" aria-label="Account activity">
                <NuxtLink to="/orders" class="group flex items-center gap-4 rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1 transition hover:border-primary/30 hover:shadow-elevation-2">
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2Z" /></svg>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-base font-semibold text-text-main">My orders</span>
                        <span class="mt-1 block text-sm text-text-muted">Payments, downloads, and purchase details</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>

                <NuxtLink to="/messages" class="group flex items-center gap-4 rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1 transition hover:border-primary/30 hover:shadow-elevation-2">
                    <span class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8.6 12h.01m3.74 0h.01m3.74 0h.01M21 12c0 4.6-4 8.3-9 8.3a9.8 9.8 0 0 1-2.6-.4A6 6 0 0 1 5.4 21a6 6 0 0 1-.5-.1 4.5 4.5 0 0 0 1-2C3.4 16.9 2.3 15 2.3 12c0-4.6 4-8.3 9-8.3s9.7 3.7 9.7 8.3Z" /></svg>
                        <span v-if="unreadMessageCount" class="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-ui-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface" :aria-label="`${unreadMessageCount} unread messages`">{{ displayedUnreadMessageCount }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="flex items-center gap-2 text-base font-semibold text-text-main">
                            Messages
                            <span v-if="unreadMessageCount" class="rounded-ui-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">{{ displayedUnreadMessageCount }} unread</span>
                        </span>
                        <span class="mt-1 block text-sm text-text-muted">{{ unreadMessageCount ? 'You have new messages to read' : 'Continue conversations with sellers' }}</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
                </NuxtLink>
            </section>

            <!-- Seller onboarding / workspace CTA -->
            <section class="rounded-ui-xl border border-primary/20 bg-surface p-6 shadow-elevation-1 md:p-8">
                <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div class="max-w-3xl">
                        <p class="text-sm font-medium" :class="sellerCallToAction.tone === 'rejected' || sellerCallToAction.tone === 'suspended' ? 'text-danger' : 'text-primary'">{{ sellerCallToAction.eyebrow }}</p>
                        <h2 class="mt-2 text-xl font-semibold tracking-tight text-text-main md:text-2xl">{{ sellerCallToAction.title }}</h2>
                        <p class="mt-2 text-sm leading-6 text-text-muted">{{ sellerCallToAction.description }}</p>
                    </div>
                    <NuxtLink :to="sellerCallToAction.to" class="inline-flex shrink-0 items-center justify-center gap-2 rounded-ui-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-elevation-1 transition hover:bg-primary-dark">
                        {{ sellerCallToAction.label }}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="m9 5 7 7-7 7" /></svg>
                    </NuxtLink>
                </div>
            </section>

            <!-- Standalone Edit Profile Section -->
            <div class="rounded-ui-lg border border-border bg-surface p-6 shadow-elevation-1 md:p-8">
                <div class="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                        <div class="space-y-2">
                            <h2 class="text-xl font-semibold text-text-main">Edit profile</h2>
                            <p class="text-sm leading-6 text-text-muted">Update your personal information and profile
                                appearance.</p>
                        </div>

                        <div class="mt-5 rounded-ui-md border border-primary/15 bg-primary/5 p-4">
                            <div class="flex gap-3 text-text-muted [&>span]:hidden">
                                <span class="text-2xl">✨</span>
                                <p class="text-sm leading-5">Your changes will be reflected globally across the
                                    platform.</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <label
                                    class="block text-left text-sm font-medium text-text-main">Full
                                    name</label>
                                <div class="relative group text-left">
                                    <input v-model="editForm.full_name" type="text" placeholder="Enter your full name"
                                        class="mt-2 w-full rounded-ui-sm border border-border bg-bg px-4 py-3 text-sm text-text-main outline-none transition placeholder:text-text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15">
                                </div>
                            </div>
                            <div class="text-left">
                                <label
                                    class="block text-sm font-medium text-text-main">Profile
                                    photo</label>
                                <div class="mt-2 flex items-center gap-4">
                                    <!-- Image Preview Thumbnail -->
                                    <div class="group/preview relative h-20 w-20 shrink-0">
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
                                            <button v-if="selectedFile && !loading"
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
                                            class="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-primary transition hover:border-primary/40">
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
                            <button @click="handleUpdate"
                                class="flex items-center gap-2 rounded-ui-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-elevation-1 transition hover:bg-primary-dark">
                                <span>Save changes</span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                                        d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                            <button @click="startEditing"
                                class="rounded-ui-sm border border-border bg-surface px-5 py-3 text-sm font-medium text-text-muted transition hover:bg-bg-alt hover:text-text-main">
                                Reset details
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Settings / Preferences Section -->
            <div class="rounded-ui-lg border border-border bg-surface p-6 shadow-elevation-1 md:p-8">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 class="text-xl font-semibold text-text-main">System preferences</h2>
                        <p class="mt-1 text-sm text-text-muted">Personalize your interface and workspace settings.
                        </p>
                    </div>

                    <!-- Theme Switch UI -->
                    <div
                        class="flex w-fit items-center rounded-ui-full border border-border bg-bg-alt p-1">
                        <button v-for="mode in ['light', 'dark', 'system']" :key="mode" @click="theme.setTheme(mode)"
                            :class="theme.mode === mode
                                ? 'bg-surface text-primary shadow-elevation-1'
                                : 'text-text-muted hover:text-text-main'"
                            class="flex items-center rounded-ui-full px-3 py-1.5 text-xs font-medium capitalize transition sm:px-4 sm:py-2 sm:text-sm [&>span]:hidden">
                            <component :is="mode === 'light' ? 'span' : 'span'">
                                {{ mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '💻' }}
                            </component>
                            {{ mode }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    
</template>
