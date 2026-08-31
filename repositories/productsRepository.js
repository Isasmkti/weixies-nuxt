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
const PRODUCT_DETAIL_SELECT = `
  ${PRODUCT_SELECT},
  product_specs(id, product_id, spec_name, spec_value, sort_order, created_at)
`
const MAX_PRODUCT_FILE_SIZE = 200 * 1024 * 1024
const ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream', ''])
const PRODUCT_IMAGE_BUCKET = 'product-images'

export async function rAll(page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', search = '', categorySlug = [], minPrice = null, maxPrice = null) {
    let query = supabase
        .from('products')
        .select(PRODUCT_SELECT, { count: 'exact' })
        .eq('status', 'published')
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
        .select(PRODUCT_DETAIL_SELECT)
        .eq('id', id)
        .single()
    if (error) throw error
    return data
}

export async function rGetBySlug(slug) {
    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_DETAIL_SELECT)
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

export async function rReplaceProductImages(productId, images) {
    const records = (Array.isArray(images) ? images : []).map((img, index) => ({
        image_url: String(img?.image_url || '').trim(),
        storage_path: String(img?.storage_path || '').trim() || null,
        is_primary: Boolean(img?.is_primary ?? (index === 0)),
    }))

    const { data, error } = await supabase.rpc('replace_product_images', {
        p_product_id: Number(productId),
        p_images: records,
    })

    if (error) throw error
    return data || []
}

export async function rGetProductImages(productId) {
    const { data, error } = await supabase
        .from('product_images')
        .select('id, product_id, image_url, storage_path, is_primary, created_at')
        .eq('product_id', productId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function rUploadProductImage(filePath, file) {
    const { error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(filePath, file, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filePath)
    return { image_url: data.publicUrl, storage_path: filePath }
}

export async function rRemoveProductImageFiles(filePaths) {
    const uniquePaths = [...new Set((Array.isArray(filePaths) ? filePaths : []).filter(Boolean))]
    if (uniquePaths.length === 0) return

    const { error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(uniquePaths)

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

export async function rReplaceProductSpecs(productId, specs = []) {
    const { error: deleteError } = await supabase
        .from('product_specs')
        .delete()
        .eq('product_id', productId)

    if (deleteError) throw deleteError

    const records = (Array.isArray(specs) ? specs : [])
        .map((spec, index) => ({
            product_id: productId,
            spec_name: String(spec?.spec_name || '').trim(),
            spec_value: String(spec?.spec_value || '').trim(),
            sort_order: index,
        }))
        .filter((spec) => spec.spec_name && spec.spec_value)

    if (records.length === 0) return []

    const { data, error } = await supabase
        .from('product_specs')
        .insert(records)
        .select('id, product_id, spec_name, spec_value, sort_order, created_at')
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}

export async function rCreateProductFile(productId, file) {
    if (!file) return null
    if (!Number.isSafeInteger(Number(productId)) || Number(productId) <= 0) throw new Error('A valid product is required.')
    if (!String(file.name || '').toLowerCase().endsWith('.zip') || !ZIP_MIME_TYPES.has(String(file.type || '').toLowerCase())) {
        throw new Error('Product content must be a ZIP file.')
    }
    if (file.size <= 0 || file.size > MAX_PRODUCT_FILE_SIZE) {
        throw new Error('Product ZIP must be 200 MB or smaller.')
    }

    const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
    const filePath = `${productId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase
        .storage
        .from('products')
        .upload(filePath, file, { contentType: file.type || 'application/zip', upsert: false })

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
