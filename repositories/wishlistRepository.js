import { supabase } from '../utils/supabase'

const WISHLIST_SELECT = `
  *,
  product:products(
    *,
    product_images(*)
  )
`

export async function rGetWishlists(profileId) {
    const { data, error } = await supabase
        .from('wishlists')
        .select(WISHLIST_SELECT)
        .eq('profile_id', profileId)
    if (error) throw error
    return data || []
}

export async function rAddWishlist(profileId, productId) {
    const { error } = await supabase
        .from('wishlists')
        .insert({ profile_id: profileId, product_id: productId })
    if (error) throw error
}

export async function rRemoveWishlist(profileId, productId) {
    const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('profile_id', profileId)
        .eq('product_id', productId)
    if (error) throw error
}
