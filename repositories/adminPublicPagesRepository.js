import { supabase } from '../utils/supabase'

async function adminRequest(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Administrator session is unavailable.')
  return $fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${session.access_token}` },
  })
}

export async function rAdminPublicPages() {
  return (await adminRequest('/api/admin/public-pages'))?.pages || []
}

export async function rCreateAdminPublicPage(payload) {
  return (await adminRequest('/api/admin/public-pages', { method: 'POST', body: payload }))?.page
}

export async function rUpdateAdminPublicPage(id, payload) {
  return (await adminRequest(`/api/admin/public-pages/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }))?.page
}

export function rDeleteAdminPublicPage(id) {
  return adminRequest(`/api/admin/public-pages/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
