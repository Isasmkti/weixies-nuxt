import { supabase } from '../utils/supabase'

async function adminRequest(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Administrator session is unavailable.')

  return $fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
}

export async function rAdminCategories() {
  const response = await adminRequest('/api/admin/categories')
  return response?.categories || []
}

export async function rCreateAdminCategory(payload) {
  const response = await adminRequest('/api/admin/categories', { method: 'POST', body: payload })
  return response?.category
}

export async function rUpdateAdminCategory(categoryId, payload) {
  const response = await adminRequest(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
    method: 'PUT',
    body: payload,
  })
  return response?.category
}

export async function rDeleteAdminCategory(categoryId) {
  return adminRequest(`/api/admin/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' })
}
