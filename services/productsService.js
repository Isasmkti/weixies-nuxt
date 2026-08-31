import { rAll, rGetById, rGetBySlug, rCreate, rUpdate, rDelete, rUpsertProductCategories, rCreateProductFile, rReplaceProductSpecs } from '../repositories/productsRepository'
import { saveProductImages } from './productImagesService'
import { normalizeProductSpecs } from '../utils/productSpecs'

async function runProductSaveStage(label, operation) {
    try {
        return await operation()
    } catch (error) {
        const wrappedError = new Error(`${label}: ${error?.message || 'Unknown database error.'}`)
        wrappedError.code = error?.code
        wrappedError.cause = error
        throw wrappedError
    }
}

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

export async function sCreate(product, images, categoryIds = [], zipFile, specs = [], syncImages = true) {
    try {
        const normalizedSpecs = normalizeProductSpecs(specs)
        const newProduct = await rCreate(product)
        if (newProduct) {
            if (syncImages !== false && Array.isArray(images) && images.length > 0) {
                await runProductSaveStage('Unable to save product images', () => saveProductImages(newProduct.id, images))
            }
            if (categoryIds.length) await runProductSaveStage('Unable to save product categories', () => rUpsertProductCategories(newProduct.id, categoryIds))
            await runProductSaveStage('Unable to save product specifications', () => rReplaceProductSpecs(newProduct.id, normalizedSpecs))
            if (zipFile) await runProductSaveStage('Unable to save the product ZIP', () => rCreateProductFile(newProduct.id, zipFile))
            return await runProductSaveStage('Unable to reload the saved product', () => rGetById(newProduct.id))
        }
        return newProduct
    } catch (error) {
        throw error
    }
}

export async function sUpdate(id, product, images, categoryIds = [], zipFile, specs = [], syncImages = true) {
    try {
        const normalizedSpecs = normalizeProductSpecs(specs)
        const updatedProduct = await rUpdate(id, product)
        if (updatedProduct) {
            if (syncImages !== false) await runProductSaveStage('Unable to save product images', () => saveProductImages(id, images))
            if (categoryIds) await runProductSaveStage('Unable to save product categories', () => rUpsertProductCategories(id, categoryIds))
            await runProductSaveStage('Unable to save product specifications', () => rReplaceProductSpecs(id, normalizedSpecs))
            if (zipFile) await runProductSaveStage('Unable to save the product ZIP', () => rCreateProductFile(id, zipFile))
            return await runProductSaveStage('Unable to reload the saved product', () => rGetById(id))
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
