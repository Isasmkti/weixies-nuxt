import { rAll, rGetById, rGetBySlug, rCreate, rUpdate, rDelete, rUpsertProductCategories, rCreateProductFile } from '../repositories/productsRepository'
import { saveProductImages } from './productImagesService'

export async function sAll(page, limit, sortBy, sortOrder, search, categorySlug, minPrice, maxPrice) {
    try {
        return await rAll(page, limit, sortBy, sortOrder, search, categorySlug, minPrice, maxPrice)
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

export async function sCreate(product, images, categoryIds = [], zipFile) {
    try {
        const newProduct = await rCreate(product)
        if (newProduct) {
            if (images) await saveProductImages(newProduct.id, images)
            if (categoryIds.length) await rUpsertProductCategories(newProduct.id, categoryIds)
            if (zipFile) await rCreateProductFile(newProduct.id, zipFile)
            return await rGetById(newProduct.id)
        }
        return newProduct
    } catch (error) {
        throw error
    }
}

export async function sUpdate(id, product, images, categoryIds = [], zipFile) {
    try {
        const updatedProduct = await rUpdate(id, product)
        if (updatedProduct) {
            if (images) await saveProductImages(id, images)
            if (categoryIds) await rUpsertProductCategories(id, categoryIds)
            if (zipFile) await rCreateProductFile(id, zipFile)
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
