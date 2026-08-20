import * as reviewsRepository from '../repositories/reviewsRepository'

export async function sGetReviewsByProductId(productId) {
    try {
        return await reviewsRepository.rGetReviewsByProductId(productId)
    } catch (error) {
        throw error
    }
}

export async function sCreateReview(reviewData) {
    try {
        return await reviewsRepository.rCreateReview(reviewData)
    } catch (error) {
        throw error
    }
}

export async function sGetReviewsByProfileAndProductIds(profileId, productIds) {
    return await reviewsRepository.rGetReviewsByProfileAndProductIds(profileId, productIds)
}
