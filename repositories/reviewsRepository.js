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
        .from('reviews')
        .insert(reviewData)
        .select(`
            *,
            profiles (full_name, profile_img)
        `)
        .single()
    if (error) throw error
    return data
}
