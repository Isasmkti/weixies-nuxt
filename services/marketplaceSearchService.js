import { rSearchMarketplace } from '../repositories/marketplaceSearchRepository'
import {
  MIN_MARKETPLACE_SEARCH_LENGTH,
  normalizeMarketplaceSearchQuery,
} from '../utils/marketplaceSearch'

function mapProduct(product, storesById) {
  const images = Array.isArray(product?.product_images) ? product.product_images : []
  const reviews = Array.isArray(product?.reviews) ? product.reviews : []
  const primaryImage = images.find(image => image.is_primary)?.image_url || images[0]?.image_url || null
  const ratingTotal = reviews.reduce((total, review) => total + Number(review?.rating || 0), 0)

  return {
    ...product,
    image_url: primaryImage,
    review_count: reviews.length,
    average_rating: reviews.length ? ratingTotal / reviews.length : 0,
    seller: product?.seller_id ? storesById.get(String(product.seller_id)) || null : null,
  }
}

export async function searchMarketplace(value, options = {}) {
  const query = normalizeMarketplaceSearchQuery(value)
  if (query.length < MIN_MARKETPLACE_SEARCH_LENGTH) {
    return { query, products: [], sellers: [] }
  }

  const result = await rSearchMarketplace(query, options)
  const storesById = new Map((result.productStores || []).map(store => [String(store.id), store]))

  return {
    query,
    products: (result.products || []).map(product => mapProduct(product, storesById)),
    sellers: result.sellers || [],
  }
}
