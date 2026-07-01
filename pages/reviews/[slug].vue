<template>
    <div class="max-w-3xl mx-auto font-poppins px-4 sm:px-6 lg:px-0">
        <div v-if="loading"
            class="bg-surface rounded-3xl border border-bg-alt/60 p-6 sm:p-12 text-center shadow-lg">
            <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
            <p class="mt-4 text-text-muted font-semibold">Loading product...</p>
        </div>

        <div v-else-if="error"
            class="bg-surface rounded-3xl border border-bg-alt/60 p-6 sm:p-12 text-center shadow-lg">
            <h2 class="text-2xl font-bold text-text-main mb-2">Product not available</h2>
            <p class="text-text-muted mb-6">{{ error }}</p>
            <NuxtLink to="/products"
                class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-dark transition-colors">
                Back to Catalog
            </NuxtLink>
        </div>

        <div v-else-if="product" class="space-y-4 md:space-y-6">
            <div class="flex items-center justify-between gap-4">
                <NuxtLink :to="`/products/${product.slug}`"
                    class="inline-flex items-center gap-2 text-text-muted hover:text-primary font-semibold transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Product
                </NuxtLink>
            </div>

            <section
                class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-4 sm:p-6 md:p-8 shadow-lg">
                <div class="flex items-center gap-4">
                    <div class="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden rounded-xl bg-bg-alt">
                        <img v-if="product.image_url" :src="product.image_url" :alt="product.name"
                            class="h-full w-full object-cover">
                    </div>
                    <div class="min-w-0">
                        <span
                            class="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                            Reviewing
                        </span>
                        <h1 class="text-xl sm:text-2xl font-extrabold text-text-main truncate mt-1">
                            {{ product.name }}
                        </h1>
                    </div>
                </div>
            </section>

            <section
                class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-4 sm:p-6 md:p-10 shadow-lg">
                <h2 class="text-xl sm:text-2xl font-bold text-text-main mb-6">
                    Write a Review
                </h2>

                <div class="bg-bg-alt/30 p-6 rounded-2xl border border-bg-alt/50">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-bold text-text-muted mb-2">Rating</label>
                            <div class="flex gap-2">
                                <button v-for="star in 5" :key="star" @click="reviewForm.rating = star"
                                    class="focus:outline-none transition-transform hover:scale-110">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8"
                                        :class="star <= reviewForm.rating ? 'text-yellow-500 fill-current' : 'text-gray-300 dark:text-gray-600'"
                                        viewBox="0 0 20 20" fill="currentColor">
                                        <path
                                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-text-muted mb-2">Comment</label>
                            <textarea v-model="reviewForm.comment" rows="4"
                                class="w-full px-4 py-3 rounded-xl bg-surface border-2 border-bg-alt/50 text-text-main focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all resize-none"
                                placeholder="Share your thoughts about this product..."></textarea>
                        </div>
                        <button @click="submitReview" :disabled="isSubmittingReview"
                            class="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                            <span v-if="isSubmittingReview" class="flex items-center gap-2">
                                <span
                                    class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                                Submitting...
                            </span>
                            <span v-else>Submit Review</span>
                        </button>
                    </div>
                </div>
            </section>

            <section
                class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-4 sm:p-6 md:p-10 shadow-lg">
                <h2 class="text-xl sm:text-2xl font-bold text-text-main mb-6">
                    Customer Reviews
                </h2>

                <div v-if="reviewsStore.loading && reviewsStore.reviews.length === 0"
                    class="flex justify-center py-8">
                    <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary"></div>
                </div>
                <div v-else-if="reviewsStore.reviews.length === 0" class="text-center py-8 text-text-muted">
                    <p>No reviews yet. Be the first to review this product!</p>
                </div>
                <div v-else class="space-y-6">
                    <div v-for="review in reviewsStore.reviews" :key="review.id"
                        class="p-5 rounded-2xl bg-bg border border-bg-alt/50">
                        <div class="flex items-center gap-4 mb-3">
                            <img v-if="review.profiles?.profile_img" :src="review.profiles.profile_img" alt="Reviewer"
                                class="w-10 h-10 rounded-full object-cover">
                            <div v-else
                                class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {{ review.profiles?.full_name?.charAt(0) || 'U' }}
                            </div>
                            <div>
                                <p class="font-bold text-text-main">{{ review.profiles?.full_name || 'Anonymous User' }}
                                </p>
                                <div class="flex items-center gap-2">
                                    <div class="flex text-yellow-500">
                                        <svg v-for="i in 5" :key="i" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3"
                                            :class="i <= review.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-600'"
                                            viewBox="0 0 20 20" fill="currentColor">
                                            <path
                                                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </div>
                                    <span class="text-xs text-text-muted">{{ new
                                        Date(review.created_at).toLocaleDateString() }}</span>
                                </div>
                            </div>
                        </div>
                        <p class="text-text-muted">{{ review.comment }}</p>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useReviewsStore } from '../../stores/reviewsStore'
import { useProductsStore } from '../../stores/productsStore'
import { getUser } from '../../services/authService'
import Swal from 'sweetalert2'

const route = useRoute()
const router = useRouter()
const reviewsStore = useReviewsStore()
const productsStore = useProductsStore()

const product = ref(null)
const loading = ref(true)
const error = ref('')

const reviewForm = ref({ rating: 5, comment: '' })
const isSubmittingReview = ref(false)

const fetchProduct = async () => {
    const slug = route.params.slug
    if (!slug) return
    loading.value = true
    error.value = ''
    try {
        const found = await productsStore.sGetBySlug(slug)
        if (!found) throw new Error('The product could not be found.')
        product.value = found
        await reviewsStore.fetchReviews(found.id)
    } catch (err) {
        product.value = null
        error.value = err.message || 'Failed to load this product.'
        console.error('Error fetching product:', err)
    } finally {
        loading.value = false
    }
}

const submitReview = async () => {
    if (!reviewForm.value.comment.trim()) {
        Swal.fire({
            title: 'Error!',
            text: 'Please write a review comment.',
            icon: 'error',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
        return
    }

    const user = await getUser()
    if (!user) {
        router.push('/login')
        return
    }

    isSubmittingReview.value = true
    try {
        await reviewsStore.submitReview({
            product_id: product.value.id,
            profile_id: user.id,
            rating: reviewForm.value.rating,
            comment: reviewForm.value.comment
        })
        reviewForm.value.comment = ''
        reviewForm.value.rating = 5
        Swal.fire({
            title: 'Success!',
            text: 'Your review has been submitted.',
            icon: 'success',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
    } catch (err) {
        Swal.fire({
            title: 'Error!',
            text: 'Failed to submit review.',
            icon: 'error',
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text))',
            confirmButtonColor: 'rgb(var(--color-primary))'
        })
    } finally {
        isSubmittingReview.value = false
    }
}

onMounted(fetchProduct)
watch(() => route.params.slug, fetchProduct)
</script>
