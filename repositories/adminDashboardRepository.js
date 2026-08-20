import { supabase } from '../utils/supabase'

export async function rGetAdminDashboard() {
  const { data, error } = await supabase.rpc('get_admin_dashboard')

  if (error) throw error
  return data || {}
}
