import { supabase } from '../utils/supabase'

export async function rGetAdminOperationsHealth() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Administrator session is unavailable.')

  return $fetch('/api/admin/operations/health', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })
}
