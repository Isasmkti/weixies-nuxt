import { supabase } from '../utils/supabase'

export async function chatReportRequest(path, options = {}) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Please sign in again to continue.')
  return $fetch(path, { ...options, headers: { Authorization: `Bearer ${session.access_token}` } })
}
