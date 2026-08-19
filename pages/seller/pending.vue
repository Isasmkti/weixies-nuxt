<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../services/sellerService'

const seller = ref(null)
const errorMessage = ref('')

const statusCopy = computed(() => {
  switch (seller.value?.status) {
    case 'rejected':
      return {
        title: 'Seller application not approved',
        message: 'Update your store details and submit the same application for another review.',
      }
    case 'suspended':
      return {
        title: 'Seller account suspended',
        message: 'Your seller account is currently suspended. Please contact the platform team for assistance.',
      }
    default:
      return {
        title: 'Your application is being reviewed',
        message: 'Thanks for applying. A platform admin will review your store before you can access seller tools.',
      }
  }
})

onMounted(async () => {
  try {
    seller.value = await getCurrentSeller()
  } catch (error) {
    errorMessage.value = 'Unable to load your seller application status.'
  }
})
</script>

<template>
  <div class="max-w-2xl mx-auto py-8 font-poppins">
    <div class="rounded-3xl bg-surface border border-bg-alt/50 shadow-xl shadow-black/[0.03] p-8 md:p-12 text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ errorMessage }}</p>
      <template v-else-if="seller">
        <p class="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-primary">{{ seller.store_name }}</p>
        <h1 class="mt-3 text-3xl font-black tracking-tight text-text-main">{{ statusCopy.title }}</h1>
        <p class="mt-4 text-text-muted">{{ statusCopy.message }}</p>
        <div v-if="seller.status === 'rejected' && seller.rejection_reason" class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-left text-sm text-red-700">
          <p class="font-bold">Review feedback</p>
          <p class="mt-1">{{ seller.rejection_reason }}</p>
        </div>
      </template>
      <p v-else class="mt-6 text-text-muted">Loading your application status...</p>

      <NuxtLink v-if="seller?.status === 'rejected'" to="/become-seller" class="mt-8 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-dark">Resubmit application</NuxtLink>
      <NuxtLink v-else to="/dashboard" class="mt-8 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-dark">Back to dashboard</NuxtLink>
    </div>
  </div>
</template>
