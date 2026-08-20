<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createSellerApplication, createStoreSlug, getCurrentSeller, resubmitSellerApplication } from '../services/sellerService'

const router = useRouter()
const storeName = ref('')
const storeDescription = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const isChecking = ref(true)
const rejectedSeller = ref(null)
const storeImageFile = ref(null)
const storeImagePreview = ref('')

const slugPreview = computed(() => createStoreSlug(storeName.value))
const displayedStoreImage = computed(() => storeImagePreview.value || rejectedSeller.value?.store_image_url || '')

const clearStoreImagePreview = () => {
  if (storeImagePreview.value) URL.revokeObjectURL(storeImagePreview.value)
  storeImagePreview.value = ''
}

const handleStoreImage = (event) => {
  const file = event.target.files?.[0] || null
  errorMessage.value = ''
  clearStoreImagePreview()
  storeImageFile.value = null

  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    event.target.value = ''
    errorMessage.value = 'Store photo must be a JPG, PNG, WEBP, or GIF image.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = ''
    errorMessage.value = 'Store photo must be 5 MB or smaller.'
    return
  }

  storeImageFile.value = file
  storeImagePreview.value = URL.createObjectURL(file)
}

onBeforeUnmount(clearStoreImagePreview)

onMounted(async () => {
  try {
    const seller = await getCurrentSeller()
    if (seller) {
      if (seller.status === 'rejected') {
        rejectedSeller.value = seller
        storeName.value = seller.store_name || ''
        storeDescription.value = seller.store_description || ''
      } else {
        await router.replace(seller.status === 'approved' ? '/seller' : '/seller/pending')
      }
    }
  } catch (error) {
    errorMessage.value = 'Unable to check your seller application. Please try again.'
  } finally {
    isChecking.value = false
  }
})

const submitApplication = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (rejectedSeller.value) {
      await resubmitSellerApplication(
        rejectedSeller.value.id,
        storeName.value,
        storeDescription.value,
        storeImageFile.value,
        rejectedSeller.value.store_image_url,
      )
    } else {
      await createSellerApplication(storeName.value, storeDescription.value, storeImageFile.value)
    }
    await router.push('/seller/pending')
  } catch (error) {
    errorMessage.value = error.message || 'Unable to submit your seller application.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-8 font-poppins">
    <div v-if="isChecking" class="min-h-[16rem] flex items-center justify-center text-text-muted">
      Checking your seller account...
    </div>

    <div v-else class="bg-surface rounded-3xl border border-bg-alt/50 shadow-xl shadow-black/[0.03] overflow-hidden">
      <div class="bg-gradient-to-br from-primary to-primary-dark p-8 md:p-10 text-white">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Weixies Marketplace</p>
        <h1 class="mt-3 text-3xl md:text-4xl font-black tracking-tight">{{ rejectedSeller ? 'Resubmit your store' : 'Open your store' }}</h1>
        <p class="mt-3 max-w-xl text-white/80">{{ rejectedSeller ? 'Update your store details, then submit the same application for another review.' : 'Sell your digital products to the Weixies community. Your application will be reviewed before you can publish products.' }}</p>
      </div>

      <form class="p-8 md:p-10 space-y-6" @submit.prevent="submitApplication">
        <div>
          <label for="store-name" class="block text-sm font-bold text-text-main mb-2">Store name</label>
          <input
            id="store-name"
            v-model="storeName"
            type="text"
            required
            maxlength="120"
            autocomplete="organization"
            placeholder="e.g. Pixel Studio"
            class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
          <p class="mt-2 text-sm text-text-muted">
            Your store URL will be generated automatically:
            <span class="font-semibold text-primary">/stores/{{ slugPreview }}</span>
          </p>
        </div>

        <div>
          <label for="store-description" class="block text-sm font-bold text-text-main mb-2">Store description <span class="font-normal text-text-muted">(optional)</span></label>
          <textarea
            id="store-description"
            v-model="storeDescription"
            rows="4"
            maxlength="1000"
            placeholder="Tell buyers what you sell and what makes your store special."
            class="w-full resize-y rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          ></textarea>
        </div>

        <div>
          <label for="store-image" class="block text-sm font-bold text-text-main mb-2">Store photo</label>
          <div class="flex flex-col gap-4 rounded-2xl border border-bg-alt bg-bg/50 p-4 sm:flex-row sm:items-center">
            <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-bg-alt bg-surface">
              <img v-if="displayedStoreImage" :src="displayedStoreImage" alt="Store photo preview" class="h-full w-full object-cover">
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-9 w-9 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.5M3 16.5l4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.4-1.4a2 2 0 0 1 2.8 0l3.8 3.8M8.5 8.5h.01" /></svg>
            </div>
            <div class="min-w-0 flex-1">
              <input
                id="store-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                :required="!rejectedSeller?.store_image_url"
                class="block w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 text-sm text-text-main file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-bold file:text-primary"
                @change="handleStoreImage"
              >
              <p class="mt-2 text-xs text-text-muted">JPG, PNG, WEBP, or GIF. Maximum 5 MB. Use a clear square shop logo or photo.</p>
              <p v-if="storeImageFile" class="mt-1 truncate text-xs font-semibold text-primary">Selected: {{ storeImageFile.name }}</p>
              <p v-else-if="rejectedSeller?.store_image_url" class="mt-1 text-xs font-semibold text-text-main">Current store photo will be kept unless you choose a new one.</p>
            </div>
          </div>
        </div>

        <div v-if="rejectedSeller?.rejection_reason" class="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p class="font-bold">Previous review feedback</p>
          <p class="mt-1">{{ rejectedSeller.rejection_reason }}</p>
        </div>

        <div class="rounded-2xl bg-primary/5 border border-primary/10 p-5 text-sm text-text-muted">
          <p class="font-bold text-text-main">What happens next?</p>
          <p class="mt-1">We create a pending seller application. You can access the seller workspace once a platform admin approves it.</p>
        </div>

        <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ errorMessage }}</p>

        <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <NuxtLink to="/dashboard" class="inline-flex justify-center rounded-xl px-5 py-3 font-bold text-text-muted hover:bg-bg-alt transition-colors">Cancel</NuxtLink>
          <button
            type="submit"
            :disabled="isLoading"
            class="inline-flex justify-center rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {{ isLoading ? 'Submitting application...' : rejectedSeller ? 'Resubmit for review' : 'Submit seller application' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
