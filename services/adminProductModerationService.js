import {
  rGetProductsForModeration,
  rSetProductModerationStatus,
} from '../repositories/adminProductModerationRepository'

const MODERATION_FILTERS = new Set(['all', 'pending_review', 'published', 'rejected', 'suspended'])
const MODERATION_ACTIONS = new Set(['published', 'rejected', 'suspended'])

export async function getProductsForModeration(status = 'pending_review') {
  if (!MODERATION_FILTERS.has(status)) throw new Error('Invalid product status filter.')
  return rGetProductsForModeration(status)
}

export async function setProductModerationStatus(productId, status) {
  if (!MODERATION_ACTIONS.has(status)) throw new Error('Invalid moderation action.')
  return rSetProductModerationStatus(productId, status)
}
