import { supabase } from '../utils/supabase'

export async function rAll() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })
    if (error) throw error
    return data || []
}

export async function rGetById(id) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw error
    return data
}

export async function rGetBySlug(slug) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single()
    if (error) throw error
    return data
}
