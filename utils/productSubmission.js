export const MAX_PRODUCT_ZIP_SIZE = 200 * 1024 * 1024

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  '',
])

export function validateProductZip(file, { required = false } = {}) {
  if (!file) {
    if (required) throw new Error('A product ZIP file is required.')
    return null
  }

  const fileName = String(file.name || '').trim()
  const fileType = String(file.type || '').toLowerCase()
  const fileSize = Number(file.size)

  if (!fileName.toLowerCase().endsWith('.zip') || !ZIP_MIME_TYPES.has(fileType)) {
    throw new Error('Product content must be a valid ZIP file.')
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error('The product ZIP file cannot be empty.')
  }
  if (fileSize > MAX_PRODUCT_ZIP_SIZE) {
    throw new Error('Product ZIP must be 200 MB or smaller.')
  }

  return file
}

export function validateProductSubmission(product, { hasExistingZip = false } = {}) {
  const name = String(product?.name || '').trim()
  const description = String(product?.description || '').trim()
  const price = Number(product?.price)
  const images = Array.isArray(product?.images) ? product.images : []

  if (!name) throw new Error('Product name is required.')
  if (name.length > 160) throw new Error('Product name must be 160 characters or fewer.')
  if (!description) throw new Error('Product description is required.')
  if (!Number.isSafeInteger(price) || price <= 0) {
    throw new Error('Product price must be a positive whole number.')
  }
  if (!images.length) throw new Error('At least one product image is required.')
  if (images.some((image) => !image?.file && !String(image?.image_url || '').trim())) {
    throw new Error('Every product image must contain a valid file or URL.')
  }

  validateProductZip(product?.zipFile, { required: !hasExistingZip })
}
