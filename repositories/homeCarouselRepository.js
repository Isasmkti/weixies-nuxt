import { supabase } from '../utils/supabase'

const COLUMNS = 'id, content_type, badge, title, description, image_path, button_label, link_url, is_active, sort_order, published_at, starts_at, ends_at, created_at, updated_at'

export async function rPublicHomeCarouselItems() {
  const { data, error } = await supabase
    .from('home_carousel_items')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function rAdminHomeCarouselItems() {
  const { data, error } = await supabase
    .from('home_carousel_items')
    .select(COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function rCreateHomeCarouselItem(payload) {
  const { data, error } = await supabase
    .from('home_carousel_items')
    .insert(payload)
    .select(COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function rUpdateHomeCarouselItem(id, payload) {
  const { data, error } = await supabase
    .from('home_carousel_items')
    .update(payload)
    .eq('id', id)
    .select(COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function rDeleteHomeCarouselItem(id) {
  const { error } = await supabase
    .from('home_carousel_items')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function rUploadHomeCarouselImage(path, file) {
  const { error } = await supabase.storage
    .from('home-carousel')
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })

  if (error) throw error
  return path
}

export async function rDeleteHomeCarouselImage(path) {
  if (!path) return
  const { error } = await supabase.storage.from('home-carousel').remove([path])
  if (error) throw error
}

export function rHomeCarouselImageUrl(path) {
  if (!path) return ''
  return supabase.storage.from('home-carousel').getPublicUrl(path).data.publicUrl
}
