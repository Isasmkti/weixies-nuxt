<script setup>
import { onMounted, ref } from 'vue'

import { useThemeStore } from '../stores/themeStore'
import { useAuth } from '../composables/useAuth'
import Swal from 'sweetalert2'

const theme = useThemeStore()
const { profile, fetchProfile, updateProfile, uploadProfileImage, loading } = useAuth()

const isEditing = ref(false)
const selectedFile = ref(null)
const previewUrl = ref(null)

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
                popup: 'rounded-2xl shadow-xl'
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
                popup: 'rounded-2xl shadow-xl'
            }
        })
    }

    await fetchProfile()
    console.log('Profile after update:', profile.value)
}

onMounted(async () => {
    await fetchProfile()
    startEditing()
})
</script>

<template>
    
        <div class="max-w-[1600px] mx-auto font-poppins space-y-10 py-6">
            <!-- Hero Profile Section -->
            <div
                class="relative overflow-hidden bg-surface rounded-[2.5rem] p-12 shadow-2xl shadow-black/[0.03] border border-bg-alt/50 group">
                <!-- Luxury Glow Decor -->
                <div
                    class="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/20 transition-all duration-700">
                </div>
                <div
                    class="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/20 transition-all duration-700">
                </div>

                <div class="relative flex flex-col items-center text-center">
                    <!-- Profile Avatar -->
                    <div class="relative mb-8 pt-4">
                        <div
                            class="w-32 h-32 rounded-3xl bg-surface border-4 border-bg-alt shadow-2xl flex items-center justify-center overflow-hidden rotate-3 hover:rotate-0 transition-transform duration-500">
                            <img v-if="profile?.profile_img" :src="profile.profile_img" alt="Profile"
                                class="w-full h-full object-cover">
                            <div v-else
                                class="w-full h-full bg-gradient-to-br from-bg-alt to-surface flex items-center justify-center">
                                <span class="text-text-muted font-black text-4xl uppercase">{{
                                    profile?.full_name?.charAt(0) || 'U' }}</span>
                            </div>
                        </div>
                        <div
                            class="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-2xl border-4 border-surface shadow-xl flex items-center justify-center">
                            <div class="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                        </div>
                    </div>


                    <!-- Identity Info -->
                    <div class="space-y-4 max-w-2xl">
                        <div class="space-y-1">
                            <h3 class="text-primary font-bold tracking-[0.2em] uppercase text-sm">Welcome back</h3>
                            <h1 class="text-5xl font-black text-text-main tracking-tight leading-tight">
                                {{ profile?.full_name || 'Explorer' }}
                            </h1>
                        </div>

                        <div class="flex flex-wrap items-center justify-center gap-4 pt-2">
                            <span
                                class="px-5 py-2 rounded-2xl bg-primary/5 text-primary text-sm font-bold border border-primary/10 backdrop-blur-sm">
                                {{ profile?.role || 'Member' }}
                            </span>
                            <span
                                class="px-5 py-2 rounded-2xl bg-bg-alt/50 text-text-muted text-sm font-medium border border-bg-alt/30">
                                Verified Account
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Standalone Edit Profile Section -->
            <div class="bg-surface rounded-[2.5rem] p-10 shadow-xl shadow-black/[0.02] border border-bg-alt/50">
                <div class="flex flex-col lg:flex-row gap-12">
                    <div class="lg:w-1/3">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-black text-text-main tracking-tight">Edit Profile</h2>
                            <p class="text-text-muted font-medium">Update your personal information and profile
                                appearance.</p>
                        </div>

                        <div class="mt-8 p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                            <div class="flex items-center gap-4 text-primary">
                                <span class="text-2xl">✨</span>
                                <p class="text-sm font-bold">Your changes will be reflected globally across the
                                    platform.</p>
                            </div>
                        </div>
                    </div>

                    <div class="lg:w-2/3">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div class="space-y-4">
                                <label
                                    class="text-xs font-black uppercase tracking-[0.2em] text-primary/60 ml-2 text-left block">Full
                                    Name</label>
                                <div class="relative group text-left">
                                    <input v-model="editForm.full_name" type="text" placeholder="Enter your full name"
                                        class="w-full px-8 py-5 rounded-2xl bg-bg-alt/20 border-2 border-bg-alt/50 text-text-main focus:border-primary/50 focus:ring-8 focus:ring-primary/5 focus:bg-surface outline-none transition-all duration-300 font-bold placeholder:text-text-muted/50">
                                </div>
                            </div>
                            <div class="space-y-4 text-left">
                                <label
                                    class="text-xs font-black uppercase tracking-[0.2em] text-primary/60 ml-2 block">Profile
                                    Photo</label>
                                <div class="flex items-center gap-6">
                                    <!-- Image Preview Thumbnail -->
                                    <div class="relative group/preview w-24 h-24 shrink-0 transition-all duration-500">
                                        <div
                                            class="w-full h-full rounded-2xl bg-bg-alt/20 border-2 border-bg-alt/50 overflow-hidden flex items-center justify-center shadow-inner relative">
                                            <!-- Priority: 1. New Local Preview, 2. Existing DB Image, 3. Placeholder -->
                                            <img v-if="previewUrl || editForm.profile_img"
                                                :src="previewUrl || editForm.profile_img" alt="Preview"
                                                class="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-110">
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
                                                class="absolute inset-0 bg-red-500/80 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white backdrop-blur-sm cursor-pointer z-20"
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
                                            class="cursor-pointer w-full px-8 py-5 bg-primary/5 border-2 border-dashed border-primary/20 text-primary rounded-2xl font-bold hover:bg-primary/10 hover:border-primary/40 transition-all flex items-center justify-center gap-4 group">
                                            <template v-if="loading">
                                                <div
                                                    class="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin">
                                                </div>
                                                <span class="text-sm uppercase tracking-widest">Processing...</span>
                                            </template>
                                            <template v-else>
                                                <div
                                                    class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none"
                                                        viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2.5"
                                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                </div>
                                                <div class="flex flex-col text-left">
                                                    <span
                                                        class="text-sm font-black uppercase tracking-widest leading-none">{{
                                                            selectedFile ? 'Change Selection' : 'Choose Photo' }}</span>
                                                    <span
                                                        class="text-[9px] text-text-muted/60 font-bold uppercase tracking-tight mt-1">{{
                                                            selectedFile ? selectedFile.name : 'PNG, JPG or GIF' }}</span>
                                                </div>
                                            </template>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-12 flex flex-wrap items-center gap-6">
                            <button @click="handleUpdate"
                                class="px-12 py-5 bg-primary text-white rounded-[1.5rem] font-black shadow-[0_20px_40px_-10px_rgb(var(--color-primary)/0.4)] hover:bg-primary-dark hover:-translate-y-1 active:translate-y-0.5 transition-all duration-300 text-sm uppercase tracking-[0.15em] flex items-center gap-4">
                                <span>Save Changes</span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                                        d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                            <button @click="startEditing"
                                class="px-10 py-5 bg-surface border-2 border-bg-alt/50 text-text-muted rounded-[1.5rem] font-black hover:bg-bg-alt/50 hover:text-text-main transition-all duration-300 text-sm uppercase tracking-[0.15em]">
                                Reset Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Settings / Preferences Section -->
            <div class="bg-surface rounded-3xl p-8 shadow-xl shadow-black/[0.02] border border-bg-alt/50">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 class="text-2xl font-black text-text-main tracking-tight">System Preferences</h2>
                        <p class="text-text-muted font-medium">Personalize your interface and workspace settings.
                        </p>
                    </div>

                    <!-- Theme Switch UI -->
                    <div
                        class="flex items-center gap-1.5 bg-bg-alt/50 backdrop-blur-md rounded-2xl p-1.5 border border-bg-alt/50">
                        <button v-for="mode in ['light', 'dark', 'system']" :key="mode" @click="theme.setTheme(mode)"
                            :class="theme.mode === mode
                                ? 'bg-surface text-primary shadow-sm scale-100'
                                : 'text-text-muted hover:text-text-main hover:bg-bg-alt scale-95'"
                            class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm capitalize transition-all duration-300">
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
