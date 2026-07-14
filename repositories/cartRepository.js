import { supabase } from '../utils/supabase'

const CART_ITEM_SELECT = `
  *,
  product:products(
    *,
    product_images(*)
  )
`

export async function rGetCartWithCreation(profileId) {
    const { data: existing } = await supabase
        .from('cart')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()

    if (existing) return existing

    const { data, error } = await supabase
        .from('cart')
        .insert({ profile_id: profileId })
        .select()
        .single()
    if (error) throw error
    return data
}

export async function rGetCartItems(cartId) {
    const { data, error } = await supabase
        .from('cart_items')
        .select(CART_ITEM_SELECT)
        .eq('cart_id', cartId)
    if (error) throw error
    return data || []
}

export async function rAddToCart(cartId, productId) {
    const { data: existing } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .maybeSingle()

    if (existing) {
        const { error } = await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + 1 })
            .eq('id', existing.id)
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('cart_items')
            .insert({ cart_id: cartId, product_id: productId })
        if (error) throw error
    }
}

export async function rRemoveFromCart(itemId) {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
    if (error) throw error
}
