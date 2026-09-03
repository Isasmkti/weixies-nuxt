import {
  rCreateSellerProduct,
  rGetSellerProduct,
  rGetSellerProductSales,
  rGetSellerProducts,
  rUpdateSellerProduct,
} from '../repositories/sellerProductsRepository'
import { rCreateProductFile, rReplaceProductSpecs, rSyncProductLicenses, rUpsertProductCategories } from '../repositories/productsRepository'
import { saveProductImages } from './productImagesService'
import { normalizeProductSpecs } from '../utils/productSpecs'
import { normalizeProductLicenses } from '../utils/productLicenses'
import { validateProductSubmission } from '../utils/productSubmission'

export { normalizeProductSpecs } from '../utils/productSpecs'

export function createProductSlug(productName) {
  const normalized = String(productName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)

  return normalized || 'product'
}

async function runSellerProductSaveStage(label, operation) {
  try {
    return await operation()
  } catch (error) {
    const wrappedError = new Error(`${label}: ${error?.message || 'Unknown database error.'}`)
    wrappedError.code = error?.code
    wrappedError.cause = error
    throw wrappedError
  }
}

function normalizeProduct(product) {
  const name = String(product?.name || '').trim()
  const description = String(product?.description || '').trim()
  const price = Number(product?.price)

  if (!name || !description) throw new Error('Product name and description are required.')
  if (!Number.isInteger(price) || price <= 0) throw new Error('Price must be a positive whole number.')

  const specs = normalizeProductSpecs(product?.specs)
  const licenses = normalizeProductLicenses(product?.licenses, price)
  const catalogPrice = Math.min(...licenses.filter((license) => license.is_active).map((license) => license.price))

  return {
    product: {
      name,
      description,
      price: catalogPrice,
      slug: createProductSlug(product?.slug || name),
    },
    images: Array.isArray(product?.images) ? product.images : [],
    categoryIds: Array.isArray(product?.categoryIds) ? product.categoryIds : [],
    specs,
    licenses,
    syncImages: product?.syncImages !== false,
    zipFile: product?.zipFile || null,
  }
}

async function saveProductContent(productId, { images, categoryIds, specs, licenses, syncImages, zipFile }, { isNew = false } = {}) {
  await runSellerProductSaveStage('Unable to save product licenses', () => rSyncProductLicenses(productId, licenses))
  if (syncImages && (!isNew || images.length > 0)) {
    await runSellerProductSaveStage('Unable to save product images', () => saveProductImages(productId, images))
  }
  await runSellerProductSaveStage('Unable to save product categories', () => rUpsertProductCategories(productId, categoryIds))
  await runSellerProductSaveStage('Unable to save product specifications', () => rReplaceProductSpecs(productId, specs))
  if (zipFile) {
    await runSellerProductSaveStage('Unable to save the product ZIP', () => rCreateProductFile(productId, zipFile))
  }
}

export async function sGetSellerProducts(sellerId) {
  const [products, paidItems] = await Promise.all([
    rGetSellerProducts(sellerId),
    rGetSellerProductSales(sellerId),
  ])
  const salesByProduct = paidItems.reduce((result, item) => {
    const key = String(item.product_id)
    result[key] = (result[key] || 0) + 1
    return result
  }, {})

  return products.map((product) => ({
    ...product,
    sales_count: salesByProduct[String(product.id)] || 0,
  }))
}

export async function sGetSellerProduct(productId, sellerId) {
  return rGetSellerProduct(productId, sellerId)
}

export async function sCreateSellerProduct(sellerId, product) {
  validateProductSubmission(product)
  const normalized = normalizeProduct(product)
  const createdProduct = await runSellerProductSaveStage('Unable to create the product', () => (
    rCreateSellerProduct({
      ...normalized.product,
      seller_id: sellerId,
      // Keep an incomplete upload out of the moderation queue. The product is
      // submitted only after its images, licenses, and ZIP are saved.
      status: 'draft',
    })
  ))
  await saveProductContent(createdProduct.id, normalized, { isNew: true })
  return runSellerProductSaveStage('Unable to submit the product for review', () => (
    rUpdateSellerProduct(createdProduct.id, sellerId, { status: 'pending_review' })
  ))
}

export async function sUpdateSellerProduct(productId, sellerId, product) {
  const existingProduct = await rGetSellerProduct(productId, sellerId)
  if (!existingProduct) throw new Error('Product not found or you do not have access to it.')
  validateProductSubmission(product, { hasExistingZip: Boolean(existingProduct.product_files?.length) })
  const normalized = normalizeProduct(product)
  await runSellerProductSaveStage('Unable to update the product', () => (
    rUpdateSellerProduct(productId, sellerId, {
      ...normalized.product,
      // Save content while the product is a private draft. A failed ZIP/image
      // upload therefore cannot leave a partial product in moderation.
      status: 'draft',
    })
  ))
  await saveProductContent(productId, normalized)
  await runSellerProductSaveStage('Unable to submit the product for review', () => (
    rUpdateSellerProduct(productId, sellerId, { status: 'pending_review' })
  ))
  return { id: productId }
}
