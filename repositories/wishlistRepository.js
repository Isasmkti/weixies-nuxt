import { supabase } from '../utils/supabase'

const WISHLIST_SELECT = `
  *,
  product:products(
    *,
    product_images(*),
    product_licenses(id, name, price, is_active, sort_order)
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
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('You must be signed in to add products to the wishlist.')

    try {
        await $fetch('/api/wishlists', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: { product_id: productId },
        })
    } catch (error) {
        throw new Error(error?.data?.message || error?.data?.statusMessage || error?.message || 'Unable to add this product to the wishlist.')
    }
}

export async function rRemoveWishlist(profileId, productId) {
    const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('profile_id', profileId)
        .eq('product_id', productId)
    if (error) throw error
}
