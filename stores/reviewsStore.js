import { defineStore } from 'pinia'
import * as reviewsService from '../services/reviewsService'

export const useReviewsStore = defineStore('reviews', {
    state: () => ({
        reviews: [],
        loading: false,
        error: null
    }),

    actions: {
        async fetchReviews(productId) {
            this.loading = true
            this.error = null
            try {
                const data = await reviewsService.sGetReviewsByProductId(productId)
                this.reviews = data
                return data
            } catch (err) {
                this.error = err.message || 'Failed to fetch reviews'
                console.error(err)
            } finally {
                this.loading = false
            }
        },

        async submitReview(reviewData) {
            this.loading = true
            this.error = null
            try {
                const newReview = await reviewsService.sCreateReview(reviewData)
                this.reviews.unshift(newReview)
                return newReview
            } catch (err) {
                this.error = err.message || 'Failed to submit review'
                console.error(err)
                throw err
            } finally {
                this.loading = false
            }
        }
    }
})
