import { supabase } from '../utils/supabase'

export async function rAll() {
    const { data, error } = await supabase
        .from('welcome_content')
        .select('section, content, updated_at, updated_by')

    if (error) throw error

    return Object.fromEntries(
        (data || []).map((row) => [row.section, row.content])
    )
}

export async function rUpsertSection(section, content) {
    const { data, error } = await supabase
        .from('welcome_content')
        .upsert({ section, content }, { onConflict: 'section' })
        .select('section, content, updated_at, updated_by')
        .single()

    if (error) throw error
    return data
}

export async function rUploadAsset(filePath, file) {
    const { error } = await supabase.storage
        .from('welcome-assets')
        .upload(filePath, file, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data } = supabase.storage.from('welcome-assets').getPublicUrl(filePath)
    return data.publicUrl
}
