import { supabase } from '../utils/supabase'

async function authenticatedFetch(url) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('You must be signed in to view refunds.')

  return $fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}

export const rGetBuyerRefunds = () => authenticatedFetch('/api/refunds')
export const rGetSellerRefunds = () => authenticatedFetch('/api/seller/refunds')
