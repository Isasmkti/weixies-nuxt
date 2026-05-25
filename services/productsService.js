import { rAll, rGetById, rGetBySlug, rCreate, rUpdate, rDelete, rUpsertImages, rUpsertProductCategories } from '../repositories/productsRepository'

export async function sAll(page, limit, sortBy, sortOrder, search, categorySlug) {
    try {
        return await rAll(page, limit, sortBy, sortOrder, search, categorySlug)
    } catch (error) {
        throw error
    }
}

export async function sGetById(id) {
    try {
        const data = await rGetById(id)
        return data
    } catch (error) {
        throw error
    }
}

export async function sGetBySlug(slug) {
    try {
        const data = await rGetBySlug(slug)
        return data
    } catch (error) {
        throw error
    }
}

export async function sCreate(product, images, categoryIds = []) {
    try {
        const newProduct = await rCreate(product)
        if (newProduct) {
            if (images) await rUpsertImages(newProduct.id, images)
            if (categoryIds.length) await rUpsertProductCategories(newProduct.id, categoryIds)
            return await rGetById(newProduct.id)
        }
        return newProduct
    } catch (error) {
        throw error
    }
}

export async function sUpdate(id, product, images, categoryIds = []) {
    try {
        const updatedProduct = await rUpdate(id, product)
        if (updatedProduct) {
            if (images) await rUpsertImages(id, images)
            if (categoryIds) await rUpsertProductCategories(id, categoryIds)
            return await rGetById(id)
        }
        return updatedProduct
    } catch (error) {
        throw error
    }
}

export async function sDelete(id) {
    try {
        return await rDelete(id)
    } catch (error) {
        throw error
    }
}
