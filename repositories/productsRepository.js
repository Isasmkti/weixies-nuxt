import { supabase } from '../utils/supabase'

const PRODUCT_SELECT = `
  *,
  product_images(*),
  product_categories(
    categories(*)
  ),
  reviews(*),
  product_files(*),
  product_licenses(
    id,
    product_id,
    license_type_id,
    name,
    price,
    usage_terms,
    max_end_products,
    allow_resale,
    allow_commercial_use,
    is_active,
    sort_order,
    created_at,
    updated_at,
    license_types(id, name, slug)
  )
`
const PRODUCT_DETAIL_SELECT = `
  ${PRODUCT_SELECT},
  product_specs(id, product_id, spec_name, spec_value, sort_order, created_at)
`
const MAX_PRODUCT_FILE_SIZE = 200 * 1024 * 1024
const ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream', ''])
const PRODUCT_IMAGE_BUCKET = 'product-images'

export async function rFeatured(limit = 8) {
    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 24)
    const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          description,
          price,
          created_at,
          product_images(image_url, is_primary),
          product_categories(categories(id, name, slug)),
          reviews(rating)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(safeLimit)

    if (error) throw error
    return data || []
}

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
    const normalizedProductId = Number(productId)
    if (!Number.isSafeInteger(normalizedProductId) || normalizedProductId <= 0) {
        throw new Error('A valid product is required.')
    }

    const records = (Array.isArray(images) ? images : []).map((img, index) => ({
        id: img?.id ? String(img.id) : null,
        image_url: String(img?.image_url || '').trim(),
        storage_path: String(img?.storage_path || '').trim() || null,
        is_primary: Boolean(img?.is_primary ?? (index === 0)),
    }))

    if (records.some((record) => !record.image_url)) {
        throw new Error('Every product image requires a URL.')
    }

    const currentImages = await rGetProductImages(normalizedProductId)
    const currentById = new Map(currentImages.map((image) => [String(image.id), image]))
    const retainedIds = new Set()
    const savedInOrder = []
    const insertedIds = []

    try {
        for (const record of records) {
            if (record.id) {
                if (!currentById.has(record.id) || retainedIds.has(record.id)) {
                    throw new Error('One of the selected product images does not belong to this product.')
                }

                const { data, error } = await supabase
                    .from('product_images')
                    .update({
                        image_url: record.image_url,
                        storage_path: record.storage_path,
                    })
                    .eq('id', record.id)
                    .eq('product_id', normalizedProductId)
                    .select('id, product_id, image_url, storage_path, is_primary, created_at')
                    .single()

                if (error) throw error
                retainedIds.add(record.id)
                savedInOrder.push({ ...data, requestedPrimary: record.is_primary })
                continue
            }

            const { data, error } = await supabase
                .from('product_images')
                .insert({
                    product_id: normalizedProductId,
                    image_url: record.image_url,
                    storage_path: record.storage_path,
                    is_primary: false,
                })
                .select('id, product_id, image_url, storage_path, is_primary, created_at')
                .single()

            if (error) throw error
            insertedIds.push(data.id)
            savedInOrder.push({ ...data, requestedPrimary: record.is_primary })
        }

        if (savedInOrder.length) {
            const primary = savedInOrder.find((image) => image.requestedPrimary) || savedInOrder[0]
            const { error: resetPrimaryError } = await supabase
                .from('product_images')
                .update({ is_primary: false })
                .eq('product_id', normalizedProductId)

            if (resetPrimaryError) throw resetPrimaryError

            const { error: setPrimaryError } = await supabase
                .from('product_images')
                .update({ is_primary: true })
                .eq('id', primary.id)
                .eq('product_id', normalizedProductId)

            if (setPrimaryError) throw setPrimaryError
        }

        const removedIds = currentImages
            .map((image) => String(image.id))
            .filter((id) => !retainedIds.has(id))

        if (removedIds.length) {
            const { error: deleteError } = await supabase
                .from('product_images')
                .delete()
                .eq('product_id', normalizedProductId)
                .in('id', removedIds)

            if (deleteError) throw deleteError
        }

        return rGetProductImages(normalizedProductId)
    } catch (error) {
        // Only remove rows created by this attempt. Existing metadata is never
        // deleted until every insert/update and primary selection succeeds.
        if (insertedIds.length) {
            await supabase
                .from('product_images')
                .delete()
                .eq('product_id', normalizedProductId)
                .in('id', insertedIds)
        }

        throw error
    }
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
        .upload(filePath, file, { contentType: file.type, cacheControl: '31536000', upsert: false })

    if (error) {
        const status = Number(error?.statusCode || error?.status || 0)
        const message = String(error?.message || '')
        if (status === 401 || status === 403 || /row-level security|not authorized/i.test(message)) {
            const authorizationError = new Error('Product image upload was denied. Your seller account must be approved and own this product.')
            authorizationError.code = error?.code || 'PRODUCT_IMAGE_UPLOAD_DENIED'
            authorizationError.cause = error
            throw authorizationError
        }
        throw error
    }

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

export async function rSyncProductLicenses(productId, licenses = []) {
    const normalizedProductId = Number(productId)
    if (!Number.isSafeInteger(normalizedProductId) || normalizedProductId <= 0) {
        throw new Error('A valid product is required.')
    }
    if (!Array.isArray(licenses) || licenses.length === 0 || !licenses.some((license) => license.is_active !== false)) {
        throw new Error('At least one active product license is required.')
    }

    const { data: currentRows, error: currentError } = await supabase
        .from('product_licenses')
        .select('id, product_id, is_active')
        .eq('product_id', normalizedProductId)

    if (currentError) throw currentError

    const currentIds = new Set((currentRows || []).map((license) => String(license.id)))
    const submittedIds = new Set()

    // Activate/create submitted active tiers first. This keeps published
    // products valid while obsolete tiers are deactivated in later requests.
    const operations = licenses
        .map((license, index) => ({ license, index }))
        .sort((a, b) => Number(b.license.is_active) - Number(a.license.is_active))

    for (const { license, index } of operations) {
        const record = {
            product_id: normalizedProductId,
            license_type_id: license.license_type_id || null,
            name: license.name,
            price: license.price,
            usage_terms: license.usage_terms,
            max_end_products: license.max_end_products,
            allow_resale: license.allow_resale,
            allow_commercial_use: license.allow_commercial_use,
            is_active: license.is_active,
            sort_order: index,
        }

        if (license.id) {
            const licenseId = String(license.id)
            if (!currentIds.has(licenseId) || submittedIds.has(licenseId)) {
                throw new Error('One of the submitted licenses does not belong to this product.')
            }
            const { error } = await supabase
                .from('product_licenses')
                .update(record)
                .eq('id', licenseId)
                .eq('product_id', normalizedProductId)
            if (error) throw error
            submittedIds.add(licenseId)
            continue
        }

        const { data, error } = await supabase
            .from('product_licenses')
            .insert(record)
            .select('id')
            .single()
        if (error) throw error
        submittedIds.add(String(data.id))
    }

    const omittedIds = [...currentIds].filter((id) => !submittedIds.has(id))
    if (omittedIds.length) {
        const { error } = await supabase
            .from('product_licenses')
            .update({ is_active: false })
            .eq('product_id', normalizedProductId)
            .in('id', omittedIds)
        if (error) throw error
    }

    const { data, error } = await supabase
        .from('product_licenses')
        .select('id, product_id, license_type_id, name, price, usage_terms, max_end_products, allow_resale, allow_commercial_use, is_active, sort_order, created_at, updated_at')
        .eq('product_id', normalizedProductId)
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
