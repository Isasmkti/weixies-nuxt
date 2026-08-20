import { supabase } from '../utils/supabase'

export async function rGetReviewsByProductId(productId) {
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            *,
            profiles (full_name, profile_img)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
}

export async function rCreateReview(reviewData) {
    const { data, error } = await supabase
        .rpc('submit_verified_review', {
            p_product_id: reviewData.product_id,
            p_rating: reviewData.rating,
            p_comment: reviewData.comment
        })
    if (error) throw error

    const review = Array.isArray(data) ? data[0] : data
    if (!review) throw new Error('Review could not be created.')

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, profile_img')
        .eq('id', review.profile_id)
        .maybeSingle()

    return {
        ...review,
        profiles: profile || null
    }
}

export async function rGetReviewsByProfileAndProductIds(profileId, productIds) {
    if (!profileId || !Array.isArray(productIds) || productIds.length === 0) return []

    const { data, error } = await supabase
        .from('reviews')
        .select('id, product_id, profile_id, rating, comment, created_at')
        .eq('profile_id', profileId)
        .in('product_id', productIds)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}
