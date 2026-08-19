import { supabase } from '../utils/supabase'

export async function rAllActivityLogs(limit = 200) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, actor_profile_id, actor_name, actor_type, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
