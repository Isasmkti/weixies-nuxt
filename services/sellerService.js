import { supabase } from '../utils/supabase'

export function createStoreSlug(storeName) {
  const normalized = String(storeName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return normalized || 'store'
}

export async function getSellerByProfileId(profileId) {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, profile_id, store_name, store_slug, store_description, status, rejection_reason, created_at')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getCurrentSeller() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  return getSellerByProfileId(session.user.id)
}

export async function createSellerApplication(storeName, storeDescription = '') {
  const trimmedStoreName = String(storeName || '').trim()
  const trimmedStoreDescription = String(storeDescription || '').trim()
  if (!trimmedStoreName) {
    throw new Error('Store name is required.')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    throw new Error('You must be signed in to become a seller.')
  }

  const baseSlug = createStoreSlug(trimmedStoreName)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0
      ? ''
      : `-${Date.now().toString(36).slice(-5)}${attempt}`
    const storeSlug = `${baseSlug.slice(0, 60 - suffix.length)}${suffix}`

    const { data, error } = await supabase
      .from('sellers')
      .insert({
        profile_id: session.user.id,
        store_name: trimmedStoreName,
        store_slug: storeSlug,
        store_description: trimmedStoreDescription || null,
      })
      .select('id, store_name, store_slug, status')
      .single()

    if (!error) return data

    // Retry only a generated-slug collision. A duplicate profile or any other
    // RLS/database error must be surfaced to the user as-is.
    if (error.code !== '23505' || !String(error.message || '').includes('store_slug')) {
      throw error
    }
  }

  throw new Error('Unable to generate a unique store URL. Please try again.')
}

export async function resubmitSellerApplication(sellerId, storeName, storeDescription = '') {
  const trimmedStoreName = String(storeName || '').trim()
  const trimmedStoreDescription = String(storeDescription || '').trim()
  if (!trimmedStoreName) {
    throw new Error('Store name is required.')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    throw new Error('You must be signed in to resubmit your application.')
  }

  const { data, error } = await supabase
    .from('sellers')
    .update({
      store_name: trimmedStoreName,
      store_description: trimmedStoreDescription || null,
      status: 'pending',
      rejection_reason: null,
    })
    .eq('id', sellerId)
    .eq('profile_id', session.user.id)
    .select('id, store_name, store_slug, store_description, status, rejection_reason')
    .single()

  if (error) throw error
  return data
}
