import {
  rCreateSellerProduct,
  rGetSellerProduct,
  rGetSellerProductSales,
  rGetSellerProducts,
  rUpdateSellerProduct,
} from '../repositories/sellerProductsRepository'
import { rCreateProductFile, rReplaceProductSpecs, rUpsertProductCategories } from '../repositories/productsRepository'
import { saveProductImages } from './productImagesService'

const MAX_PRODUCT_SPECS = 30
const MAX_SPEC_NAME_LENGTH = 80
const MAX_SPEC_VALUE_LENGTH = 500

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

export function normalizeProductSpecs(specs) {
  const normalizedSpecs = (Array.isArray(specs) ? specs : [])
    .map((spec) => ({
      spec_name: String(spec?.spec_name || '').trim(),
      spec_value: String(spec?.spec_value || '').trim(),
    }))
    .filter((spec) => spec.spec_name || spec.spec_value)

  if (normalizedSpecs.length > MAX_PRODUCT_SPECS) throw new Error(`A product can have up to ${MAX_PRODUCT_SPECS} specifications.`)
  if (normalizedSpecs.some((spec) => !spec.spec_name || !spec.spec_value)) throw new Error('Each specification requires both a name and a value.')
  if (normalizedSpecs.some((spec) => spec.spec_name.length > MAX_SPEC_NAME_LENGTH)) throw new Error(`Specification names cannot exceed ${MAX_SPEC_NAME_LENGTH} characters.`)
  if (normalizedSpecs.some((spec) => spec.spec_value.length > MAX_SPEC_VALUE_LENGTH)) throw new Error(`Specification values cannot exceed ${MAX_SPEC_VALUE_LENGTH} characters.`)

  return normalizedSpecs
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
    zipFile: product?.zipFile || null,
  }
}

async function saveProductContent(productId, { images, categoryIds, specs, zipFile }) {
  await saveProductImages(productId, images)
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
  await saveProductContent(createdProduct.id, normalized)
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
