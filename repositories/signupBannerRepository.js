import { supabase } from '../utils/supabase'

const BUCKET = 'welcome-assets'
const COLUMNS = 'id, image_path, alt_text, is_active, created_at, updated_at, updated_by'

export async function rPublicSignupBanner() {
  const { data, error } = await supabase
    .from('signup_banner_settings')
    .select(COLUMNS)
    .eq('id', true)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function rAdminSignupBanner() {
  const { data, error } = await supabase
    .from('signup_banner_settings')
    .select(COLUMNS)
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function rSaveSignupBanner(payload) {
  const { data, error } = await supabase
    .from('signup_banner_settings')
    .upsert({ id: true, ...payload }, { onConflict: 'id' })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function rUploadSignupBanner(path, file) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

export async function rDeleteSignupBanner(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function rSignupBannerUrl(path) {
  if (!path) return ''
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
