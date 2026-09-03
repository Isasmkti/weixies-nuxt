import { supabase } from '../utils/supabase'

const SELLER_PRODUCT_SELECT = 'id, seller_id, name, slug, description, price, status, created_at'
const SELLER_PRODUCT_CONTENT_SELECT = `
  ${SELLER_PRODUCT_SELECT},
  product_images(id, image_url, storage_path, is_primary),
  product_categories(category_id, categories(id, name, slug)),
  product_files(id, file_name, file_url, file_size, version, created_at),
  product_licenses(id, product_id, license_type_id, name, price, usage_terms, max_end_products, allow_resale, allow_commercial_use, is_active, sort_order, created_at, updated_at)
`
const SELLER_PRODUCT_DETAIL_SELECT = `
  ${SELLER_PRODUCT_CONTENT_SELECT},
  product_specs(id, spec_name, spec_value, sort_order, created_at)
`

export async function rGetSellerProducts(sellerId) {
  const { data, error } = await supabase
    .from('products')
    .select(SELLER_PRODUCT_CONTENT_SELECT)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function rGetSellerProduct(productId, sellerId) {
  const { data, error } = await supabase
    .from('products')
    .select(SELLER_PRODUCT_DETAIL_SELECT)
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function rCreateSellerProduct(product) {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    // Creating the base product must not depend on nested relationship cache.
    // Images, categories, specs, and files are persisted by the following
    // save stages and loaded only when a detail page actually needs them.
    .select(SELLER_PRODUCT_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function rUpdateSellerProduct(productId, sellerId, product) {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .select(SELLER_PRODUCT_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function rGetSellerProductSales(sellerId) {
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, orders!inner(id, status)')
    .eq('seller_id', sellerId)
    .eq('orders.status', 'paid')

  if (error) throw error
  return data || []
}
