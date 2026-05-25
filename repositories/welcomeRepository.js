import { supabase } from '../utils/supabase'

export async function rAll() {
    const [
        { data: hero },
        { data: about },
        { data: features },
        { data: products },
        { data: testimonials },
        { data: cta }
    ] = await Promise.all([
        supabase.from('welcome_hero').select('*').maybeSingle(),
        supabase.from('welcome_about').select('*').maybeSingle(),
        supabase.from('welcome_features').select('*').order('order'),
        supabase.from('welcome_products').select('*, product:products(*)').order('order'),
        supabase.from('welcome_testimonials').select('*').order('order'),
        supabase.from('welcome_cta').select('*').maybeSingle()
    ])

    return {
        hero,
        about,
        features: features || [],
        products: products || [],
        testimonials: testimonials || [],
        cta
    }
}
