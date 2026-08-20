<template>
  <div class="max-w-5xl mx-auto font-poppins px-4 sm:px-6 lg:px-0">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-extrabold text-text-main tracking-tight">My Orders</h1>
        <p class="text-text-muted mt-1 font-montserrat">Your digital purchases & download library</p>
      </div>
      <NuxtLink
        to="/products"
        class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all duration-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        Browse Products
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24">
      <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary shadow-lg shadow-primary/30"></div>
      <p class="mt-4 text-text-muted font-medium animate-pulse">Loading your orders...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-2xl">
      <p class="font-semibold">{{ error }}</p>
    </div>

    <!-- Empty -->
    <div v-else-if="orders.length === 0" class="text-center py-20 bg-surface rounded-3xl shadow-sm border border-bg-alt flex flex-col items-center">
      <div class="w-24 h-24 bg-bg-alt rounded-full flex items-center justify-center mb-6 text-text-muted">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 class="text-2xl font-bold text-text-main mb-2">No orders yet</h3>
      <p class="text-text-muted mb-8 max-w-sm font-montserrat">You haven't purchased any products yet. Explore our catalog!</p>
      <NuxtLink to="/products" class="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 font-semibold">
        Explore Products
      </NuxtLink>
    </div>

    <!-- Orders List -->
    <div v-else class="space-y-4">
      <div
        v-for="order in orders"
        :key="order.id"
        class="bg-surface rounded-2xl border border-bg-alt/60 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
      >
        <!-- Order Header -->
        <div class="flex items-center justify-between flex-wrap gap-3 p-5 border-b border-bg-alt/60">
          <div>
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Order</p>
            <p class="font-bold text-text-main font-mono">{{ order.order_number }}</p>
          </div>
          <div class="flex items-center gap-4 flex-wrap">
            <div class="text-right">
              <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Total</p>
              <p class="font-extrabold text-primary">{{ formatIDR(order.total_amount) }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Date</p>
              <p class="text-sm font-semibold text-text-main">{{ formatDate(order.created_at) }}</p>
            </div>
            <!-- Status Badge -->
            <span :class="['inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide', statusClass(order.status)]">
              <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass(order.status)]"></span>
              {{ order.status }}
            </span>
          </div>
        </div>

        <!-- Order Items -->
        <div class="p-5 divide-y divide-bg-alt/60">
          <div
            v-for="item in order.order_items"
            :key="item.id"
            class="py-4 first:pt-0 last:pb-0"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
              <!-- Product Image -->
              <div class="h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-bg-alt border border-bg-alt">
                <img
                  v-if="item.product?.product_images?.[0]?.image_url"
                  :src="item.product.product_images[0].image_url"
                  :alt="item.product?.name"
                  class="h-full w-full object-cover"
                />
                <div v-else class="h-full w-full flex items-center justify-center text-text-muted/50">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <div class="flex-grow min-w-0">
                <p class="font-bold text-text-main truncate">{{ item.product?.name }}</p>
                <p class="text-sm text-text-muted font-montserrat line-clamp-1">{{ item.product?.description }}</p>
              </div>

              <div class="flex items-center gap-3 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                <span class="font-bold text-text-main">{{ formatIDR(item.price) }}</span>

                <!-- Download Button (only if paid) -->
                <button
                  v-if="order.status === 'paid'"
                  @click="handleDownload(order, item)"
                  :disabled="downloadingItem === `${order.id}-${item.product?.id}`"
                  class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 shadow-md shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span v-if="downloadingItem === `${order.id}-${item.product?.id}`" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {{ downloadingItem === `${order.id}-${item.product?.id}` ? 'Preparing...' : 'Download' }}
                </button>

                <!-- Resume Button (only while the payment is pending) -->
                <button
                  v-else-if="order.status === 'pending'"
                  @click="continuePayment(order)"
                  :disabled="resumingOrder === order.id"
                  class="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-semibold text-white transition-all duration-300 shadow-md shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span v-if="resumingOrder === order.id" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ resumingOrder === order.id ? 'Opening...' : 'Continue Payment' }}
                </button>

                <!-- Status-based pill -->
                <span v-else class="text-xs text-text-muted font-semibold italic">
                  {{ order.status }}
                </span>
              </div>
            </div>

            <!-- Product Rating (paid orders only) -->
            <div
              v-if="order.status === 'paid' && item.product?.id"
              class="mt-4 rounded-xl border border-bg-alt/60 bg-bg-alt/20 px-4 py-3 sm:ml-20"
            >
              <div v-if="reviewLookupLoading" class="flex items-center gap-2 text-xs font-semibold text-text-muted">
                <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></span>
                Loading your rating...
              </div>

              <div v-else-if="reviewFor(item.product.id)" class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-text-muted">Your rating</p>
                  <div class="mt-1 flex items-center gap-2">
                    <div class="flex text-amber-400" :aria-label="`${reviewFor(item.product.id).rating} out of 5 stars`">
                      <svg
                        v-for="star in 5"
                        :key="star"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="h-5 w-5"
                        :class="star <= reviewFor(item.product.id).rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <span class="text-xs font-semibold text-text-muted">Reviewed {{ formatDate(reviewFor(item.product.id).created_at) }}</span>
                  </div>
                </div>
                <p class="max-w-md text-sm text-text-muted sm:text-right">{{ reviewFor(item.product.id).comment }}</p>
              </div>

              <div v-else-if="reviewLookupError" class="text-xs font-semibold text-red-500">
                {{ reviewLookupError }}
              </div>

              <div v-else>
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-bold text-text-main">Rate this product</p>
                    <p class="text-xs text-text-muted">Choose a star rating after your purchase.</p>
                  </div>
                  <div
                    class="flex items-center gap-1"
                    @mouseleave="hoveredRatings[String(item.product.id)] = 0"
                  >
                    <button
                      v-for="star in 5"
                      :key="star"
                      type="button"
                      class="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      :aria-label="`Give ${star} star rating`"
                      @mouseenter="hoveredRatings[String(item.product.id)] = star"
                      @click="selectRating(item.product.id, star, item.id)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="h-7 w-7 transition-colors"
                        :class="star <= (hoveredRatings[String(item.product.id)] || reviewDrafts[String(item.product.id)]?.rating || 0) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div v-if="expandedReviewItem === String(item.id)" class="mt-3 space-y-3">
                  <textarea
                    v-model="reviewDrafts[String(item.product.id)].comment"
                    rows="3"
                    maxlength="1000"
                    class="w-full resize-none rounded-xl border border-bg-alt bg-surface px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder="Share your experience with this product..."
                  ></textarea>
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <span class="text-xs text-text-muted">{{ reviewDrafts[String(item.product.id)].comment.length }}/1000</span>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded-lg px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-bg-alt"
                        :disabled="submittingReview === String(item.product.id)"
                        @click="cancelReview(item.product.id, item.id)"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="submittingReview === String(item.product.id)"
                        @click="submitProductReview(item)"
                      >
                        <span v-if="submittingReview === String(item.product.id)" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                        {{ submittingReview === String(item.product.id) ? 'Submitting...' : 'Submit Review' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 pb-4 flex justify-end">
          <NuxtLink
            :to="`/orders/${order.id}`"
            class="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
          >
            View Details
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onBeforeUnmount, onMounted } from 'vue'
import { getUser } from '../../services/authService'
import { sCreateReview, sGetReviewsByProfileAndProductIds } from '../../services/reviewsService'
import { supabase } from '../../utils/supabase'
import { formatIDR } from '../../utils/currency'
import Swal from 'sweetalert2'

const router = useRouter()

const orders = ref([])
const loading = ref(true)
const error = ref(null)
const currentUser = ref(null)
const downloadingItem = ref(null)
const resumingOrder = ref(null)
const reviewsByProduct = ref({})
const reviewDrafts = reactive({})
const hoveredRatings = reactive({})
const reviewLookupLoading = ref(false)
const reviewLookupError = ref('')
const expandedReviewItem = ref(null)
const submittingReview = ref(null)
let loadedReviewProductKey = ''
let refreshTimer = null

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

const statusClass = (status) => {
  const map = {
    paid: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30',
    pending: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/30',
    failed: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',
    expired: 'bg-gray-50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 ring-1 ring-gray-400/30',
    cancelled: 'bg-gray-50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 ring-1 ring-gray-400/30',
    refunded: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30',
    partially_refunded: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30',
    chargeback: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',
  }
  return map[status] || 'bg-gray-100 text-gray-500'
}

const statusDotClass = (status) => {
  const map = {
    paid: 'bg-emerald-500',
    pending: 'bg-yellow-500 animate-pulse',
    failed: 'bg-red-500',
    expired: 'bg-gray-400',
    cancelled: 'bg-gray-400',
    refunded: 'bg-blue-500',
    partially_refunded: 'bg-blue-500',
    chargeback: 'bg-red-500',
  }
  return map[status] || 'bg-gray-400'
}

const reviewFor = (productId) => reviewsByProduct.value[String(productId)] || null

const selectRating = (productId, rating, itemId) => {
  const key = String(productId)
  reviewDrafts[key] ||= { rating: 0, comment: '' }
  reviewDrafts[key].rating = rating
  expandedReviewItem.value = String(itemId)
}

const cancelReview = (productId, itemId = null) => {
  const key = String(productId)
  delete reviewDrafts[key]
  hoveredRatings[key] = 0
  if (itemId === null || expandedReviewItem.value === String(itemId)) expandedReviewItem.value = null
}

const loadExistingReviews = async (profileId, incomingOrders, force = false) => {
  const productIds = [...new Set(
    incomingOrders
      .filter((order) => order.status === 'paid')
      .flatMap((order) => order.order_items || [])
      .map((item) => item.product?.id)
      .filter((productId) => productId !== null && productId !== undefined)
  )]
  const productKey = productIds.map(String).sort().join(',')

  if (!force && productKey === loadedReviewProductKey) return
  loadedReviewProductKey = productKey
  reviewLookupError.value = ''

  if (productIds.length === 0) {
    reviewsByProduct.value = {}
    return
  }

  reviewLookupLoading.value = true
  try {
    const reviews = await sGetReviewsByProfileAndProductIds(profileId, productIds)
    reviewsByProduct.value = reviews.reduce((result, review) => {
      const key = String(review.product_id)
      if (!result[key]) result[key] = review
      return result
    }, {})
  } catch (err) {
    console.error('Error fetching buyer reviews:', err)
    loadedReviewProductKey = ''
    reviewLookupError.value = 'Your rating could not be loaded.'
  } finally {
    reviewLookupLoading.value = false
  }
}

const submitProductReview = async (item) => {
  const productId = item.product?.id
  if (productId === null || productId === undefined) return

  const key = String(productId)
  const draft = reviewDrafts[key]
  if (!draft?.rating) {
    await Swal.fire({
      title: 'Choose a rating',
      text: 'Please select between 1 and 5 stars.',
      icon: 'warning',
      confirmButtonColor: 'rgb(var(--color-primary))'
    })
    return
  }

  if (!draft.comment.trim()) {
    await Swal.fire({
      title: 'Write a review',
      text: 'Please add a short comment about the product.',
      icon: 'warning',
      confirmButtonColor: 'rgb(var(--color-primary))'
    })
    return
  }

  submittingReview.value = key
  try {
    const review = await sCreateReview({
      product_id: productId,
      rating: draft.rating,
      comment: draft.comment
    })
    reviewsByProduct.value = {
      ...reviewsByProduct.value,
      [key]: review
    }
    cancelReview(productId, item.id)

    await Swal.fire({
      title: 'Review submitted',
      text: 'Thank you for rating this product.',
      icon: 'success',
      confirmButtonColor: 'rgb(var(--color-primary))'
    })
  } catch (err) {
    console.error('Review submission error:', err)
    const message = String(err?.message || '')
    const friendlyMessage = message.includes('already reviewed')
      ? 'You have already reviewed this product.'
      : message.includes('paid purchases')
        ? 'Only products from paid orders can be reviewed.'
        : 'Your review could not be submitted. Please try again.'

    await Swal.fire({
      title: 'Review failed',
      text: friendlyMessage,
      icon: 'error',
      confirmButtonColor: 'rgb(var(--color-primary))'
    })
  } finally {
    submittingReview.value = null
  }
}

onMounted(async () => {
  const user = await getUser()
  if (!user) {
    router.push('/login')
    return
  }
  currentUser.value = user
  await fetchOrders(user.id)
  // Payment webhooks update statuses asynchronously, including pending -> expired.
  refreshTimer = window.setInterval(() => fetchOrders(user.id, true), 10000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})

const fetchOrders = async (profileId, silent = false) => {
  if (!silent) loading.value = true
  error.value = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const data = await $fetch('/api/orders', { 
      query: { profile_id: profileId },
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
    orders.value = data.orders || []
    await loadExistingReviews(profileId, orders.value)
  } catch (err) {
    console.error('Error fetching orders:', err)
    error.value = err?.message || 'Failed to load orders.'
  } finally {
    if (!silent) loading.value = false
  }
}

const handleDownload = async (order, item) => {
  const key = `${order.id}-${item.product?.id}`
  downloadingItem.value = key
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const data = await $fetch(`/api/orders/${order.id}/download`, {
      query: {
        profile_id: currentUser.value?.id,
        product_id: item.product?.id
      },
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
    // Trigger browser download
    const link = document.createElement('a')
    link.href = data.url
    link.download = data.file_name || 'download.zip'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Download error:', err)
    alert(err?.data?.message || err?.message || 'Download failed.')
  } finally {
    downloadingItem.value = null
  }
}

const getPaymentUrl = (incomingOrder) => {
  const payments = Array.isArray(incomingOrder?.payments) ? incomingOrder.payments : []
  const xenditPayment = payments.find((payment) => {
    const provider = String(payment?.provider || '').toLowerCase()
    return provider === 'xendit' && payment?.raw_response?.invoice_url
  })

  if (xenditPayment?.raw_response?.invoice_url) {
    return xenditPayment.raw_response.invoice_url
  }

  return payments.find((payment) => payment?.raw_response?.invoice_url)?.raw_response?.invoice_url || null
}

const continuePayment = async (order) => {
  if (!currentUser.value) return

  try {
    resumingOrder.value = order.id

    const paymentUrl = getPaymentUrl(order)
    if (!paymentUrl) {
      throw new Error('Payment URL is unavailable.')
    }

    window.location.href = paymentUrl
  } catch (err) {
    console.error('Continue payment error:', err)
    alert(err?.data?.statusMessage || err?.data?.message || err?.message || 'Failed to continue payment.')
  } finally {
    resumingOrder.value = null
  }
}
</script>
