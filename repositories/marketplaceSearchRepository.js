import { supabase } from '../utils/supabase'
import { escapePostgresLikePattern, mergeUniqueSearchRows } from '../utils/marketplaceSearch'

const STORE_SEARCH_SELECT = 'id, store_name, store_slug, store_description, store_image_url, created_at'

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

export async function rSearchApprovedSellers(query, { sellerLimit = 8 } = {}) {
  const pattern = `%${escapePostgresLikePattern(query)}%`
  const [storesByNameResult, storesByDescriptionResult] = await Promise.all([
    storeQuery('store_name', pattern, sellerLimit),
    storeQuery('store_description', pattern, sellerLimit),
  ])

  return mergeUniqueSearchRows(
    rowsOrThrow(storesByNameResult),
    rowsOrThrow(storesByDescriptionResult),
  ).slice(0, sellerLimit)
}
