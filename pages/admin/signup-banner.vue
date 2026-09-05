<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  sAdminSignupBanner,
  sDeleteSignupBanner,
  sSaveSignupBanner,
  sUploadSignupBanner,
} from '../../services/signupBannerService'
import { confirmAction } from '../../utils/sweetAlert'

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const originalImagePath = ref('')
const temporaryImagePath = ref('')
const form = ref({ image_path: '', image_url: '', alt_text: 'Weixies marketplace sign-up banner', is_active: false })

const clearMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

async function discardTemporaryImage() {
  if (!temporaryImagePath.value) return
  const path = temporaryImagePath.value
  temporaryImagePath.value = ''
  try {
    await sDeleteSignupBanner(path)
  } catch (error) {
    console.warn('[Login banner] Temporary image cleanup failed.', error)
  }
}

async function loadBanner() {
  loading.value = true
  clearMessages()
  try {
    const banner = await sAdminSignupBanner()
    if (banner) form.value = { ...banner }
    originalImagePath.value = banner?.image_path || ''
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load the sign-up banner. Make sure migration 0036 has been applied.'
  } finally {
    loading.value = false
  }
}

async function uploadImage(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploading.value = true
  clearMessages()
  try {
    await discardTemporaryImage()
    const uploaded = await sUploadSignupBanner(file)
    temporaryImagePath.value = uploaded.image_path
    form.value.image_path = uploaded.image_path
    form.value.image_url = uploaded.image_url
    form.value.is_active = true
  } catch (error) {
    errorMessage.value = error.message || 'Failed to upload the sign-up banner.'
  } finally {
    uploading.value = false
  }
}

async function saveBanner() {
  saving.value = true
  clearMessages()
  try {
    const saved = await sSaveSignupBanner(form.value)
    const replacedPath = originalImagePath.value && originalImagePath.value !== saved.image_path
      ? originalImagePath.value
      : ''

    form.value = { ...saved }
    originalImagePath.value = saved.image_path || ''
    temporaryImagePath.value = ''
    if (replacedPath) {
      try {
        await sDeleteSignupBanner(replacedPath)
      } catch (error) {
        console.warn('[Login banner] Previous image cleanup failed.', error)
      }
    }
    successMessage.value = saved.is_active
      ? 'The sign-up banner is now live.'
      : 'The default sign-up image is now active.'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to save the sign-up banner.'
  } finally {
    saving.value = false
  }
}

async function removeImage() {
  if (!form.value.image_path) return
  const confirmed = await confirmAction({
    title: 'Remove sign-up banner?',
    text: 'The uploaded image will be deleted and the default sign-up image will be restored.',
    confirmButtonText: 'Remove banner',
    confirmButtonColor: 'rgb(var(--color-danger))',
  })
  if (!confirmed) return
  saving.value = true
  clearMessages()
  const paths = [...new Set([form.value.image_path, temporaryImagePath.value].filter(Boolean))]
  try {
    const saved = await sSaveSignupBanner({ ...form.value, image_path: '', image_url: '', is_active: false })
    form.value = { ...saved }
    originalImagePath.value = ''
    temporaryImagePath.value = ''
    await Promise.all(paths.map(path => sDeleteSignupBanner(path).catch(error => {
      console.warn('[Login banner] Removed setting but asset cleanup failed.', error)
    })))
    successMessage.value = 'The banner was removed. The default image will be shown on sign-up.'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to remove the sign-up banner.'
  } finally {
    saving.value = false
  }
}

onMounted(loadBanner)
onBeforeUnmount(() => {
  if (temporaryImagePath.value) discardTemporaryImage()
})
</script>

<template>
  <div class="mx-auto max-w-7xl font-poppins">
    <header class="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.25em] text-primary">Authentication content</p>
        <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Sign-up Banner</h1>
        <p class="mt-2 max-w-2xl text-text-muted">Manage the image displayed in the desktop visual panel of the sign-up page.</p>
      </div>
      <NuxtLink to="/signup" target="_blank" class="inline-flex items-center justify-center rounded-xl border border-bg-alt bg-surface px-5 py-3 text-sm font-bold text-text-main transition hover:border-primary/30 hover:text-primary">Preview Sign-up</NuxtLink>
    </header>

    <p v-if="errorMessage" class="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-600 dark:text-red-300">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{{ successMessage }}</p>

    <div v-if="loading" class="h-[520px] animate-pulse rounded-3xl border border-bg-alt bg-surface"></div>
    <section v-else class="grid overflow-hidden rounded-3xl border border-bg-alt bg-surface shadow-elevation-1 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="relative min-h-[420px] overflow-hidden bg-primary-dark lg:min-h-[620px]">
        <img v-if="form.image_url" :src="form.image_url" :alt="form.alt_text" class="absolute inset-0 h-full w-full object-cover">
        <img v-else src="https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1964&auto=format&fit=crop" alt="Default sign-up banner" class="absolute inset-0 h-full w-full object-cover">
        <div class="absolute inset-0 bg-primary-dark/60 mix-blend-multiply"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 z-10 bg-black/70 px-8 py-6 text-white backdrop-blur-sm">
          <div class="flex items-center gap-2"><img src="../../assets/weixies-logo.svg" alt="" class="h-8 w-8 brightness-0 invert"><span class="text-2xl font-extrabold">Weixies</span></div>
          <p class="mt-2 max-w-md text-sm leading-6 text-white/90">Discover premium digital assets, design resources, templates, and tools curated just for you.</p>
        </div>
        <span class="absolute left-5 top-5 rounded-full px-3 py-1.5 text-xs font-bold" :class="form.image_url && form.is_active ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white'">{{ form.image_url && form.is_active ? 'Image active' : 'Default image fallback' }}</span>
      </div>

      <form class="flex flex-col p-6 lg:p-7" @submit.prevent="saveBanner">
        <div>
          <h2 class="text-xl font-black text-text-main">Banner settings</h2>
          <p class="mt-2 text-sm leading-6 text-text-muted">The image uses <code>object-cover</code> and may be cropped depending on screen height. Keep important subjects near the center.</p>
        </div>

        <div class="mt-7 space-y-5">
          <label class="block text-sm font-bold text-text-main">Banner image
            <span class="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-bg-alt bg-bg px-4 py-4 text-sm font-bold text-primary transition hover:border-primary/40 hover:bg-primary/5">
              {{ uploading ? 'Uploading...' : (form.image_url ? 'Replace image' : 'Upload image') }}
              <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="uploading || saving" @change="uploadImage">
            </span>
          </label>
          <p class="-mt-3 text-xs leading-5 text-text-muted">JPG, PNG, or WEBP. Maximum 5 MB. A centered landscape or 4:3 composition works best.</p>

          <label class="block text-sm font-bold text-text-main">Alternative text
            <input v-model.trim="form.alt_text" required maxlength="160" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
          </label>

          <label class="flex items-start gap-3 rounded-xl border border-bg-alt bg-bg p-4 text-sm text-text-main">
            <input v-model="form.is_active" type="checkbox" :disabled="!form.image_path" class="mt-0.5 h-5 w-5 rounded border-bg-alt text-primary focus:ring-primary">
            <span><span class="block font-bold">Show image on sign-up</span><span class="mt-1 block text-xs leading-5 text-text-muted">Turn this off to temporarily restore the default sign-up image without deleting the uploaded image.</span></span>
          </label>
        </div>

        <div class="mt-auto flex flex-col gap-3 pt-8">
          <button type="submit" :disabled="saving || uploading" class="rounded-xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60">{{ saving ? 'Saving...' : 'Save Banner' }}</button>
          <button v-if="form.image_path" type="button" :disabled="saving || uploading" class="rounded-xl border border-red-500/20 px-5 py-3 font-bold text-red-600 transition hover:bg-red-500/10 disabled:opacity-60" @click="removeImage">Remove image</button>
        </div>
      </form>
    </section>
  </div>
</template>
