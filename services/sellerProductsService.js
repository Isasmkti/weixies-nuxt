import {
  rCreateSellerProduct,
  rGetSellerProduct,
  rGetSellerProductSales,
  rGetSellerProducts,
  rUpdateSellerProduct,
} from '../repositories/sellerProductsRepository'
import { rCreateProductFile, rReplaceProductSpecs, rUpsertProductCategories } from '../repositories/productsRepository'
import { saveProductImages } from './productImagesService'
import { normalizeProductSpecs } from '../utils/productSpecs'

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

function normalizeProduct(product) {
  const name = String(product?.name || '').trim()
  const description = String(product?.description || '').trim()
  const price = Number(product?.price)

  if (!name || !description) throw new Error('Product name and description are required.')
  if (!Number.isInteger(price) || price < 0) throw new Error('Price must be a non-negative whole number.')

  const specs = normalizeProductSpecs(product?.specs)

  return {
    product: {
      name,
      description,
      price,
      slug: createProductSlug(product?.slug || name),
    },
    images: Array.isArray(product?.images) ? product.images : [],
    categoryIds: Array.isArray(product?.categoryIds) ? product.categoryIds : [],
    specs,
    syncImages: product?.syncImages !== false,
    zipFile: product?.zipFile || null,
  }
}

async function saveProductContent(productId, { images, categoryIds, specs, syncImages, zipFile }, { isNew = false } = {}) {
  if (syncImages && (!isNew || images.length > 0)) await saveProductImages(productId, images)
  await rUpsertProductCategories(productId, categoryIds)
  await rReplaceProductSpecs(productId, specs)
  if (zipFile) await rCreateProductFile(productId, zipFile)
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
  const normalized = normalizeProduct(product)
  const createdProduct = await rCreateSellerProduct({
    ...normalized.product,
    seller_id: sellerId,
    status: 'pending_review',
  })
  await saveProductContent(createdProduct.id, normalized, { isNew: true })
  return rGetSellerProduct(createdProduct.id, sellerId)
}

export async function sUpdateSellerProduct(productId, sellerId, product) {
  const normalized = normalizeProduct(product)
  await rUpdateSellerProduct(productId, sellerId, {
    ...normalized.product,
    // Every seller edit goes back through moderation before it can be public.
    status: 'pending_review',
  })
  await saveProductContent(productId, normalized)
  return rGetSellerProduct(productId, sellerId)
}
