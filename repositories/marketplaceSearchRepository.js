import { supabase } from '../utils/supabase'
import { escapePostgresLikePattern, mergeUniqueSearchRows } from '../utils/marketplaceSearch'

const PRODUCT_SEARCH_SELECT = `
  id,
  seller_id,
  name,
  slug,
  description,
  price,
  created_at,
  product_images(image_url, is_primary),
  reviews(rating)
`

const STORE_SEARCH_SELECT = 'id, store_name, store_slug, store_description, store_image_url, created_at'

function productQuery(column, pattern, limit) {
  return supabase
    .from('products')
    .select(PRODUCT_SEARCH_SELECT)
    .eq('status', 'published')
    .ilike(column, pattern)
    .order('created_at', { ascending: false })
    .limit(limit)
}

function storeQuery(column, pattern, limit) {
  return supabase
    .from('approved_seller_stores')
    .select(STORE_SEARCH_SELECT)
    .ilike(column, pattern)
    .order('created_at', { ascending: false })
    .limit(limit)
}

function rowsOrThrow(result) {
  if (result.error) throw result.error
  return result.data || []
}

export async function rSearchMarketplace(query, { productLimit = 12, sellerLimit = 8 } = {}) {
  const pattern = `%${escapePostgresLikePattern(query)}%`
  const [productsByNameResult, productsByDescriptionResult, storesByNameResult, storesByDescriptionResult] = await Promise.all([
    productQuery('name', pattern, productLimit),
    productQuery('description', pattern, productLimit),
    storeQuery('store_name', pattern, sellerLimit),
    storeQuery('store_description', pattern, sellerLimit),
  ])

  const products = mergeUniqueSearchRows(
    rowsOrThrow(productsByNameResult),
    rowsOrThrow(productsByDescriptionResult),
  ).slice(0, productLimit)
  const sellers = mergeUniqueSearchRows(
    rowsOrThrow(storesByNameResult),
    rowsOrThrow(storesByDescriptionResult),
  ).slice(0, sellerLimit)

  const sellerIds = [...new Set(products.map(product => product.seller_id).filter(Boolean))]
  let productStores = []

  if (sellerIds.length) {
    const result = await supabase
      .from('approved_seller_stores')
      .select(STORE_SEARCH_SELECT)
      .in('id', sellerIds)
    productStores = rowsOrThrow(result)
  }

  return { products, sellers, productStores }
}
