<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../services/sellerService'

const seller = ref(null)
const errorMessage = ref('')

const isRejected = computed(() => seller.value?.status === 'rejected')
const isSuspended = computed(() => seller.value?.status === 'suspended')
const storeInitial = computed(() => seller.value?.store_name?.trim()?.charAt(0)?.toUpperCase() || 'S')

const statusCopy = computed(() => {
  switch (seller.value?.status) {
    case 'rejected':
      return {
        eyebrow: 'Application review completed',
        title: 'Your seller application was not approved',
        message: 'Review the administrator feedback below, update the affected store information, and submit the same application again.',
        badge: 'Rejected',
      }
    case 'suspended':
      return {
        eyebrow: 'Seller account notice',
        title: 'Your seller account is suspended',
        message: 'Seller tools are currently unavailable. Please contact the platform team if you need more information.',
        badge: 'Suspended',
      }
    default:
      return {
        eyebrow: 'Application received',
        title: 'Your application is being reviewed',
        message: 'Thanks for applying. A platform administrator will review your store before seller tools become available.',
        badge: 'Pending review',
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
  <div class="mx-auto max-w-4xl py-4 font-poppins md:py-8">
    <section class="overflow-hidden rounded-ui-xl border border-border bg-surface shadow-elevation-1">
      <div v-if="errorMessage" class="p-6 sm:p-8">
        <div class="rounded-ui-lg border border-danger/25 bg-danger/10 p-5 text-danger" role="alert">
          <p class="font-semibold">Application status unavailable</p>
          <p class="mt-1 text-sm">{{ errorMessage }}</p>
        </div>
      </div>

      <div v-else-if="!seller" class="space-y-5 p-6 sm:p-8" role="status" aria-label="Loading seller application">
        <div class="flex animate-pulse items-center gap-4 motion-reduce:animate-none">
          <div class="h-20 w-20 shrink-0 rounded-ui-lg bg-bg-alt"></div>
          <div class="flex-1 space-y-3"><div class="h-4 w-32 rounded bg-bg-alt"></div><div class="h-7 max-w-sm rounded bg-bg-alt"></div></div>
        </div>
        <div class="h-36 animate-pulse rounded-ui-lg bg-bg-alt motion-reduce:animate-none"></div>
      </div>

      <template v-else>
        <header
          class="border-b p-6 sm:p-8"
          :class="isRejected ? 'border-danger/20 bg-danger/5' : isSuspended ? 'border-warning/20 bg-warning/5' : 'border-primary/15 bg-primary/5'"
        >
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-ui-lg border-4 bg-surface text-2xl font-bold shadow-elevation-1"
              :class="isRejected ? 'border-danger/15 text-danger' : isSuspended ? 'border-warning/20 text-warning' : 'border-primary/15 text-primary'"
            >
              <img v-if="seller.store_image_url" :src="seller.store_image_url" :alt="`${seller.store_name} store photo`" class="h-full w-full object-cover">
              <span v-else>{{ storeInitial }}</span>
            </div>

            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold uppercase tracking-[0.18em]" :class="isRejected ? 'text-danger' : isSuspended ? 'text-warning' : 'text-primary'">{{ statusCopy.eyebrow }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-3">
                <h2 class="truncate text-xl font-semibold text-text-main sm:text-2xl">{{ seller.store_name }}</h2>
                <span
                  class="rounded-ui-full px-3 py-1 text-xs font-bold"
                  :class="isRejected ? 'bg-danger text-white' : isSuspended ? 'bg-warning text-white' : 'bg-primary text-white'"
                >{{ statusCopy.badge }}</span>
              </div>
              <p class="mt-1 truncate text-sm text-text-muted">/stores/{{ seller.store_slug }}</p>
            </div>
          </div>

          <div v-if="isRejected" class="mt-6 rounded-ui-lg border border-danger/25 bg-surface p-5 shadow-elevation-1 sm:p-6">
            <div class="flex items-start gap-4">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-danger/10 text-danger">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v4m0 4h.01M10.3 3.8 2.4 17.5A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.5L13.7 3.8a2 2 0 0 0-3.4 0Z" /></svg>
              </span>
              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.16em] text-danger">Main rejection reason</p>
                <p class="mt-2 whitespace-pre-line text-base font-semibold leading-7 text-text-main">{{ seller.rejection_reason || 'The administrator did not provide a detailed reason. Contact support before resubmitting if you need clarification.' }}</p>
              </div>
            </div>
          </div>
        </header>

        <div class="p-6 sm:p-8">
          <h1 class="text-2xl font-semibold tracking-tight text-text-main sm:text-3xl">{{ statusCopy.title }}</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">{{ statusCopy.message }}</p>

          <div v-if="isRejected" class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-ui-md border border-border bg-bg p-4"><span class="text-xs font-bold text-primary">01</span><p class="mt-2 text-sm font-semibold text-text-main">Read the feedback</p></div>
            <div class="rounded-ui-md border border-border bg-bg p-4"><span class="text-xs font-bold text-primary">02</span><p class="mt-2 text-sm font-semibold text-text-main">Update your store</p></div>
            <div class="rounded-ui-md border border-border bg-bg p-4"><span class="text-xs font-bold text-primary">03</span><p class="mt-2 text-sm font-semibold text-text-main">Submit for review</p></div>
          </div>

          <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
            <NuxtLink to="/dashboard" class="inline-flex min-h-11 items-center justify-center rounded-ui-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-text-main transition hover:border-primary/30 hover:text-primary">Back to dashboard</NuxtLink>
            <NuxtLink v-if="isRejected" to="/become-seller" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-ui-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-elevation-1 transition hover:bg-primary-dark">
              Update and resubmit
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" /></svg>
            </NuxtLink>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
