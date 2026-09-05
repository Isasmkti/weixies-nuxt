import { rAll, rFeatured, rGetById, rGetBySlug, rCreate, rUpdate, rDelete, rUpsertProductCategories, rCreateProductFile, rReplaceProductSpecs, rSyncProductLicenses } from '../repositories/productsRepository'
import { saveProductImages } from './productImagesService'
import { normalizeProductSpecs } from '../utils/productSpecs'
import { normalizeProductLicenses } from '../utils/productLicenses'
import { validateProductSubmission } from '../utils/productSubmission'

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

export async function sFeatured(limit = 8) {
    return rFeatured(limit)
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

export async function sCreate(product, images, categoryIds = [], zipFile, specs = [], syncImages = true, licenses = []) {
    try {
        validateProductSubmission({ ...product, images, zipFile })
        const normalizedSpecs = normalizeProductSpecs(specs)
        const normalizedLicenses = normalizeProductLicenses(licenses, product?.price)
        const catalogPrice = Math.min(...normalizedLicenses.filter((license) => license.is_active).map((license) => license.price))
        const requestedStatus = product?.status || 'published'
        const newProduct = await rCreate({
            ...product,
            price: catalogPrice,
            // Child license rows are persisted immediately after the product.
            // Publishing only afterwards satisfies the cross-row DB guard.
            status: requestedStatus === 'published' ? 'draft' : requestedStatus,
        })
        if (newProduct) {
            await runProductSaveStage('Unable to save product licenses', () => rSyncProductLicenses(newProduct.id, normalizedLicenses))
            if (syncImages !== false && Array.isArray(images) && images.length > 0) {
                await runProductSaveStage('Unable to save product images', () => saveProductImages(newProduct.id, images))
            }
            if (categoryIds.length) await runProductSaveStage('Unable to save product categories', () => rUpsertProductCategories(newProduct.id, categoryIds))
            await runProductSaveStage('Unable to save product specifications', () => rReplaceProductSpecs(newProduct.id, normalizedSpecs))
            if (zipFile) await runProductSaveStage('Unable to save the product ZIP', () => rCreateProductFile(newProduct.id, zipFile))
            if (requestedStatus === 'published') {
                await runProductSaveStage('Unable to publish the product', () => rUpdate(newProduct.id, { status: 'published' }))
            }
            return await runProductSaveStage('Unable to reload the saved product', () => rGetById(newProduct.id))
        }
        return newProduct
    } catch (error) {
        throw error
    }
}

export async function sUpdate(id, product, images, categoryIds = [], zipFile, specs = [], syncImages = true, licenses = []) {
    try {
        const existingProduct = await rGetById(id)
        validateProductSubmission(
            { ...product, images, zipFile },
            { hasExistingZip: Boolean(existingProduct?.product_files?.length) },
        )
        const normalizedSpecs = normalizeProductSpecs(specs)
        const normalizedLicenses = normalizeProductLicenses(licenses, product?.price)
        const catalogPrice = Math.min(...normalizedLicenses.filter((license) => license.is_active).map((license) => license.price))
        const updatedProduct = await rUpdate(id, { ...product, price: catalogPrice })
        if (updatedProduct) {
            await runProductSaveStage('Unable to save product licenses', () => rSyncProductLicenses(id, normalizedLicenses))
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
