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
  product_images(id, image_url, is_primary),
  product_files(id, file_name, file_size, version, version_sequence, release_status, published_at, created_at)
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
  const { error } = await supabase.rpc('moderate_product_release', {
    p_product_id: Number(productId),
    p_status: status,
  })

  if (error) throw error
  const { data, error: reloadError } = await supabase
    .from('products')
    .select(MODERATION_SELECT)
    .eq('id', productId)
    .not('seller_id', 'is', null)
    .single()
  if (reloadError) throw reloadError
  return data
}
