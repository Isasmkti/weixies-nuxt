import { supabase } from '../utils/supabase'

async function authenticatedPurchaseFetch(path, query, profileId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token || session.user.id !== profileId) {
    throw new Error('You must be signed in to view your purchases.')
  }
  return $fetch(path, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    query,
  })
}

export const rGetPurchases = (profileId, filters) => authenticatedPurchaseFetch('/api/purchases', filters, profileId)
export const rGetPurchaseOwnership = (profileId, ids) => authenticatedPurchaseFetch(
  '/api/purchases/ownership', { product_ids: ids.join(',') }, profileId,
)
