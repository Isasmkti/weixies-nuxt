import { rSearchApprovedSellers } from '../repositories/marketplaceSearchRepository'
import {
  MIN_MARKETPLACE_SEARCH_LENGTH,
  normalizeMarketplaceSearchQuery,
} from '../utils/marketplaceSearch'

export async function searchMarketplaceSellers(value, options = {}) {
  const query = normalizeMarketplaceSearchQuery(value)
  if (query.length < MIN_MARKETPLACE_SEARCH_LENGTH) return []
  return rSearchApprovedSellers(query, options)
}
