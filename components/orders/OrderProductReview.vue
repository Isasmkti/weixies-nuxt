<script setup>
import { ref, watch } from 'vue'
import Swal from 'sweetalert2'
import { sCreateReview, sGetReviewsByProfileAndProductIds } from '../../services/reviewsService'

const props = defineProps({
  orderStatus: { type: String, required: true },
  productId: { type: [Number, String], required: true },
  profileId: { type: String, required: true },
})

const existingReview = ref(null)
const rating = ref(0)
const hoveredRating = ref(0)
const comment = ref('')
const expanded = ref(false)
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : '-'

const loadReview = async () => {
  existingReview.value = null
  loadError.value = ''
  if (props.orderStatus !== 'paid' || !props.profileId || !props.productId) return

  loading.value = true
  try {
    const reviews = await sGetReviewsByProfileAndProductIds(props.profileId, [props.productId])
    existingReview.value = reviews[0] || null
  } catch (error) {
    console.error('Error fetching buyer review:', error)
    loadError.value = 'Your rating could not be loaded.'
  } finally {
    loading.value = false
  }
}

const selectRating = (value) => {
  rating.value = value
  expanded.value = true
}

const cancelReview = () => {
  rating.value = 0
  hoveredRating.value = 0
  comment.value = ''
  expanded.value = false
}

const submitReview = async () => {
  if (props.orderStatus !== 'paid') return

  if (!rating.value) {
    await Swal.fire({
      title: 'Choose a rating',
      text: 'Please select between 1 and 5 stars.',
      icon: 'warning',
      confirmButtonColor: 'rgb(var(--color-primary))',
    })
    return
  }

  const normalizedComment = comment.value.trim()
  if (!normalizedComment) {
    await Swal.fire({
      title: 'Write a review',
      text: 'Please add a short comment about the product.',
      icon: 'warning',
      confirmButtonColor: 'rgb(var(--color-primary))',
    })
    return
  }

  submitting.value = true
  try {
    existingReview.value = await sCreateReview({
      product_id: props.productId,
      rating: rating.value,
      comment: normalizedComment,
    })
    cancelReview()

    await Swal.fire({
      title: 'Review submitted',
      text: 'Thank you for rating this product.',
      icon: 'success',
      confirmButtonColor: 'rgb(var(--color-primary))',
    })
  } catch (error) {
    console.error('Review submission error:', error)
    const message = String(error?.message || '')
    const friendlyMessage = message.includes('already reviewed')
      ? 'You have already reviewed this product.'
      : message.includes('paid purchases')
        ? 'Only products from paid orders can be reviewed.'
        : 'Your review could not be submitted. Please try again.'

    await Swal.fire({
      title: 'Review failed',
      text: friendlyMessage,
      icon: 'error',
      confirmButtonColor: 'rgb(var(--color-primary))',
    })
  } finally {
    submitting.value = false
  }
}

watch(
  () => [props.orderStatus, props.productId, props.profileId],
  loadReview,
  { immediate: true },
)
</script>

<template>
  <div v-if="orderStatus === 'paid'" class="mt-5 rounded-xl border border-bg-alt/60 bg-bg-alt/20 px-4 py-4 sm:ml-[6.25rem]">
    <div v-if="loading" class="flex items-center gap-2 text-xs font-semibold text-text-muted">
      <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></span>
      Loading your rating...
    </div>

    <div v-else-if="existingReview" class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-wider text-text-muted">Your rating</p>
        <div class="mt-1 flex items-center gap-2">
          <div class="flex" :aria-label="`${existingReview.rating} out of 5 stars`">
            <svg v-for="star in 5" :key="star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5" :class="star <= existingReview.rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <span class="text-xs font-semibold text-text-muted">Reviewed {{ formatDate(existingReview.created_at) }}</span>
        </div>
      </div>
      <p class="max-w-md text-sm leading-6 text-text-muted sm:text-right">{{ existingReview.comment }}</p>
    </div>

    <div v-else-if="loadError" class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs font-semibold text-red-500">{{ loadError }}</p>
      <button type="button" class="text-xs font-bold text-primary hover:underline" @click="loadReview">Try again</button>
    </div>

    <div v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-bold text-text-main">Rate this product</p>
          <p class="text-xs text-text-muted">Choose a star rating for your paid purchase.</p>
        </div>
        <div class="flex items-center gap-1" @mouseleave="hoveredRating = 0">
          <button v-for="star in 5" :key="star" type="button" class="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" :aria-label="`Give ${star} star rating`" @mouseenter="hoveredRating = star" @click="selectRating(star)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-7 w-7 transition-colors" :class="star <= (hoveredRating || rating) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="expanded" class="mt-4 space-y-3">
        <textarea v-model="comment" rows="3" maxlength="1000" class="w-full resize-none rounded-xl border border-bg-alt bg-surface px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="Share your experience with this product..."></textarea>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-xs text-text-muted">{{ comment.length }}/1000</span>
          <div class="flex items-center gap-2">
            <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-bg-alt" :disabled="submitting" @click="cancelReview">Cancel</button>
            <button type="button" class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60" :disabled="submitting" @click="submitReview">
              <span v-if="submitting" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
              {{ submitting ? 'Submitting...' : 'Submit Review' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
