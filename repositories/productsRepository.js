import { supabase } from '../utils/supabase'

const PRODUCT_SELECT = `
  *,
  product_images(*),
  product_categories(
    categories(*)
  ),
  reviews(*),
  product_files(*)
`

export async function rAll(page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', search = '', categorySlug = [], minPrice = null, maxPrice = null) {
    let query = supabase
        .from('products')
        .select(PRODUCT_SELECT, { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range((page - 1) * limit, page * limit - 1)

    if (search) {
        query = query.ilike('name', `%${search}%`)
    }

    if (minPrice !== null && minPrice !== '' && Number.isFinite(Number(minPrice)) && Number(minPrice) >= 0) {
        query = query.gte('price', Number(minPrice))
    }

    if (maxPrice !== null && maxPrice !== '' && Number.isFinite(Number(maxPrice)) && Number(maxPrice) >= 0) {
        query = query.lte('price', Number(maxPrice))
    }

    if (categorySlug.length > 0) {
        const { data: cats } = await supabase
            .from('categories')
            .select('id')
            .in('slug', categorySlug)
        const catIds = (cats || []).map(c => c.id)
        if (catIds.length > 0) {
            const { data: productIds } = await supabase
                .from('product_categories')
                .select('product_id')
                .in('category_id', catIds)
            const ids = (productIds || []).map(p => p.product_id)
            if (ids.length > 0) {
                query = query.in('id', ids)
            } else {
                return { data: [], total: 0 }
            }
        }
    }

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], total: count || 0 }
}

export async function rGetById(id) {
    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('id', id)
        .single()
    if (error) throw error
    return data
}

export async function rGetBySlug(slug) {
    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('slug', slug)
        .single()
    if (error) throw error
    return data
}

export async function rCreate(product) {
    const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function rUpdate(id, product) {
    const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function rDelete(id) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
    if (error) throw error
}

export async function rUpsertImages(productId, images) {
    const records = images.map((img, i) => ({
        product_id: productId,
        image_url: typeof img === 'string' ? img : img.image_url,
        is_primary: img.is_primary ?? (i === 0)
    }))

    const uniqueRecords = Array.from(
        new Map(records.map(item => [`${item.product_id}-${item.image_url}`, item]))
            .values()
    )

    await supabase
        .from('product_images')
        .delete()
        .eq('product_id', productId)

    if (uniqueRecords.length === 0) return

    const { error } = await supabase
        .from('product_images')
        .insert(uniqueRecords)

    if (error) throw error
}

export async function rUpsertProductCategories(productId, categoryIds) {
    await supabase
        .from('product_categories')
        .delete()
        .eq('product_id', productId)

    if (!categoryIds || categoryIds.length === 0) return

    const records = categoryIds.map(category_id => ({ product_id: productId, category_id }))
    const { error } = await supabase
        .from('product_categories')
        .insert(records)
    if (error) throw error
}

export async function rCreateProductFile(productId, file) {
    if (!file) return null

    const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
    const filePath = `${productId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase
        .storage
        .from('products')
        .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data, error } = await supabase
        .from('product_files')
        .insert({
            product_id: productId,
            file_url: filePath,
            file_name: file.name,
            file_size: file.size
        })
        .select()
        .single()

    if (error) throw error
    return data
}
