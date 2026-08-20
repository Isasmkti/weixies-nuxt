import { supabase } from '../utils/supabase'

const MODERATION_SELECT = `
  id,
  seller_id,
  name,
  slug,
  description,
  price,
  status,
  created_at,
  seller:sellers(id, store_name, store_slug),
  product_images(id, image_url, is_primary)
`

export async function rGetProductsForModeration(status = 'pending_review') {
  let query = supabase
    .from('products')
    .select(MODERATION_SELECT)
    .not('seller_id', 'is', null)
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function rSetProductModerationStatus(productId, status) {
  const { data, error } = await supabase
    .from('products')
    .update({ status })
    .eq('id', productId)
    .not('seller_id', 'is', null)
    .select(MODERATION_SELECT)
    .single()

  if (error) throw error
  return data
}
