import { supabase } from '../utils/supabase'

const CART_ITEM_SELECT = `
  *,
  product_license:product_licenses!cart_items_product_license_id_fkey(
    id,
    name,
    price,
    usage_terms,
    max_end_products,
    allow_resale,
    allow_commercial_use,
    is_active
  ),
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

export async function rAddToCart(cartId, productId, productLicenseId) {
    const { data: existingRows, error: lookupError } = await supabase
        .from('cart_items')
        .select('id')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .eq('product_license_id', productLicenseId)
        .limit(1)

    if (lookupError) throw lookupError

    // Digital licenses are single-entitlement items. Adding the exact same
    // product/license combination twice is intentionally idempotent.
    if (existingRows?.length) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('You must be signed in to add products to the cart.')

    try {
        await $fetch('/api/cart/items', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: { product_id: productId, product_license_id: productLicenseId },
        })
    } catch (error) {
        throw new Error(error?.data?.message || error?.data?.statusMessage || error?.message || 'Unable to add this product to the cart.')
    }
}

export async function rRemoveFromCart(itemId) {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
    if (error) throw error
}
